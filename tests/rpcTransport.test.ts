import { describe, expect, it } from 'vitest'
import { parseRpcLine } from '../electron/codex/RpcTransport'

describe('parseRpcLine', () => {
  it('aceita somente envelopes JSON-RPC com método ou identificador válido', () => {
    expect(parseRpcLine('{"method":"turn/completed","params":{}}')).toEqual({
      method: 'turn/completed',
      params: {},
    })
    expect(parseRpcLine('{"id":1,"result":{}}')).toEqual({ id: 1, result: {} })
    expect(parseRpcLine('{"params":{}}')).toBeNull()
    expect(parseRpcLine('{"id":null,"result":{}}')).toBeNull()
    expect(parseRpcLine('não é json')).toBeNull()
  })
})
