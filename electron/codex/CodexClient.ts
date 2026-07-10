import { EventEmitter } from 'node:events'
import { CodexProcess } from './CodexProcess'
import type { CodexEvent, CodexStatus, RpcId, RpcMessage, RpcResponse } from './protocol'

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: NodeJS.Timeout
}

export class CodexClient extends EventEmitter {
  private process = new CodexProcess()
  private nextId = 1
  private pending = new Map<RpcId, PendingCall>()
  private approvalRequests = new Map<string, RpcId>()
  private starting: Promise<void> | null = null
  private loadedThreads = new Set<string>()
  private activeTurns = new Map<string, string>()
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempt = 0
  private intentionalStop = false
  status: CodexStatus = 'offline'

  constructor() {
    super()
    this.process.on('message', (message) => this.handleMessage(message))
    this.process.on('error', (error) => { this.rejectPending(error); this.setStatus('error', error.message) })
    this.process.on('exit', (code, _signal, intentional: boolean) => {
      this.loadedThreads.clear()
      this.activeTurns.clear()
      this.rejectPending(new Error(`Codex App Server foi encerrado${code === null ? '.' : ` com código ${code}.`}`))
      const message = `Conexão com o Codex perdida${code === null ? '.' : ` (código ${code}).`}`
      this.setStatus(intentional || this.intentionalStop ? 'offline' : 'error', intentional ? undefined : message)
      if (!intentional && !this.intentionalStop) this.scheduleReconnect()
    })
    this.process.on('log', (line) => this.emit('log', line))
  }

  async start() {
    if (this.status === 'ready' || this.status === 'running') return
    if (this.starting) return this.starting
    this.intentionalStop = false
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.starting = this.initialize()
    try { await this.starting }
    catch (error) {
      const reason = error instanceof Error ? error : new Error(String(error))
      this.setStatus('error', `Não foi possível iniciar o Codex: ${reason.message}`)
      throw reason
    } finally { this.starting = null }
  }

  async createThread(workspace: string, settings: Record<string, string> = {}, memory = '') {
    await this.start()
    const result = await this.call('thread/start', {
      cwd: workspace,
      runtimeWorkspaceRoots: [workspace],
      approvalPolicy: settings.approvalPolicy || 'on-request',
      approvalsReviewer: 'user',
      sandbox: settings.sandbox || 'workspace-write',
      model: settings.model || undefined,
      developerInstructions: memory ? workspaceMemoryInstructions(memory) : undefined,
      ephemeral: false,
    }) as { thread: { id: string } }
    this.loadedThreads.add(result.thread.id)
    return result.thread.id
  }

  async resumeThread(threadId: string, workspace: string, settings: Record<string, string> = {}) {
    await this.start()
    if (this.loadedThreads.has(threadId)) return
    await this.call('thread/resume', {
      threadId, cwd: workspace, runtimeWorkspaceRoots: [workspace],
      approvalPolicy: settings.approvalPolicy || 'on-request', approvalsReviewer: 'user',
      sandbox: settings.sandbox || 'workspace-write', model: settings.model || undefined,
    })
    this.loadedThreads.add(threadId)
  }

  async sendTurn(threadId: string, workspace: string, prompt: string, settings: Record<string, string> = {}, attachments: string[] = [], memory = '') {
    if (this.activeTurns.size) throw new Error('Já existe uma execução do agente em andamento. Cancele-a antes de iniciar outra.')
    await this.resumeThread(threadId, workspace, settings)
    this.setStatus('running')
    const result = await this.call('turn/start', {
      threadId,
      cwd: workspace,
      runtimeWorkspaceRoots: [workspace],
      approvalPolicy: settings.approvalPolicy || 'on-request',
      approvalsReviewer: 'user',
      model: settings.model || undefined,
      sandboxPolicy: toSandboxPolicy(settings.sandbox, workspace),
      additionalContext: memory ? { 'nocturne.workspace-memory': { value: workspaceMemoryInstructions(memory), kind: 'application' } } : undefined,
      input: [
        { type: 'text', text: prompt, text_elements: [] },
        ...attachments.map((attachment) => ({ type: 'mention', name: attachment.split(/[\\/]/).pop() || attachment, path: attachment })),
      ],
    }) as { turn: { id: string } }
    this.activeTurns.set(threadId, result.turn.id)
    return result
  }

  async interrupt(threadId: string) {
    const turnId = this.activeTurns.get(threadId)
    if (!turnId) throw new Error('Nenhuma execução ativa para cancelar.')
    await this.call('turn/interrupt', { threadId, turnId })
  }

  async resolveApproval(key: string, accepted: boolean, forSession = false) {
    const id = this.approvalRequests.get(key)
    if (id === undefined) throw new Error('Solicitação de aprovação não encontrada.')
    this.process.send({
      id,
      result: { decision: accepted ? (forSession ? 'acceptForSession' : 'accept') : 'decline' },
    })
    this.approvalRequests.delete(key)
  }

  stop() { this.intentionalStop = true; if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.reconnectTimer = null; this.process.stop() }

  async readConfig() { await this.start(); return this.call('config/read', {}) }

  private async initialize() {
    this.setStatus('starting')
    this.process.start()
    await this.call('initialize', {
      clientInfo: { name: 'nocturne-codex', title: 'Nocturne Codex', version: '0.1.0' },
      capabilities: { experimentalApi: true, requestAttestation: false },
    })
    this.notify('initialized')
    this.reconnectAttempt = 0
    this.setStatus('ready')
  }

  private call(method: string, params?: unknown) {
    const id = this.nextId++
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Tempo esgotado ao chamar ${method}.`))
      }, 30_000)
      this.pending.set(id, { resolve, reject, timer })
      this.process.send({ id, method, params })
    })
  }

  private notify(method: string, params?: unknown) {
    this.process.send({ method, params } as RpcMessage)
  }

  private handleMessage(message: RpcMessage) {
    if ('id' in message && !('method' in message)) {
      const response = message as RpcResponse
      const pending = this.pending.get(response.id)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(response.id)
      response.error ? pending.reject(new Error(response.error.message)) : pending.resolve(response.result)
      return
    }

    if ('method' in message) {
      const params = (message.params ?? {}) as Record<string, unknown>
      if ('id' in message) {
        const itemId = String(params.itemId ?? message.id)
        this.approvalRequests.set(itemId, message.id)
        this.emit('event', { method: message.method, params: { ...params, approvalKey: itemId } } satisfies CodexEvent)
      } else {
        if (message.method === 'turn/completed') {
          const threadId = String(params.threadId ?? '')
          if (threadId) this.activeTurns.delete(threadId)
          this.setStatus('ready')
        }
        this.emit('event', { method: message.method, params } satisfies CodexEvent)
      }
    }
  }

  private setStatus(status: CodexStatus, error?: string) {
    this.status = status
    this.emit('status', { status, error })
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error) }
    this.pending.clear()
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.intentionalStop) return
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempt, 15_000)
    this.reconnectAttempt += 1
    this.emit('status', { status: 'error', error: `Codex desconectado. Nova tentativa em ${Math.ceil(delay / 1000)}s.` })
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.start().catch((error: unknown) => {
        this.setStatus('error', error instanceof Error ? error.message : String(error))
        this.scheduleReconnect()
      })
    }, delay)
  }
}

function toSandboxPolicy(mode: string | undefined, workspace: string) {
  return mode === 'read-only'
    ? { type: 'readOnly', networkAccess: false }
    : { type: 'workspaceWrite', writableRoots: [workspace], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false }
}

function workspaceMemoryInstructions(memory: string) {
  return `Memória persistente deste workspace, fornecida pelo usuário. Use como contexto e preferências do projeto; instruções explícitas da mensagem atual têm prioridade.\n\n${memory}`
}
