import type { RpcMessage } from './protocol'

const MAX_RPC_LINE_BYTES = 5_000_000

export function parseRpcLine(line: string): RpcMessage | null {
  try {
    if (!line || Buffer.byteLength(line, 'utf8') > MAX_RPC_LINE_BYTES) return null
    const value = JSON.parse(line) as unknown
    if (!value || typeof value !== 'object') return null
    const message = value as Record<string, unknown>
    const hasMethod = typeof message.method === 'string' && message.method.length > 0
    const hasId = typeof message.id === 'string'
      || (typeof message.id === 'number' && Number.isFinite(message.id))
    if (!hasMethod && !hasId) return null
    if ('method' in message && !hasMethod) return null
    if ('id' in message && !hasId) return null
    if ('error' in message) {
      const error = message.error
      if (!error || typeof error !== 'object') return null
      const detail = error as Record<string, unknown>
      if (typeof detail.code !== 'number' || typeof detail.message !== 'string') return null
    }
    if (
      'params' in message
      && message.params !== undefined
      && (message.params === null || typeof message.params !== 'object')
    ) return null
    return value as RpcMessage
  } catch {
    return null
  }
}
