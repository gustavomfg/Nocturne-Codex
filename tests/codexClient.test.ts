import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodexClient, type CodexProcessAdapter } from '../electron/codex/CodexClient'
import type { RpcMessage, RpcRequest } from '../electron/codex/protocol'

class FakeCodexProcess extends EventEmitter implements CodexProcessAdapter {
  sent: RpcMessage[] = []
  starts = 0
  stops = 0
  running = false
  executable = 'codex'
  responded = new Set<number | string>()

  start(executable = this.executable) { this.starts += 1; this.running = true; this.executable = executable }
  send(message: RpcMessage) { if (!this.running) throw new Error('Processo indisponível.'); this.sent.push(message) }
  stop() { this.stops += 1; if (!this.running) return; this.running = false; this.emit('exit', 0, null, true) }
  isRunning() { return this.running }
  get pid() { return this.running ? 1234 : null }
  get path() { return this.executable }

  request(method: string) {
    return [...this.sent].reverse().find((message): message is RpcRequest => 'method' in message && 'id' in message && message.method === method)
  }

  pendingRequest(method: string) {
    return [...this.sent].reverse().find((message): message is RpcRequest => 'method' in message && 'id' in message && message.method === method && !this.responded.has(message.id))
  }

  respond(method: string, result: unknown = {}) {
    const request = this.pendingRequest(method)
    if (!request) throw new Error(`Request ausente: ${method}`)
    this.responded.add(request.id)
    this.emit('message', { id: request.id, result })
  }

  fail(method: string, message: string) {
    const request = this.pendingRequest(method)
    if (!request) throw new Error(`Request ausente: ${method}`)
    this.responded.add(request.id)
    this.emit('message', { id: request.id, error: { code: -32_000, message } })
  }

  crash(code = 1) { this.running = false; this.emit('exit', code, null, false) }
}

afterEach(() => vi.useRealTimers())

async function readyClient() {
  const process = new FakeCodexProcess()
  const client = new CodexClient(process)
  const started = client.start('/usr/bin/codex')
  process.respond('initialize', { capabilities: {} })
  await started
  return { client, process }
}

async function waitForRequest(process: FakeCodexProcess, method: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (process.pendingRequest(method)) return
    await Promise.resolve()
  }
  throw new Error(`Request não enviado: ${method}`)
}

async function createThread(client: CodexClient, process: FakeCodexProcess) {
  const created = client.createThread('/workspace')
  await waitForRequest(process, 'thread/start')
  process.respond('thread/start', { thread: { id: 'thread-1' } })
  await expect(created).resolves.toBe('thread-1')
}

async function startTurn(client: CodexClient, process: FakeCodexProcess) {
  const turn = client.sendTurn('thread-1', '/workspace', 'Turno')
  await waitForRequest(process, 'turn/start')
  process.respond('turn/start', { turn: { id: 'turn-1' } })
  await turn
}

describe('CodexClient', () => {
  it('propaga falhas de inicialização e preserva o diagnóstico', async () => {
    const process = new FakeCodexProcess()
    const client = new CodexClient(process)
    const started = client.start()
    process.fail('initialize', 'versão incompatível')
    await expect(started).rejects.toThrow('versão incompatível')
    expect(client.status).toBe('failed')
    expect(client.getDiagnostics().lastFailure).toContain('versão incompatível')
  })

  it('inicializa o protocolo e encaminha erros JSON-RPC', async () => {
    const { client, process } = await readyClient()
    expect(client.status).toBe('ready')
    expect(process.request('initialize')?.params).toMatchObject({ clientInfo: { name: 'nocturne-codex' } })
    expect(process.sent).toContainEqual({ method: 'initialized', params: undefined })

    const config = client.readConfig()
    await Promise.resolve()
    process.fail('config/read', 'configuração inválida')
    await expect(config).rejects.toThrow('configuração inválida')
  })

  it('cria threads efêmeras somente quando solicitado pelo adapter', async () => {
    const { client, process } = await readyClient()
    const created = client.createThread('/workspace', {}, '', true)
    await waitForRequest(process, 'thread/start')
    expect(process.pendingRequest('thread/start')?.params).toMatchObject({
      cwd: '/workspace',
      ephemeral: true,
    })
    process.respond('thread/start', { thread: { id: 'thread-ephemeral' } })
    await expect(created).resolves.toBe('thread-ephemeral')
  })

  it('estabiliza o estado quando thread/start falha ou retorna um contrato inválido', async () => {
    const { client, process } = await readyClient()
    const failed = client.createThread('/workspace')
    await waitForRequest(process, 'thread/start')
    process.fail('thread/start', 'workspace recusado')
    await expect(failed).rejects.toThrow('workspace recusado')
    expect(client.status).toBe('failed')
    expect(client.getDiagnostics().lastFailure).toContain('Falha ao criar thread')

    const restarted = client.restart()
    await waitForRequest(process, 'initialize')
    process.respond('initialize')
    await restarted
    const malformed = client.createThread('/workspace')
    await waitForRequest(process, 'thread/start')
    process.respond('thread/start', { thread: {} })
    await expect(malformed).rejects.toThrow(/identificador válido/)
    expect(client.status).toBe('failed')
  })

  it('expira chamadas pendentes sem deixar respostas tardias interferirem', async () => {
    vi.useFakeTimers()
    const { client, process } = await readyClient()
    const config = client.readConfig()
    await Promise.resolve()
    const request = process.request('config/read')
    const rejection = expect(config).rejects.toThrow(/Tempo esgotado.*config\/read/)
    await vi.advanceTimersByTimeAsync(30_000)
    await rejection
    process.emit('message', { id: request?.id ?? -1, result: { late: true } })
    expect(client.status).toBe('ready')
  })

  it('recusa requests desconhecidos e resolve aprovações pela chave correta', async () => {
    const { client, process } = await readyClient()
    process.emit('message', { id: 77, method: 'server/unknown', params: {} })
    expect(process.sent[process.sent.length - 1]).toEqual({ id: 77, error: { code: -32601, message: 'Método do servidor não suportado: server/unknown' } })

    await createThread(client, process)
    await startTurn(client, process)
    process.emit('message', { id: 88, method: 'item/commandExecution/requestApproval', params: { itemId: 'approval-1', command: ['npm', 'test'] } })
    expect(client.status).toBe('waiting-approval')
    await client.resolveApproval('approval-1', true, true)
    expect(process.sent[process.sent.length - 1]).toEqual({ id: 88, result: { decision: 'acceptForSession' } })
    expect(client.status).toBe('running')
    await expect(client.resolveApproval('approval-1', true)).rejects.toThrow(/não encontrada/)

    process.emit('message', { id: 89, method: 'item/fileChange/requestApproval', params: { itemId: 'approval-2' } })
    await client.resolveApproval('approval-2', false)
    expect(process.sent[process.sent.length - 1]).toEqual({ id: 89, result: { decision: 'decline' } })
    expect(client.status).toBe('failed')
  })

  it('impede turnos concorrentes, interrompe e limpa o turno concluído', async () => {
    const { client, process } = await readyClient()
    await createThread(client, process)
    const firstTurn = client.sendTurn('thread-1', '/workspace', 'Primeiro turno')
    await waitForRequest(process, 'turn/start')
    process.respond('turn/start', { turn: { id: 'turn-1' } })
    await expect(firstTurn).resolves.toMatchObject({ turn: { id: 'turn-1' } })
    await expect(client.sendTurn('thread-1', '/workspace', 'Concorrente')).rejects.toThrow(/execução.*andamento/)

    const interrupted = client.interrupt('thread-1')
    await Promise.resolve()
    process.respond('turn/interrupt')
    await expect(interrupted).resolves.toBeUndefined()
    process.emit('message', { method: 'turn/completed', params: { threadId: 'thread-1' } })
    expect(client.status).toBe('ready')

    const nextTurn = client.sendTurn('thread-1', '/workspace', 'Novo turno')
    await waitForRequest(process, 'turn/start')
    process.respond('turn/start', { turn: { id: 'turn-2' } })
    await expect(nextTurn).resolves.toMatchObject({ turn: { id: 'turn-2' } })
  })

  it('estabiliza o estado quando turn/start falha', async () => {
    const { client, process } = await readyClient()
    await createThread(client, process)
    const turn = client.sendTurn('thread-1', '/workspace', 'Falhar')
    await waitForRequest(process, 'turn/start')
    process.fail('turn/start', 'turno recusado')
    await expect(turn).rejects.toThrow('turno recusado')
    expect(client.status).toBe('failed')
    expect(client.getDiagnostics().lastFailure).toContain('Falha ao iniciar turno')
  })

  it('sobrescreve as restrições de Review ao trocar para Build na mesma thread', async () => {
    const { client, process } = await readyClient()
    await createThread(client, process)

    const reviewTurn = client.sendTurn('thread-1', '/workspace', 'Revise o projeto', { sandbox: 'workspace-write' }, [], '', 'review')
    await waitForRequest(process, 'turn/start')
    const reviewRequest = process.pendingRequest('turn/start')
    expect(reviewRequest?.params).toMatchObject({
      sandboxPolicy: { type: 'readOnly' },
      additionalContext: { 'nocturne.review-mode': { value: expect.stringContaining('Review Mode') } },
    })
    process.respond('turn/start', { turn: { id: 'turn-review' } })
    await reviewTurn
    process.emit('message', { method: 'turn/completed', params: { threadId: 'thread-1' } })

    const buildTurn = client.sendTurn('thread-1', '/workspace', 'Aplique a alteração', { sandbox: 'workspace-write' }, [], '', 'build')
    await waitForRequest(process, 'turn/start')
    const buildRequest = process.pendingRequest('turn/start')
    expect(buildRequest?.params).toMatchObject({
      sandboxPolicy: { type: 'workspaceWrite' },
      additionalContext: { 'nocturne.review-mode': { value: expect.stringContaining('Restrições de Review Mode de turnos anteriores estão desativadas') } },
    })
    expect(JSON.stringify(buildRequest?.params)).toContain('Implemente a alteração solicitada')
    process.respond('turn/start', { turn: { id: 'turn-build' } })
    await buildTurn
  })

  it('mantém Docs como instrução de escopo dentro do sandbox configurado', async () => {
    const { client, process } = await readyClient()
    await createThread(client, process)
    const docsTurn = client.sendTurn('thread-1', '/workspace', 'Atualize o README', { sandbox: 'workspace-write' }, [], '', 'docs')
    await waitForRequest(process, 'turn/start')
    const request = process.pendingRequest('turn/start')
    expect(request?.params).toMatchObject({
      sandboxPolicy: { type: 'workspaceWrite', writableRoots: ['/workspace'] },
      additionalContext: { 'nocturne.review-mode': { value: expect.stringContaining('somente documentação diretamente relacionada') } },
    })
    process.respond('turn/start', { turn: { id: 'turn-docs' } })
    await docsTurn
  })

  it('rejeita pendências na queda e reconecta com backoff', async () => {
    vi.useFakeTimers()
    const { client, process } = await readyClient()
    const config = client.readConfig()
    await Promise.resolve()
    process.crash()
    await expect(config).rejects.toThrow(/encerrado.*código 1/)
    expect(client.status).toBe('failed')

    await vi.advanceTimersByTimeAsync(1_000)
    expect(process.starts).toBe(2)
    process.respond('initialize')
    await vi.advanceTimersByTimeAsync(0)
    expect(client.status).toBe('ready')
  })

  it('não reconecta depois de uma parada intencional', async () => {
    vi.useFakeTimers()
    const { client, process } = await readyClient()
    client.stop()
    expect(client.status).toBe('disconnected')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(process.starts).toBe(1)
    expect(process.stops).toBe(1)
  })
})
