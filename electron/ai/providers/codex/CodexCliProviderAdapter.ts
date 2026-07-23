import { EventEmitter } from 'node:events'
import type { CodexEvent, CodexStatus } from '../../../codex/protocol'
import type { NormalizedErrorCode } from '../../../../shared/ai/execution'
import type { ModelDescriptor } from '../../../../shared/ai/model'
import type { ProviderAvailability } from '../../../../shared/ai/provider'
import type {
  ProviderExecutionControl,
  ProviderExecutionRequest,
  ProviderExecutionResult,
} from '../../../../shared/ai/providerExecution'
import type { NormalizedTask } from '../../../../shared/ai/task'
import { ProviderExecutionError } from '../../ProviderExecutionError'
import type { ProviderAdapter } from '../../ProviderRegistry'

export const CODEX_CLI_PROVIDER_ID = 'codex-cli'

export type CodexCompatibilityStatus =
  | 'unsupported'
  | 'minimum-compatible-unverified'
  | 'verified'

export interface CodexClientPort extends EventEmitter {
  readonly status: CodexStatus
  start(executable?: string): Promise<void>
  createThread(
    workspace: string,
    settings?: Record<string, string>,
    memory?: string,
    ephemeral?: boolean,
  ): Promise<string>
  sendTurn(
    threadId: string,
    workspace: string,
    prompt: string,
    settings?: Record<string, string>,
    attachments?: string[],
    memory?: string,
    mode?: NormalizedTask['mode'],
  ): Promise<unknown>
  interrupt(threadId: string): Promise<void>
  resolveApproval(key: string, accepted: boolean, forSession?: boolean): Promise<void>
}

export interface CodexCliProviderDependencies {
  client: CodexClientPort
  models: readonly ModelDescriptor[]
  compatibility: () => CodexCompatibilityStatus
  resolveAuthorizedWorkspaceRoot: (
    workspaceId: string,
  ) => string | Promise<string>
  executable?: () => string
  completionTimeoutMs?: number
}

export class CodexCliProviderAdapter implements ProviderAdapter {
  readonly definition = {
    id: CODEX_CLI_PROVIDER_ID,
    displayName: 'Codex CLI',
    source: 'local' as const,
  }

  private readonly models: ModelDescriptor[]
  private readonly completionTimeoutMs: number

  constructor(private readonly dependencies: CodexCliProviderDependencies) {
    this.models = dependencies.models.map((model) => {
      if (model.providerId !== CODEX_CLI_PROVIDER_ID || model.source !== 'local') {
        throw new Error('O catálogo Codex CLI contém um modelo de outro Provider.')
      }
      return cloneModel(model)
    })
    this.completionTimeoutMs = dependencies.completionTimeoutMs ?? 5 * 60_000
    if (!Number.isInteger(this.completionTimeoutMs) || this.completionTimeoutMs <= 0) {
      throw new Error('O timeout de conclusão do Codex CLI deve ser positivo.')
    }
  }

  async getAvailability(): Promise<ProviderAvailability> {
    const compatibility = this.dependencies.compatibility()
    if (compatibility === 'unsupported') {
      return {
        status: 'incompatible',
        message: 'A versão instalada do Codex CLI não é compatível.',
      }
    }

    try {
      await this.dependencies.client.start(this.dependencies.executable?.())
    } catch {
      return {
        status: 'offline',
        message: 'Não foi possível iniciar o Codex CLI.',
      }
    }

    if (compatibility === 'minimum-compatible-unverified') {
      return {
        status: 'degraded',
        message: 'A versão instalada atende ao mínimo, mas ainda não foi homologada.',
      }
    }

    return availabilityFromStatus(this.dependencies.client.status)
  }

  listModels(): ModelDescriptor[] {
    return this.models.map(cloneModel)
  }

  async execute(
    request: ProviderExecutionRequest,
    control: ProviderExecutionControl,
  ): Promise<ProviderExecutionResult> {
    if (this.dependencies.compatibility() === 'unsupported') {
      throw providerError(
        'provider-unavailable',
        'A versão instalada do Codex CLI não é compatível.',
        false,
      )
    }
    if (request.model.providerId !== CODEX_CLI_PROVIDER_ID) {
      throw providerError(
        'model-unavailable',
        'O modelo selecionado não pertence ao Provider Codex CLI.',
        false,
      )
    }
    if (request.task.permissions.workspaceAccess !== 'read-only') {
      throw providerError(
        'permission-denied',
        'Execuções Codex com escrita aguardam o contrato normalizado de ferramentas e aprovações.',
        false,
      )
    }
    if (control.signal.aborted) throw cancelledError()

    let workspace: string
    try {
      workspace = await this.dependencies.resolveAuthorizedWorkspaceRoot(
        request.task.workspace.id,
      )
    } catch {
      throw providerError(
        'permission-denied',
        'O Workspace não está autorizado para esta execução.',
        false,
      )
    }
    if (!workspace.trim()) {
      throw providerError(
        'permission-denied',
        'O Workspace não está autorizado para esta execução.',
        false,
      )
    }
    if (control.signal.aborted) throw cancelledError()

    try {
      await this.dependencies.client.start(this.dependencies.executable?.())
      const threadId = await this.dependencies.client.createThread(
        workspace,
        {
          model: request.model.modelId,
          sandbox: 'read-only',
          approvalPolicy: 'on-request',
        },
        '',
        true,
      )
      if (control.signal.aborted) throw cancelledError()

      const completion = this.waitForCompletion(threadId, control)
      void completion.promise.catch(() => undefined)
      try {
        await this.dependencies.client.sendTurn(
          threadId,
          workspace,
          compileCodexPrompt(request.task),
          {
            model: request.model.modelId,
            sandbox: 'read-only',
            approvalPolicy: 'on-request',
          },
          [],
          '',
          request.task.mode,
        )
        if (control.signal.aborted) {
          void this.dependencies.client.interrupt(threadId).catch(() => undefined)
        }
      } catch (error) {
        completion.dispose()
        throw error
      }
      return await completion.promise
    } catch (error) {
      if (error instanceof ProviderExecutionError) throw error
      if (control.signal.aborted) throw cancelledError()
      throw mapCodexError(error)
    }
  }

  private waitForCompletion(
    threadId: string,
    control: ProviderExecutionControl,
  ): {
      promise: Promise<ProviderExecutionResult>
      dispose(): void
    } {
    const client = this.dependencies.client
    let settled = false
    let timer: NodeJS.Timeout | undefined
    let onEvent: (event: CodexEvent) => void = () => undefined
    let onStatus: (event: { status: CodexStatus }) => void = () => undefined
    let onAbort: () => void = () => undefined

    const dispose = () => {
      if (timer) clearTimeout(timer)
      client.off('event', onEvent)
      client.off('status', onStatus)
      control.signal.removeEventListener('abort', onAbort)
    }
    const promise = new Promise<ProviderExecutionResult>((resolve, reject) => {
      const finish = (
        result: ProviderExecutionResult | undefined,
        error?: ProviderExecutionError,
      ) => {
        if (settled) return
        settled = true
        dispose()
        if (error) reject(error)
        else resolve(result ?? { finishReason: 'unknown' })
      }
      onEvent = (event: CodexEvent) => {
        if (String(event.params.threadId ?? '') !== threadId) return
        if (event.method === 'item/agentMessage/delta') {
          const delta = event.params.delta
          if (typeof delta === 'string' && delta.length > 0) {
            control.emit({
              type: 'message.delta',
              messageId: String(event.params.itemId ?? `${threadId}:assistant`),
              delta,
            })
          }
          return
        }
        if (isApprovalEvent(event.method)) {
          const approvalKey = event.params.approvalKey
          if (typeof approvalKey === 'string') {
            void client.resolveApproval(approvalKey, false).catch(() => undefined)
          }
          finish(undefined, providerError(
            'permission-denied',
            'O Codex solicitou uma ação que exige o fluxo normalizado de aprovação.',
            false,
          ))
          return
        }
        if (event.method !== 'turn/completed') return
        const usage = normalizeUsage(event.params)
        if (usage) control.emit({ type: 'usage.updated', usage })
        finish({ finishReason: normalizeFinishReason(event.params) })
      }
      onStatus = (event: { status: CodexStatus }) => {
        if (event.status === 'failed' || event.status === 'disconnected') {
          finish(undefined, providerError(
            'provider-unavailable',
            'A conexão com o Codex CLI foi interrompida.',
            true,
          ))
        }
      }
      onAbort = () => {
        void client.interrupt(threadId).catch(() => undefined)
      }

      client.on('event', onEvent)
      client.on('status', onStatus)
      control.signal.addEventListener('abort', onAbort, { once: true })
      timer = setTimeout(() => {
        finish(undefined, providerError(
          'timeout',
          'O Codex CLI não concluiu a execução no tempo permitido.',
          true,
        ))
      }, this.completionTimeoutMs)
    })

    return {
      promise,
      dispose,
    }
  }
}

export function compileCodexPrompt(task: NormalizedTask): string {
  const sections = [
    '# Solicitação atual',
    task.intent,
    '# Modo de execução',
    task.mode,
    '# Formato esperado',
    task.output.format,
  ]
  if (task.messages.length > 0) {
    sections.push(
      '# Histórico selecionado',
      task.messages
        .map((message) => `${message.role === 'user' ? 'Usuário' : 'Assistente'}:\n${message.content}`)
        .join('\n\n'),
    )
  }
  if (task.context.length > 0) {
    sections.push(
      '# Contexto selecionado pelo Workspace',
      task.context.map((source) => [
        `## ${source.title}`,
        `Tipo: ${source.type}`,
        `Escopo: ${source.scope}`,
        `Potencialmente desatualizado: ${source.potentiallyOutdated ? 'sim' : 'não'}`,
        source.content,
      ].join('\n')).join('\n\n'),
    )
  }
  if (task.constraints.length > 0) {
    sections.push(
      '# Restrições',
      task.constraints.map((constraint) => `- ${constraint}`).join('\n'),
    )
  }
  return sections.join('\n\n')
}

function availabilityFromStatus(status: CodexStatus): ProviderAvailability {
  if (['ready', 'running', 'planning', 'waiting-approval', 'completed'].includes(status)) {
    return { status: 'available' }
  }
  if (status === 'starting' || status === 'cancelling') {
    return { status: 'validating', message: 'O Codex CLI está mudando de estado.' }
  }
  return { status: 'offline', message: 'O Codex CLI não está disponível.' }
}

function normalizeFinishReason(params: Record<string, unknown>): ProviderExecutionResult['finishReason'] {
  const turn = asRecord(params.turn)
  const status = turn?.status ?? params.status
  if (status === 'completed' || status === undefined) return 'stop'
  if (status === 'max_output_tokens' || status === 'length') return 'length'
  return 'unknown'
}

function normalizeUsage(params: Record<string, unknown>) {
  const turn = asRecord(params.turn)
  const usage = asRecord(turn?.usage) ?? asRecord(params.usage)
  if (!usage) return undefined
  const normalized = {
    inputTokens: nonnegativeInteger(usage.inputTokens ?? usage.input_tokens),
    cachedInputTokens: nonnegativeInteger(
      usage.cachedInputTokens ?? usage.cached_input_tokens,
    ),
    outputTokens: nonnegativeInteger(usage.outputTokens ?? usage.output_tokens),
  }
  return Object.values(normalized).some((value) => value !== undefined)
    ? normalized
    : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function nonnegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined
}

function isApprovalEvent(method: string) {
  return method === 'item/commandExecution/requestApproval'
    || method === 'item/fileChange/requestApproval'
}

function mapCodexError(error: unknown): ProviderExecutionError {
  const message = error instanceof Error ? error.message : ''
  if (/tempo esgotado/i.test(message)) {
    return providerError('timeout', 'O Codex CLI excedeu o tempo permitido.', true)
  }
  if (/autentica|login|unauthorized|forbidden/i.test(message)) {
    return providerError(
      'authentication-failed',
      'A autenticação do Codex CLI precisa ser renovada.',
      false,
    )
  }
  return providerError(
    'provider-unavailable',
    'O Codex CLI não conseguiu executar a solicitação.',
    true,
  )
}

function providerError(
  code: NormalizedErrorCode,
  message: string,
  retryable: boolean,
) {
  return new ProviderExecutionError({ code, message, retryable })
}

function cancelledError() {
  return providerError('cancelled', 'A execução foi cancelada.', false)
}

function cloneModel(model: ModelDescriptor): ModelDescriptor {
  return {
    ...model,
    capabilities: [...model.capabilities],
    pricing: model.pricing ? { ...model.pricing } : undefined,
  }
}
