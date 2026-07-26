import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { CodexClient, type CodexProcessAdapter } from '../electron/codex/CodexClient'
import type { RpcMessage, RpcRequest } from '../electron/codex/protocol'

class FakeCodexProcess extends EventEmitter implements CodexProcessAdapter {
  sent: RpcMessage[] = []
  running = false

  start() {
    this.running = true
  }

  send(message: RpcMessage) {
    if (!this.running) throw new Error('Processo indisponível.')
    this.sent.push(message)
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.emit('exit', 0, null, true)
  }

  isRunning() {
    return this.running
  }

  get pid() {
    return this.running ? 1234 : null
  }

  get path() {
    return 'codex'
  }

  request(method: string) {
    return [...this.sent].reverse().find(
      (message): message is RpcRequest => 'method' in message
        && 'id' in message
        && message.method === method,
    )
  }

  respond(method: string, result: unknown = {}) {
    const request = this.request(method)
    if (!request) throw new Error(`Request ausente: ${method}`)
    this.emit('message', { id: request.id, result })
  }
}

async function waitForRequest(process: FakeCodexProcess, method: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (process.request(method)) return
    await Promise.resolve()
  }
  throw new Error(`Request não enviado: ${method}`)
}

async function readyClient() {
  const process = new FakeCodexProcess()
  const client = new CodexClient(process)
  const started = client.start()
  process.respond('initialize')
  await started
  return { client, process }
}

async function createThread(client: CodexClient, process: FakeCodexProcess) {
  const pending = client.createThread('/workspace')
  await waitForRequest(process, 'thread/start')
  process.respond('thread/start', { thread: { id: 'thread-1' } })
  await pending
}

describe('CodexClient', () => {
  it('inicializa threads efêmeras e mantém Build limitado ao workspace', async () => {
    const { client, process } = await readyClient()
    const created = client.createThread('/workspace')
    await waitForRequest(process, 'thread/start')
    expect(process.request('thread/start')?.params).toMatchObject({
      cwd: '/workspace',
      runtimeWorkspaceRoots: ['/workspace'],
      ephemeral: true,
    })
    process.respond('thread/start', { thread: { id: 'thread-1' } })
    await created

    const turn = client.sendTurn(
      'thread-1',
      '/workspace',
      'Implemente',
      { sandbox: 'workspace-write', approvalPolicy: 'on-request' },
    )
    await waitForRequest(process, 'turn/start')
    expect(process.request('turn/start')?.params).toMatchObject({
      approvalPolicy: 'on-request',
      sandboxPolicy: {
        type: 'workspaceWrite',
        writableRoots: ['/workspace'],
        networkAccess: false,
      },
      additionalContext: {
        'nocturne.agent-mode': {
          value: expect.stringContaining('Build Mode'),
        },
      },
    })
    process.respond('turn/start', { turn: { id: 'turn-1' } })
    await expect(turn).resolves.toBe('turn-1')
  })

  it('força Review para somente leitura independentemente da configuração', async () => {
    const { client, process } = await readyClient()
    await createThread(client, process)
    const turn = client.sendTurn(
      'thread-1',
      '/workspace',
      'Revise',
      { sandbox: 'workspace-write' },
      [],
      '',
      'review',
    )
    await waitForRequest(process, 'turn/start')
    expect(process.request('turn/start')?.params).toMatchObject({
      sandboxPolicy: { type: 'readOnly', networkAccess: false },
    })
    process.respond('turn/start', { turn: { id: 'turn-1' } })
    await turn
  })

  it('encaminha aprovação e cancelamento ao turno ativo', async () => {
    const { client, process } = await readyClient()
    await createThread(client, process)
    const turn = client.sendTurn('thread-1', '/workspace', 'Execute')
    await waitForRequest(process, 'turn/start')
    process.respond('turn/start', { turn: { id: 'turn-1' } })
    await turn

    process.emit('message', {
      id: 88,
      method: 'item/commandExecution/requestApproval',
      params: { itemId: 'approval-1', command: ['npm', 'test'] },
    })
    await client.resolveApproval('approval-1', true, true)
    expect(process.sent[process.sent.length - 1]).toEqual({
      id: 88,
      result: { decision: 'acceptForSession' },
    })

    const interrupted = client.interrupt('thread-1')
    await waitForRequest(process, 'turn/interrupt')
    expect(process.request('turn/interrupt')?.params).toEqual({
      threadId: 'thread-1',
      turnId: 'turn-1',
    })
    process.respond('turn/interrupt')
    await interrupted
  })
})
