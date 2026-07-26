import type { BrowserWindow } from 'electron'
import type { WorkspaceModelBindings } from '../../shared/ai/bindings'
import type { NormalizedTaskInput } from '../../shared/ai/task'
import type { AgentMode, AppSettings } from '../../shared/types'
import { assessCommand } from '../security/ExecutionPolicy'
import type { Logger } from '../logging/Logger'
import { CodexClient } from '../codex/CodexClient'
import type { CodexEvent } from '../codex/protocol'
import type { ModelRegistry } from './ModelRegistry'
import type { ProviderRegistry } from './ProviderRegistry'
import { startAiTurn } from './executeAiTurn'

export type ApprovalDetails = Map<string, { command?: string; risk?: string }>

interface ActiveExecution {
  conversationId: string
  kind: 'codex' | 'provider'
  threadId?: string
  cancel(): Promise<void>
}

interface CodexTurnInput {
  conversationId: string
  workspace: string
  prompt: string
  attachments: string[]
  memory: string
  mode: AgentMode
  settings: AppSettings
}

export class AiExecutionCoordinator {
  private readonly codex = new CodexClient()
  private active: ActiveExecution | null = null
  private disposed = false

  constructor(
    private readonly win: BrowserWindow,
    private readonly models: ModelRegistry,
    private readonly providers: ProviderRegistry,
    private readonly logger: Logger,
    private readonly approvalDetails: ApprovalDetails,
  ) {
    this.codex.on('event', this.onCodexEvent)
    this.codex.on('status', this.onCodexStatus)
    this.codex.on('log', this.onCodexLog)
    this.codex.on('diagnostic', this.onCodexDiagnostic)
  }

  async startCodex(input: CodexTurnInput) {
    this.reserve(input.conversationId, 'codex')
    try {
      const threadId = await this.codex.createThread(
        input.workspace,
        input.settings as unknown as Record<string, string>,
        input.memory,
      )
      if (!this.active || this.active.conversationId !== input.conversationId) {
        throw new Error('A execução foi cancelada antes de iniciar.')
      }
      this.active.threadId = threadId
      this.active.cancel = async () => this.codex.interrupt(threadId)
      await this.codex.sendTurn(
        threadId,
        input.workspace,
        input.prompt,
        input.settings as unknown as Record<string, string>,
        input.attachments,
        input.memory,
        input.mode,
      )
    } catch (error) {
      this.active = null
      throw error
    }
  }

  async startProvider(
    conversationId: string,
    taskInput: NormalizedTaskInput,
    bindings: WorkspaceModelBindings,
  ) {
    this.reserve(conversationId, 'provider')
    this.pushStatus('planning', conversationId)
    try {
      const turn = await startAiTurn(
        this.models,
        this.providers,
        taskInput,
        bindings,
        (method, params) => this.pushEvent(method, params, conversationId),
      )
      if (!this.active || this.active.conversationId !== conversationId) {
        turn.cancel('A execução perdeu seu contexto ativo.')
        throw new Error('A execução foi cancelada antes de iniciar.')
      }
      this.active.cancel = async () => {
        turn.cancel('Execução cancelada pelo usuário.')
      }
      this.pushStatus('running', conversationId)
      void turn.completion
        .then(() => {
          this.pushStatus('completed', conversationId)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          this.pushEvent('error', { message }, conversationId)
          this.pushEvent('turn/completed', {
            turn: { id: turn.executionId, error: { message } },
          }, conversationId)
          this.pushStatus('failed', conversationId, message)
        })
        .finally(() => {
          if (this.active?.conversationId === conversationId) {
            this.active = null
          }
        })
    } catch (error) {
      this.active = null
      this.pushStatus(
        'failed',
        conversationId,
        error instanceof Error ? error.message : String(error),
      )
      throw error
    }
  }

  async cancel(conversationId: string) {
    if (!this.active || this.active.conversationId !== conversationId) {
      throw new Error('Nenhuma execução ativa nesta conversa.')
    }
    this.pushStatus('cancelling', conversationId)
    await this.active.cancel()
  }

  async resolveApproval(key: string, accepted: boolean, forSession = false) {
    if (this.active?.kind !== 'codex') {
      throw new Error('Não existe uma execução Codex aguardando aprovação.')
    }
    await this.codex.resolveApproval(key, accepted, forSession)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.codex.off('event', this.onCodexEvent)
    this.codex.off('status', this.onCodexStatus)
    this.codex.off('log', this.onCodexLog)
    this.codex.off('diagnostic', this.onCodexDiagnostic)
    this.codex.stop()
    this.active = null
    this.approvalDetails.clear()
  }

  private reserve(conversationId: string, kind: ActiveExecution['kind']) {
    if (this.active) {
      throw new Error('Já existe uma execução em andamento. Cancele-a antes de iniciar outra.')
    }
    this.active = {
      conversationId,
      kind,
      cancel: async () => {
        throw new Error('A execução ainda está iniciando e não pode ser cancelada neste instante.')
      },
    }
  }

  private readonly onCodexEvent = (event: CodexEvent) => {
    const conversationId = this.active?.conversationId
    if (!conversationId) return
    const command = event.params.command
    const assessment = typeof command === 'string' || Array.isArray(command)
      ? assessCommand(command as string | string[])
      : undefined
    const approvalKey = typeof event.params.approvalKey === 'string'
      ? event.params.approvalKey
      : undefined
    if (approvalKey) {
      this.approvalDetails.set(approvalKey, {
        command: Array.isArray(command)
          ? command.join(' ')
          : typeof command === 'string' ? command : undefined,
        risk: assessment?.risk,
      })
    }
    this.pushEvent(
      event.method,
      assessment
        ? { ...event.params, commandAssessment: assessment }
        : event.params,
      conversationId,
    )
    if (event.method === 'turn/completed' && this.active?.conversationId === conversationId) {
      this.active = null
    }
  }

  private readonly onCodexStatus = (status: { status: string; error?: string }) => {
    this.pushStatus(status.status, this.active?.conversationId, status.error)
  }

  private readonly onCodexLog = (entry: unknown) => {
    this.logger.debug('codex', 'Saída do App Server', entry)
  }

  private readonly onCodexDiagnostic = (entry: unknown) => {
    const level = entry && typeof entry === 'object'
      ? (entry as { level?: unknown }).level
      : undefined
    if (level === 'warn' || level === 'error') {
      this.logger.warn('codex', 'Diagnóstico do agente', entry)
    } else {
      this.logger.info('codex', 'Diagnóstico do agente', entry)
    }
  }

  private pushEvent(method: string, params: Record<string, unknown>, conversationId: string) {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('ai:event', {
        method,
        params: { ...params, conversationId },
      })
    }
  }

  private pushStatus(status: string, conversationId?: string, error?: string) {
    if (!this.win.isDestroyed()) {
      this.win.webContents.send('ai:status', { status, conversationId, error })
    }
  }
}
