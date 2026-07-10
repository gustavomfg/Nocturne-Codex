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
  status: CodexStatus = 'offline'

  constructor() {
    super()
    this.process.on('message', (message) => this.handleMessage(message))
    this.process.on('error', (error) => { this.rejectPending(error); this.setStatus('error', error.message) })
    this.process.on('exit', (code) => {
      this.loadedThreads.clear()
      this.activeTurns.clear()
      this.rejectPending(new Error(`Codex App Server foi encerrado${code === null ? '.' : ` com código ${code}.`}`))
      this.setStatus(code === 0 ? 'offline' : 'error', code === 0 ? undefined : `Codex App Server foi encerrado com código ${code}.`)
    })
    this.process.on('log', (line) => this.emit('log', line))
  }

  async start() {
    if (this.status === 'ready' || this.status === 'running') return
    if (this.starting) return this.starting
    this.starting = this.initialize()
    try { await this.starting } finally { this.starting = null }
  }

  async createThread(workspace: string, settings: Record<string, string> = {}) {
    await this.start()
    const result = await this.call('thread/start', {
      cwd: workspace,
      runtimeWorkspaceRoots: [workspace],
      approvalPolicy: settings.approvalPolicy || 'on-request',
      approvalsReviewer: 'user',
      sandbox: settings.sandbox || 'workspace-write',
      model: settings.model || undefined,
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

  async sendTurn(threadId: string, workspace: string, prompt: string, settings: Record<string, string> = {}, attachments: string[] = []) {
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

  stop() { this.process.stop() }

  async readConfig() { await this.start(); return this.call('config/read', {}) }

  private async initialize() {
    this.setStatus('starting')
    this.process.start()
    await this.call('initialize', {
      clientInfo: { name: 'nocturne-codex', title: 'Nocturne Codex', version: '0.1.0' },
      capabilities: { experimentalApi: true, requestAttestation: false },
    })
    this.notify('initialized')
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
}

function toSandboxPolicy(mode: string | undefined, workspace: string) {
  return mode === 'read-only'
    ? { type: 'readOnly', networkAccess: false }
    : { type: 'workspaceWrite', writableRoots: [workspace], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false }
}
