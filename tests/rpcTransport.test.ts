import { describe, expect, it, vi } from 'vitest'
import { parseRpcLine, SimulatedAppServerTransport } from '../electron/codex/RpcTransport'

describe('transporte JSON-RPC', () => {
  it('parseia mensagens válidas e rejeita lixo', () => {
    expect(parseRpcLine('{"id":7,"result":{"ok":true}}')).toMatchObject({ id: 7 })
    expect(parseRpcLine('{"method":"turn/completed","params":{}}')).toMatchObject({ method: 'turn/completed' })
    expect(parseRpcLine('not-json')).toBeNull()
    expect(parseRpcLine('{"id":{},"result":true}')).toBeNull()
    expect(parseRpcLine('{"method":"","params":{}}')).toBeNull()
    expect(parseRpcLine('{"id":1,"error":{"message":"sem código"}}')).toBeNull()
    expect(parseRpcLine(`{"method":"event","params":{},"padding":"${'x'.repeat(5_000_000)}"}`)).toBeNull()
  })
  it('associa resposta ao request e emite streaming/conclusão', async () => {
    const transport = new SimulatedAppServerTransport(); const listener = vi.fn(); transport.on('message', listener)
    const thread = await transport.request('thread/start')
    const threadId = String((thread.result as { thread: { id: string } }).thread.id)
    await transport.request('turn/start', { threadId }); await Promise.resolve()
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ method: 'item/agentMessage/delta' }))
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ method: 'turn/completed' }))
  })
})
