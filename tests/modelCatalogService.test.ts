import { describe, expect, it, vi } from 'vitest'
import { ModelCatalogService } from '../electron/ai/ModelCatalogService'
import { ModelRegistry } from '../electron/ai/ModelRegistry'
import { ProviderRegistry, ProviderRegistryError, type ProviderAdapter } from '../electron/ai/ProviderRegistry'
import type { ModelDescriptor } from '../shared/ai/model'

function model(providerId: string, modelId: string): ModelDescriptor {
  return {
    providerId,
    modelId,
    displayName: modelId,
    source: 'remote',
    capabilities: ['chat'],
    availability: 'available',
  }
}

function adapter(
  id: string,
  listModels: ProviderAdapter['listModels'],
): ProviderAdapter {
  return {
    definition: { id, displayName: id, source: 'remote' },
    getAvailability: () => ({ status: 'available' }),
    listModels,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('ModelCatalogService', () => {
  it('descobre e substitui somente os modelos do provider solicitado', async () => {
    const providers = new ProviderRegistry()
    const models = new ModelRegistry()
    models.register(model('openai', 'old'))
    models.register(model('ollama', 'local'))
    providers.register(adapter('openai', async () => [model('openai', 'new')]))

    const result = await new ModelCatalogService(providers, models).refresh('openai')

    expect(result).toMatchObject({
      status: 'applied',
      models: [{ providerId: 'openai', modelId: 'new' }],
    })
    expect(models.list({ providerId: 'openai' }).map(({ modelId }) => modelId)).toEqual(['new'])
    expect(models.list({ providerId: 'ollama' }).map(({ modelId }) => modelId)).toEqual(['local'])
  })

  it('preserva o catálogo anterior quando qualquer descriptor é inválido', async () => {
    const providers = new ProviderRegistry()
    const models = new ModelRegistry()
    models.register(model('openai', 'stable'))
    providers.register(adapter('openai', async () => [
      model('openai', 'valid'),
      { ...model('openai', 'native'), nativePayload: { id: 'unsafe' } },
    ]))

    await expect(new ModelCatalogService(providers, models).refresh('openai')).rejects.toMatchObject({
      code: 'invalid-model',
    })
    expect(models.list({ providerId: 'openai' }).map(({ modelId }) => modelId)).toEqual(['stable'])
  })

  it('impede que uma resposta antiga sobrescreva uma descoberta mais recente', async () => {
    const older = deferred<readonly unknown[]>()
    const newer = deferred<readonly unknown[]>()
    const listModels = vi.fn()
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise)
    const providers = new ProviderRegistry()
    const models = new ModelRegistry()
    providers.register(adapter('openai', listModels))
    const service = new ModelCatalogService(providers, models)

    const olderRefresh = service.refresh('openai')
    const newerRefresh = service.refresh('openai')
    newer.resolve([model('openai', 'newer')])
    await expect(newerRefresh).resolves.toMatchObject({ status: 'applied' })
    older.resolve([model('openai', 'older')])
    await expect(olderRefresh).resolves.toMatchObject({ status: 'superseded' })

    expect(models.list({ providerId: 'openai' }).map(({ modelId }) => modelId)).toEqual(['newer'])
  })

  it('não aplica o catálogo se o adapter for removido durante a descoberta', async () => {
    const pending = deferred<readonly unknown[]>()
    const providers = new ProviderRegistry()
    const models = new ModelRegistry()
    models.register(model('openai', 'stable'))
    providers.register(adapter('openai', () => pending.promise))
    const refresh = new ModelCatalogService(providers, models).refresh('openai')

    await providers.unregister('openai')
    pending.resolve([model('openai', 'late')])

    await expect(refresh).rejects.toEqual(
      expect.objectContaining<Partial<ProviderRegistryError>>({
        code: 'provider-not-found',
      }),
    )
    expect(models.list({ providerId: 'openai' }).map(({ modelId }) => modelId)).toEqual(['stable'])
  })
})
