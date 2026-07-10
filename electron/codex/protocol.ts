export type RpcId = number | string

export interface RpcRequest {
  id: RpcId
  method: string
  params?: unknown
}

export interface RpcResponse {
  id: RpcId
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export interface RpcNotification {
  method: string
  params?: Record<string, unknown>
}

export type RpcMessage = RpcRequest | RpcResponse | RpcNotification

export type CodexStatus = 'offline' | 'starting' | 'ready' | 'running' | 'error'

export interface CodexEvent {
  method: string
  params: Record<string, unknown>
}
