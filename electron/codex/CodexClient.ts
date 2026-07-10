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
  status: CodexStatus = 'offline'

  constructor() {
    super()
    this.process.on('message', (message) => this.handleMessage(message))
    this.process.on('error', (error) => this.setStatus('error', error.message))
    this.process.on('exit', () => this.setStatus('offline'))
    this.process.on('log', (line) => this.emit('log', line))
  }

  async start() {
    if (this.status === 'ready' || this.status === 'running') return
    if (this.starting) return this.starting
    this.starting = this.initialize()
    try { await this.starting } finally { this.starting = null }
  }

  async createThread(workspace: string) {
    await this.start()
    const result = await this.call('thread/start', {
      cwd: workspace,
      runtimeWorkspaceRoots: [workspace],
      approvalPolicy: 'on-request',
      approvalsReviewer: 'user',
      sandbox: 'workspace-write',
      ephemeral: false,
    }) as { thread: { id: string } }
    return result.thread.id
  }

  async sendTurn(threadId: string, workspace: string, prompt: string) {
    this.setStatus('running')
    return this.call('turn/start', {
      threadId,
      cwd: workspace,
      runtimeWorkspaceRoots: [workspace],
      approvalPolicy: 'on-request',
      approvalsReviewer: 'user',
      input: [{ type: 'text', text: prompt, text_elements: [] }],
    })
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
        if (message.method === 'turn/completed') this.setStatus('ready')
        this.emit('event', { method: message.method, params } satisfies CodexEvent)
      }
    }
  }

  private setStatus(status: CodexStatus, error?: string) {
    this.status = status
    this.emit('status', { status, error })
  }
}
