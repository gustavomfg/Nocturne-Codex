import { describe, expect, it, vi } from 'vitest'
import { AIOrchestrator } from '../electron/ai/AIOrchestrator'
import { ModelRegistry } from '../electron/ai/ModelRegistry'
import { ModelResolver } from '../electron/ai/ModelResolver'
import { ProviderRegistry, type ProviderAdapter } from '../electron/ai/ProviderRegistry'
import { TaskBuilder } from '../electron/ai/TaskBuilder'
import type { WorkspaceModelBindings } from '../shared/ai/bindings'
import type { NormalizedExecutionEvent } from '../shared/ai/execution'
import type { ModelDescriptor } from '../shared/ai/model'
import { FakeProviderAdapter } from './helpers/FakeProviderAdapter'

const descriptor: ModelDescriptor = {
  providerId: 'fake',
  modelId: 'model',
  displayName: 'Fake Model',
  source: 'local',
  capabilities: ['chat', 'streaming'],
  availability: 'available',
}

const bindings: WorkspaceModelBindings = {
  workspaceId: 'workspace-1',
  defaultBinding: { providerId: 'fake', modelId: 'model' },
  roleBindings: {},
  fallbackPolicy: 'disabled',
  fallbackBindings: [],
}

function task() {
  return new TaskBuilder().build({
    workspace: { id: 'workspace-1', name: 'Workspace' },
    intent: 'Explique o projeto.',
    mode: 'review',
    messages: [],
    context: [],
    constraints: [],
    requirements: ['chat', 'streaming'],
    selection: { type: 'workspace-default' },
    output: { format: 'markdown' },
    permissions: { workspaceAccess: 'read-only' },
    tools: [],
  })
}

function setup(adapter: ProviderAdapter) {
  const models = new ModelRegistry()
  const providers = new ProviderRegistry()
  models.register(descriptor)
  providers.register(adapter)
  return new AIOrchestrator(
    new ModelResolver(models, providers),
    providers,
    () => '5f79f691-dc24-441c-a475-cbb1e09fb8af',
    () => new Date('2026-07-23T12:00:00.000Z'),
  )
}

describe('AIOrchestrator', () => {
  it('executa streaming normalizado e conclui uma única vez', async () => {
    const adapter = new FakeProviderAdapter([descriptor], {
      events: [
        { type: 'message.delta', messageId: 'message-1', delta: 'Olá' },
        { type: 'usage.updated', usage: { inputTokens: 10, outputTokens: 2 } },
      ],
      finishReason: 'stop',
    })
    const events: NormalizedExecutionEvent[] = []
    const handle = await setup(adapter).start(task(), bindings, (event) => events.push(event))

    await expect(handle.completion).resolves.toMatchObject({
      status: 'completed',
      finishReason: 'stop',
    })
    expect(events.map(({ type }) => type)).toEqual([
      'execution.started',
      'message.delta',
      'usage.updated',
      'execution.completed',
    ])
    expect(events.map(({ sequence }) => sequence)).toEqual([0, 1, 2, 3])
    expect(adapter.requests).toHaveLength(1)
  })

  it('preserva falha normalizada sem expor exceção nativa', async () => {
    const adapter = new FakeProviderAdapter([descriptor], {
      error: {
        code: 'rate-limited',
        message: 'Limite temporário.',
        retryable: true,
        retryAfterMs: 500,
      },
    })
    const events: NormalizedExecutionEvent[] = []
    const handle = await setup(adapter).start(task(), bindings, (event) => events.push(event))

    await expect(handle.completion).resolves.toMatchObject({
      status: 'failed',
      error: { code: 'rate-limited', retryable: true },
    })
    expect(events[events.length - 1]).toMatchObject({
      type: 'execution.failed',
      error: { message: 'Limite temporário.' },
    })
  })

  it('propaga cancelamento, encerra uma vez e torna cancel repetido inofensivo', async () => {
    const adapter = new FakeProviderAdapter([descriptor], { waitForCancellation: true })
    const events: NormalizedExecutionEvent[] = []
    const handle = await setup(adapter).start(task(), bindings, (event) => events.push(event))

    expect(handle.cancel('Interrompido no Workspace.')).toBe(true)
    expect(handle.cancel()).toBe(false)
    await expect(handle.completion).resolves.toMatchObject({ status: 'cancelled' })
    expect(events[events.length - 1]).toMatchObject({
      type: 'execution.cancelled',
      reason: 'Interrompido no Workspace.',
    })
    expect(events.filter(({ type }) => [
      'execution.completed',
      'execution.failed',
      'execution.cancelled',
    ].includes(type))).toHaveLength(1)
    expect(handle.cancel()).toBe(false)
  })

  it('converte payload ou resultado inválido em falha segura', async () => {
    const invalidAdapter: ProviderAdapter = {
      definition: { id: 'fake', displayName: 'Invalid', source: 'local' },
      getAvailability: () => ({ status: 'available' }),
      listModels: () => [descriptor],
      execute: (_request, control) => {
        control.emit({
          type: 'message.delta',
          messageId: 'message-1',
          delta: 'válido',
          nativePayload: { authorization: 'Bearer secret' },
        } as never)
        return { finishReason: 'stop' }
      },
    }
    const events: NormalizedExecutionEvent[] = []
    const handle = await setup(invalidAdapter).start(task(), bindings, (event) => events.push(event))

    await expect(handle.completion).resolves.toMatchObject({
      status: 'failed',
      error: {
        code: 'invalid-response',
        message: 'O Provider retornou uma resposta inválida.',
      },
    })
    expect(JSON.stringify(events)).not.toContain('secret')
  })

  it('não inicia adapter quando a resolução do modelo falha', async () => {
    const adapter = new FakeProviderAdapter([descriptor])
    const execute = vi.spyOn(adapter, 'execute')
    const invalidBindings = {
      ...bindings,
      defaultBinding: { providerId: 'missing', modelId: 'missing' },
    }

    await expect(setup(adapter).start(task(), invalidBindings)).rejects.toMatchObject({
      code: 'model-unavailable',
    })
    expect(execute).not.toHaveBeenCalled()
  })
})
