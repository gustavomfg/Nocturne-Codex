import { EventEmitter } from 'node:events'
import type { RpcId, RpcMessage, RpcResponse } from './protocol'

export function parseRpcLine(line: string): RpcMessage | null {
  try {
    const value = JSON.parse(line) as unknown
    if (!value || typeof value !== 'object') return null
    const message = value as Record<string, unknown>
    if (!('method' in message) && !('id' in message)) return null
    return value as RpcMessage
  } catch { return null }
}

export class SimulatedAppServerTransport extends EventEmitter {
  private nextThread = 1
  async request(method: string, params: Record<string, unknown> = {}) {
    const id: RpcId = Math.random().toString(36).slice(2)
    if (method === 'thread/start') return { id, result: { thread: { id: `thread-${this.nextThread++}` } } } satisfies RpcResponse
    if (method === 'turn/start') {
      const threadId = String(params.threadId)
      queueMicrotask(() => {
        this.emit('message', { method: 'item/agentMessage/delta', params: { threadId, delta: 'Resposta simulada' } })
        this.emit('message', { method: 'turn/completed', params: { threadId } })
      })
      return { id, result: { turn: { id: `turn-${Date.now()}` } } } satisfies RpcResponse
    }
    return { id, result: {} } satisfies RpcResponse
  }
}
