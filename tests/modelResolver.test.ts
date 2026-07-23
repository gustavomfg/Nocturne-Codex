import { describe, expect, it, vi } from 'vitest'
import { ModelRegistry } from '../electron/ai/ModelRegistry'
import { ModelResolver } from '../electron/ai/ModelResolver'
import { ProviderRegistry, type ProviderAdapter } from '../electron/ai/ProviderRegistry'
import { TaskBuilder } from '../electron/ai/TaskBuilder'
import type { WorkspaceModelBindings } from '../shared/ai/bindings'
import type { ModelDescriptor, ModelReference } from '../shared/ai/model'
import type { NormalizedTaskInput, TaskModelSelection } from '../shared/ai/task'

function model(reference: ModelReference, overrides: Partial<ModelDescriptor> = {}): ModelDescriptor {
  return {
    ...reference,
    displayName: reference.modelId,
    source: 'remote',
    capabilities: ['chat', 'streaming'],
    availability: 'available',
    ...overrides,
  }
}

function adapter(id: string, status: 'available' | 'offline' = 'available'): ProviderAdapter {
  return {
    definition: { id, displayName: id, source: 'remote' },
    getAvailability: vi.fn().mockResolvedValue({ status }),
    listModels: () => [],
    execute: () => ({ finishReason: 'stop' }),
  }
}

function task(selection: TaskModelSelection, requirements: NormalizedTaskInput['requirements'] = ['chat']) {
  return new TaskBuilder().build({
    workspace: { id: 'workspace-1', name: 'Workspace' },
    intent: 'Analise o projeto.',
    mode: 'review',
    messages: [],
    context: [],
    constraints: [],
    requirements,
    selection,
    output: { format: 'markdown' },
    permissions: { workspaceAccess: 'read-only' },
    tools: [],
  })
}

function bindings(overrides: Partial<WorkspaceModelBindings> = {}): WorkspaceModelBindings {
  return {
    workspaceId: 'workspace-1',
    defaultBinding: { providerId: 'openai', modelId: 'default' },
    ...overrides,
  }
}

function setup() {
  const models = new ModelRegistry()
  const providers = new ProviderRegistry()
  for (const id of ['openai', 'openrouter']) providers.register(adapter(id))
  models.register(model({ providerId: 'openai', modelId: 'default' }))
  models.register(model({ providerId: 'openrouter', modelId: 'explicit-model' }))
  return { models, providers, resolver: new ModelResolver(models, providers) }
}

describe('ModelResolver', () => {
  it('resolve escolha explícita', async () => {
    const { resolver } = setup()
    const resolved = await resolver.resolve(task({
      type: 'explicit',
      model: { providerId: 'openrouter', modelId: 'explicit-model' },
    }), bindings())

    expect(resolved).toMatchObject({
      model: { providerId: 'openrouter', modelId: 'explicit-model' },
    })
  })

  it('usa o padrão do Workspace quando não há escolha explícita', async () => {
    const { resolver } = setup()
    const resolved = await resolver.resolve(task({
      type: 'workspace-default',
    }), bindings())

    expect(resolved).toMatchObject({
      model: { providerId: 'openai', modelId: 'default' },
    })
  })

  it('rejeita modelo indisponível', async () => {
    const { resolver } = setup()
    await expect(resolver.resolve(task({
      type: 'explicit',
      model: { providerId: 'missing', modelId: 'missing' },
    }), bindings())).rejects.toMatchObject({
      code: 'model-unavailable',
    })
  })

  it('valida capacidades, disponibilidade do Provider e isolamento do Workspace', async () => {
    const { models, providers, resolver } = setup()
    models.replaceProviderModels('openai', [
      model({ providerId: 'openai', modelId: 'default' }, { capabilities: ['chat'] }),
    ])
    await expect(resolver.resolve(
      task({ type: 'workspace-default' }, ['chat', 'streaming']),
      bindings(),
    )).rejects.toMatchObject({ code: 'capability-mismatch' })

    await providers.unregister('openai')
    providers.register(adapter('openai', 'offline'))
    await expect(resolver.resolve(
      task({ type: 'workspace-default' }),
      bindings(),
    )).rejects.toMatchObject({ code: 'provider-unavailable' })

    await expect(resolver.resolve(
      task({ type: 'workspace-default' }),
      bindings({ workspaceId: 'workspace-2' }),
    )).rejects.toMatchObject({ code: 'workspace-mismatch' })
  })

  it('rejeita quando não há modelo padrão nem explícito', async () => {
    const { resolver } = setup()
    await expect(resolver.resolve(
      task({ type: 'workspace-default' }),
      bindings({ defaultBinding: undefined }),
    )).rejects.toMatchObject({ code: 'binding-not-found' })
  })
})
