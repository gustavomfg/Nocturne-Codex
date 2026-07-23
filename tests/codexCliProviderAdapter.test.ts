import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  CODEX_CLI_PROVIDER_ID,
  CodexCliProviderAdapter,
  compileCodexPrompt,
  type CodexClientPort,
  type CodexCompatibilityStatus,
} from '../electron/ai/providers/codex/CodexCliProviderAdapter'
import { ProviderExecutionError } from '../electron/ai/ProviderExecutionError'
import type { CodexStatus } from '../electron/codex/protocol'
import type { ModelDescriptor } from '../shared/ai/model'
import type { ProviderExecutionRequest } from '../shared/ai/providerExecution'
import type { NormalizedTask } from '../shared/ai/task'

const model: ModelDescriptor = {
  providerId: CODEX_CLI_PROVIDER_ID,
  modelId: 'gpt-example',
  displayName: 'Codex Example',
  source: 'local',
  capabilities: ['chat', 'streaming'],
  availability: 'available',
}

function task(overrides: Partial<NormalizedTask> = {}): NormalizedTask {
  return {
    id: '6bbdf9e7-7b6e-4858-927e-df8e234dd789',
    createdAt: '2026-07-23T12:00:00.000Z',
    workspace: { id: 'workspace-1', name: 'Nocturne' },
    intent: 'Revise a arquitetura.',
    mode: 'review',
    messages: [{ role: 'user', content: 'Considere os limites atuais.' }],
    context: [{
      id: 'adr-1',
      type: 'memory',
      title: 'Workspace First',
      content: 'O Workspace é o produto.',
      scope: 'workspace',
      potentiallyOutdated: true,
    }],
    constraints: ['Não modifique arquivos.'],
    requirements: ['chat', 'streaming'],
    selection: { type: 'explicit', model: {
      providerId: CODEX_CLI_PROVIDER_ID,
      modelId: model.modelId,
    } },
    output: { format: 'markdown' },
    permissions: { workspaceAccess: 'read-only' },
    tools: [],
    ...overrides,
  }
}

function request(taskValue = task()): ProviderExecutionRequest {
  return {
    executionId: 'execution-1',
    task: taskValue,
    model,
  }
}

class FakeCodexClient extends EventEmitter implements CodexClientPort {
  status: CodexStatus = 'disconnected'
  starts: Array<string | undefined> = []
  threads: Array<{
    workspace: string
    settings: Record<string, string>
    memory: string
    ephemeral: boolean
  }> = []
  turns: Array<{
    threadId: string
    workspace: string
    prompt: string
    settings: Record<string, string>
    mode: NormalizedTask['mode']
  }> = []
  interruptions: string[] = []
  approvals: Array<{ key: string; accepted: boolean }> = []
  startError?: Error
  turnError?: Error

  async start(executable?: string) {
    this.starts.push(executable)
    if (this.startError) throw this.startError
    this.status = 'ready'
  }

  async createThread(
    workspace: string,
    settings: Record<string, string> = {},
    memory = '',
    ephemeral = false,
  ) {
    this.threads.push({ workspace, settings, memory, ephemeral })
    return 'thread-1'
  }

  async sendTurn(
    threadId: string,
    workspace: string,
    prompt: string,
    settings: Record<string, string> = {},
    _attachments: string[] = [],
    _memory = '',
    mode: NormalizedTask['mode'] = 'build',
  ) {
    void _attachments
    void _memory
    if (this.turnError) throw this.turnError
    this.turns.push({ threadId, workspace, prompt, settings, mode })
  }

  async interrupt(threadId: string) {
    this.interruptions.push(threadId)
  }

  async resolveApproval(key: string, accepted: boolean) {
    this.approvals.push({ key, accepted })
  }
}

function setup(options: {
  compatibility?: CodexCompatibilityStatus
  client?: FakeCodexClient
  resolveWorkspace?: (workspaceId: string) => string | Promise<string>
} = {}) {
  const client = options.client ?? new FakeCodexClient()
  let compatibility = options.compatibility ?? 'verified'
  const adapter = new CodexCliProviderAdapter({
    client,
    models: [model],
    compatibility: () => compatibility,
    resolveAuthorizedWorkspaceRoot: options.resolveWorkspace ?? (() => '/workspace'),
    executable: () => '/usr/bin/codex',
    completionTimeoutMs: 1_000,
  })
  return {
    adapter,
    client,
    setCompatibility(value: CodexCompatibilityStatus) {
      compatibility = value
    },
  }
}

async function waitForTurn(client: FakeCodexClient) {
  for (let attempt = 0; attempt < 10 && client.turns.length === 0; attempt += 1) {
    await Promise.resolve()
  }
  expect(client.turns).toHaveLength(1)
}

describe('CodexCliProviderAdapter', () => {
  it('distingue incompatibilidade, versão mínima não homologada e versão verificada', async () => {
    const { adapter, client, setCompatibility } = setup({ compatibility: 'unsupported' })

    await expect(adapter.getAvailability()).resolves.toMatchObject({
      status: 'incompatible',
    })
    expect(client.starts).toHaveLength(0)

    setCompatibility('minimum-compatible-unverified')
    await expect(adapter.getAvailability()).resolves.toMatchObject({
      status: 'degraded',
    })

    setCompatibility('verified')
    await expect(adapter.getAvailability()).resolves.toEqual({
      status: 'available',
    })
  })

  it('compila contexto normalizado e traduz streaming e uso sem expor JSON-RPC', async () => {
    const { adapter, client } = setup()
    const emitted: unknown[] = []
    const execution = adapter.execute(request(), {
      signal: new AbortController().signal,
      emit: (event) => emitted.push(event),
    })
    await waitForTurn(client)

    expect(client.threads[0]).toMatchObject({
      workspace: '/workspace',
      ephemeral: true,
      settings: { model: model.modelId, sandbox: 'read-only' },
    })
    expect(client.turns[0]).toMatchObject({
      workspace: '/workspace',
      mode: 'review',
      prompt: expect.stringContaining('O Workspace é o produto.'),
    })

    client.emit('event', {
      method: 'item/agentMessage/delta',
      params: { threadId: 'other-thread', delta: 'ignorado' },
    })
    client.emit('event', {
      method: 'item/agentMessage/delta',
      params: {
        threadId: 'thread-1',
        itemId: 'message-1',
        delta: 'Resposta',
        nativeSecret: 'não deve atravessar',
      },
    })
    client.emit('event', {
      method: 'turn/completed',
      params: {
        threadId: 'thread-1',
        turn: {
          status: 'completed',
          usage: { input_tokens: 20, cached_input_tokens: 5, output_tokens: 3 },
        },
      },
    })

    await expect(execution).resolves.toEqual({ finishReason: 'stop' })
    expect(emitted).toEqual([
      { type: 'message.delta', messageId: 'message-1', delta: 'Resposta' },
      {
        type: 'usage.updated',
        usage: { inputTokens: 20, cachedInputTokens: 5, outputTokens: 3 },
      },
    ])
    expect(JSON.stringify(emitted)).not.toContain('nativeSecret')
  })

  it('exige um Workspace autorizado e bloqueia escrita sem aprovação normalizada', async () => {
    const unauthorized = setup({
      resolveWorkspace: () => {
        throw new Error('/fora/do/workspace')
      },
    })
    await expect(unauthorized.adapter.execute(request(), {
      signal: new AbortController().signal,
      emit: vi.fn(),
    })).rejects.toMatchObject({
      normalized: { code: 'permission-denied' },
    })
    expect(unauthorized.client.threads).toHaveLength(0)

    const writable = setup()
    await expect(writable.adapter.execute(request(task({
      mode: 'build',
      permissions: { workspaceAccess: 'workspace-write' },
    })), {
      signal: new AbortController().signal,
      emit: vi.fn(),
    })).rejects.toMatchObject({
      normalized: { code: 'permission-denied' },
    })
    expect(writable.client.threads).toHaveLength(0)
  })

  it('recusa aprovações nativas até existir o contrato normalizado', async () => {
    const { adapter, client } = setup()
    const execution = adapter.execute(request(), {
      signal: new AbortController().signal,
      emit: vi.fn(),
    })
    await waitForTurn(client)
    client.emit('event', {
      method: 'item/commandExecution/requestApproval',
      params: {
        threadId: 'thread-1',
        approvalKey: 'approval-1',
        command: ['printenv', 'TOKEN'],
      },
    })

    await expect(execution).rejects.toMatchObject({
      normalized: {
        code: 'permission-denied',
        message: expect.not.stringContaining('TOKEN'),
      },
    })
    await Promise.resolve()
    expect(client.approvals).toEqual([{ key: 'approval-1', accepted: false }])
  })

  it('interrompe o turno correto e remove listeners após a conclusão', async () => {
    const { adapter, client } = setup()
    const controller = new AbortController()
    const execution = adapter.execute(request(), {
      signal: controller.signal,
      emit: vi.fn(),
    })
    await waitForTurn(client)
    controller.abort()
    await Promise.resolve()
    expect(client.interruptions).toEqual(['thread-1'])

    client.emit('event', {
      method: 'turn/completed',
      params: { threadId: 'thread-1', turn: { status: 'interrupted' } },
    })
    await expect(execution).resolves.toEqual({ finishReason: 'unknown' })
    expect(client.listenerCount('event')).toBe(0)
    expect(client.listenerCount('status')).toBe(0)
  })

  it('repete a interrupção se o cancelamento ocorrer durante turn/start', async () => {
    const client = new FakeCodexClient()
    let releaseTurn: (() => void) | undefined
    let sendTurnEntered = false
    const turnStarted = new Promise<void>((resolve) => {
      releaseTurn = resolve
    })
    const originalSendTurn = client.sendTurn.bind(client)
    client.sendTurn = async (...args) => {
      sendTurnEntered = true
      await turnStarted
      return originalSendTurn(...args)
    }
    const { adapter } = setup({ client })
    const controller = new AbortController()
    const execution = adapter.execute(request(), {
      signal: controller.signal,
      emit: vi.fn(),
    })
    void execution.catch(() => undefined)
    for (let attempt = 0; attempt < 10 && !sendTurnEntered; attempt += 1) {
      await Promise.resolve()
    }
    expect(sendTurnEntered).toBe(true)

    controller.abort()
    await Promise.resolve()
    releaseTurn?.()
    await waitForTurn(client)
    for (let attempt = 0; attempt < 10 && client.interruptions.length < 2; attempt += 1) {
      await Promise.resolve()
    }
    expect(client.interruptions).toEqual(['thread-1', 'thread-1'])

    client.emit('event', {
      method: 'turn/completed',
      params: { threadId: 'thread-1', turn: { status: 'interrupted' } },
    })
    await expect(execution).resolves.toEqual({ finishReason: 'unknown' })
  })

  it('sanitiza falhas nativas antes de atravessar a fronteira do Provider', async () => {
    const client = new FakeCodexClient()
    client.turnError = new Error('unauthorized Bearer segredo-super-secreto')
    const { adapter } = setup({ client })

    await expect(adapter.execute(request(), {
      signal: new AbortController().signal,
      emit: vi.fn(),
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ProviderExecutionError)
      const normalized = (error as ProviderExecutionError).normalized
      expect(normalized).toEqual({
        code: 'authentication-failed',
        message: 'A autenticação do Codex CLI precisa ser renovada.',
        retryable: false,
      })
      expect(JSON.stringify(normalized)).not.toContain('segredo-super-secreto')
      return true
    })
  })

  it('produz um prompt determinístico sem conceitos nativos do Provider', () => {
    const prompt = compileCodexPrompt(task())
    expect(prompt).toContain('# Solicitação atual\n\nRevise a arquitetura.')
    expect(prompt).toContain('Potencialmente desatualizado: sim')
    expect(prompt).toContain('- Não modifique arquivos.')
    expect(prompt).not.toContain('thread/start')
  })
})
