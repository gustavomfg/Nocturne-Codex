import { describe, expect, it, vi } from 'vitest'
import { ModelRegistry } from '../electron/ai/ModelRegistry'
import { ModelResolutionError, ModelResolver } from '../electron/ai/ModelResolver'
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
    roleBindings: {
      review: { providerId: 'openrouter', modelId: 'review' },
    },
    fallbackPolicy: 'disabled',
    fallbackBindings: [],
    ...overrides,
  }
}

function setup() {
  const models = new ModelRegistry()
  const providers = new ProviderRegistry()
  for (const id of ['openai', 'openrouter', 'ollama']) providers.register(adapter(id))
  models.register(model({ providerId: 'openai', modelId: 'default' }))
  models.register(model({ providerId: 'openrouter', modelId: 'review' }))
  models.register(model({ providerId: 'ollama', modelId: 'fallback' }, { source: 'local' }))
  return { models, providers, resolver: new ModelResolver(models, providers) }
}

describe('ModelResolver', () => {
  it('preserva escolha explícita acima de qualquer binding', async () => {
    const { resolver } = setup()
    const resolved = await resolver.resolve(task({
      type: 'explicit',
      model: { providerId: 'ollama', modelId: 'fallback' },
    }), bindings())

    expect(resolved).toMatchObject({
      model: { providerId: 'ollama', modelId: 'fallback' },
      source: 'explicit',
      usedFallback: false,
    })
  })

  it('resolve role e usa o padrão do Workspace quando a role não está vinculada', async () => {
    const { resolver } = setup()
    await expect(resolver.resolve(task({ type: 'role', role: 'review' }), bindings())).resolves.toMatchObject({
      model: { modelId: 'review' },
      source: 'role',
    })
    await expect(resolver.resolve(task({ type: 'role', role: 'documentation' }), bindings())).resolves.toMatchObject({
      model: { modelId: 'default' },
      source: 'workspace-default',
    })
  })

  it('não troca silenciosamente uma escolha explícita indisponível', async () => {
    const { resolver } = setup()
    await expect(resolver.resolve(task({
      type: 'explicit',
      model: { providerId: 'missing', modelId: 'missing' },
    }), bindings({
      fallbackPolicy: 'configured',
      fallbackBindings: [{ providerId: 'ollama', modelId: 'fallback' }],
    }))).rejects.toMatchObject({
      code: 'model-unavailable',
    })
  })

  it('usa somente fallback previamente configurado e informa a troca', async () => {
    const { models, resolver } = setup()
    models.replaceProviderModels('openrouter', [
      model({ providerId: 'openrouter', modelId: 'review' }, { availability: 'offline' }),
    ])

    await expect(resolver.resolve(task({ type: 'role', role: 'review' }), bindings({
      fallbackPolicy: 'configured',
      fallbackBindings: [{ providerId: 'ollama', modelId: 'fallback' }],
    }))).resolves.toMatchObject({
      model: { providerId: 'ollama', modelId: 'fallback' },
      source: 'configured-fallback',
      usedFallback: true,
    })
  })

  it('exige confirmação quando a política de fallback é explícita', async () => {
    const { models, resolver } = setup()
    models.replaceProviderModels('openrouter', [])

    await expect(resolver.resolve(task({ type: 'role', role: 'review' }), bindings({
      fallbackPolicy: 'explicit',
      fallbackBindings: [{ providerId: 'ollama', modelId: 'fallback' }],
    }))).rejects.toMatchObject({
      code: 'fallback-confirmation-required',
      details: {
        alternatives: [{ providerId: 'ollama', modelId: 'fallback' }],
      },
    })
  })

  it('valida capacidades, disponibilidade do Provider e isolamento do Workspace', async () => {
    const { models, providers, resolver } = setup()
    models.replaceProviderModels('openrouter', [
      model({ providerId: 'openrouter', modelId: 'review' }, { capabilities: ['chat'] }),
    ])
    await expect(resolver.resolve(
      task({ type: 'role', role: 'review' }, ['chat', 'streaming']),
      bindings(),
    )).rejects.toMatchObject({ code: 'capability-mismatch' })

    await providers.unregister('openrouter')
    providers.register(adapter('openrouter', 'offline'))
    await expect(resolver.resolve(
      task({ type: 'role', role: 'review' }),
      bindings(),
    )).rejects.toMatchObject({ code: 'provider-unavailable' })

    await expect(resolver.resolve(
      task({ type: 'workspace-default' }),
      bindings({ workspaceId: 'workspace-2' }),
    )).rejects.toMatchObject({ code: 'workspace-mismatch' })
  })

  it('rejeita configuração inválida antes de consultar registries', async () => {
    const { resolver } = setup()
    await expect(resolver.resolve(
      task({ type: 'workspace-default' }),
      bindings({ fallbackPolicy: 'configured', fallbackBindings: [] }),
    )).rejects.toEqual(expect.objectContaining<Partial<ModelResolutionError>>({
      code: 'invalid-bindings',
    }))
  })
})
