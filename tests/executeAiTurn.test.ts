import { describe, expect, it } from 'vitest'
import { startAiTurn } from '../electron/ai/executeAiTurn'
import { ModelRegistry } from '../electron/ai/ModelRegistry'
import { ProviderRegistry } from '../electron/ai/ProviderRegistry'
import type { WorkspaceModelBindings } from '../shared/ai/bindings'
import type { NormalizedTaskInput } from '../shared/ai/task'
import type { ModelDescriptor } from '../shared/ai/model'
import { FakeProviderAdapter } from './helpers/FakeProviderAdapter'

const descriptor: ModelDescriptor = {
  providerId: 'fake', modelId: 'model', displayName: 'Fake Model', source: 'local',
  capabilities: ['chat', 'streaming'], availability: 'available',
}
const bindings: WorkspaceModelBindings = { workspaceId: 'workspace-1', defaultBinding: { providerId: 'fake', modelId: 'model' } }
const task: NormalizedTaskInput = {
  workspace: { id: 'workspace-1', name: 'Workspace' }, intent: 'Analise.', mode: 'review',
  messages: [], context: [], constraints: [], requirements: ['chat', 'streaming'],
  selection: { type: 'workspace-default' }, output: { format: 'markdown' },
  permissions: { workspaceAccess: 'read-only' }, tools: [],
}

function setup(adapter: FakeProviderAdapter) {
  const models = new ModelRegistry(); models.register(descriptor)
  const providers = new ProviderRegistry(); providers.register(adapter)
  return { models, providers }
}

describe('startAiTurn', () => {
  it('preserva o resultado terminal de falha', async () => {
    const dependencies = setup(new FakeProviderAdapter([descriptor], { error: { code: 'rate-limited', message: 'Limite temporário.', retryable: true } }))
    const events: Array<{ method: string; params: Record<string, unknown> }> = []
    const turn = await startAiTurn(dependencies.models, dependencies.providers, task, bindings, (method, params) => events.push({ method, params }))
    await expect(turn.completion).resolves.toMatchObject({ status: 'failed' })
    expect(events[events.length - 1]).toMatchObject({ method: 'turn/completed', params: { turn: { status: 'failed', error: { message: 'Limite temporário.' } } } })
  })

  it('preserva o resultado terminal de cancelamento', async () => {
    const dependencies = setup(new FakeProviderAdapter([descriptor], { waitForCancellation: true }))
    const events: Array<{ method: string; params: Record<string, unknown> }> = []
    const turn = await startAiTurn(dependencies.models, dependencies.providers, task, bindings, (method, params) => events.push({ method, params }))
    expect(turn.cancel()).toBe(true)
    await expect(turn.completion).resolves.toMatchObject({ status: 'cancelled' })
    expect(events[events.length - 1]).toMatchObject({ method: 'turn/completed', params: { turn: { status: 'cancelled' } } })
  })
})
