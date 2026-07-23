import { describe, expect, it } from 'vitest'
import { ModelRegistry, ModelRegistryError } from '../electron/ai/ModelRegistry'
import type { ModelDescriptor } from '../shared/ai/model'

function model(
  providerId: string,
  modelId: string,
  overrides: Partial<ModelDescriptor> = {},
): ModelDescriptor {
  return {
    providerId,
    modelId,
    displayName: modelId,
    source: 'remote',
    capabilities: ['chat'],
    availability: 'available',
    ...overrides,
  }
}

describe('ModelRegistry', () => {
  it('identifica o modelo pelo par providerId e modelId', () => {
    const registry = new ModelRegistry()
    registry.register(model('openai', 'shared-name'))
    registry.register(model('openrouter', 'shared-name'))

    expect(registry.resolve({ providerId: 'openai', modelId: 'shared-name' }).providerId).toBe('openai')
    expect(registry.resolve({ providerId: 'openrouter', modelId: 'shared-name' }).providerId).toBe('openrouter')
  })

  it('rejeita descriptors nativos, capacidades desconhecidas e duplicatas', () => {
    const registry = new ModelRegistry()

    expect(() => registry.register({
      ...model('openai', 'native'),
      nativePayload: {},
    })).toThrow(expect.objectContaining<Partial<ModelRegistryError>>({ code: 'invalid-model' }))
    expect(() => registry.register({
      ...model('openai', 'image'),
      capabilities: ['chat', 'image-generation'],
    })).toThrow(expect.objectContaining<Partial<ModelRegistryError>>({ code: 'invalid-model' }))
    expect(() => registry.register({
      ...model('openai', 'duplicate-capability'),
      capabilities: ['chat', 'chat'],
    })).toThrow(expect.objectContaining<Partial<ModelRegistryError>>({ code: 'invalid-model' }))

    registry.register(model('openai', 'unique'))
    expect(() => registry.register(model('openai', 'unique'))).toThrow(
      expect.objectContaining<Partial<ModelRegistryError>>({ code: 'duplicate-model' }),
    )
  })

  it('filtra somente modelos que satisfazem todas as capacidades requeridas', () => {
    const registry = new ModelRegistry()
    registry.register(model('openai', 'chat'))
    registry.register(model('openrouter', 'tools', {
      capabilities: ['chat', 'streaming', 'tool-calling'],
    }))
    registry.register(model('ollama', 'offline-tools', {
      source: 'local',
      capabilities: ['chat', 'tool-calling'],
      availability: 'offline',
    }))

    expect(registry.list({
      capabilities: ['chat', 'tool-calling'],
      availability: 'available',
    }).map(({ modelId }) => modelId)).toEqual(['tools'])
    expect(registry.list({ source: 'local' }).map(({ modelId }) => modelId)).toEqual(['offline-tools'])
  })

  it('substitui atomicamente apenas o catálogo do provider informado', () => {
    const registry = new ModelRegistry()
    registry.register(model('openai', 'old'))
    registry.register(model('ollama', 'local', { source: 'local' }))

    expect(() => registry.replaceProviderModels('openai', [
      model('openai', 'new'),
      model('other', 'invalid'),
    ])).toThrow(expect.objectContaining<Partial<ModelRegistryError>>({ code: 'provider-mismatch' }))
    expect(registry.resolve({ providerId: 'openai', modelId: 'old' }).modelId).toBe('old')

    registry.replaceProviderModels('openai', [model('openai', 'new')])
    expect(registry.list({ providerId: 'openai' }).map(({ modelId }) => modelId)).toEqual(['new'])
    expect(registry.resolve({ providerId: 'ollama', modelId: 'local' }).modelId).toBe('local')
  })

  it('não permite que consumidores alterem o catálogo interno', () => {
    const registry = new ModelRegistry()
    registry.register(model('openai', 'safe', {
      capabilities: ['chat', 'streaming'],
      pricing: {
        currency: 'USD',
        inputPerMillionTokens: 1,
        effectiveAt: '2026-07-22',
      },
    }))

    const descriptor = registry.resolve({ providerId: 'openai', modelId: 'safe' })
    descriptor.capabilities.length = 0
    if (descriptor.pricing) descriptor.pricing.inputPerMillionTokens = 99

    expect(registry.resolve({ providerId: 'openai', modelId: 'safe' })).toMatchObject({
      capabilities: ['chat', 'streaming'],
      pricing: { inputPerMillionTokens: 1 },
    })
  })
})
