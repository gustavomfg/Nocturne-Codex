import type { ModelDescriptor } from '../../shared/ai/model'
import { ModelRegistry } from './ModelRegistry'
import { ProviderRegistry } from './ProviderRegistry'

export interface ModelCatalogRefreshResult {
  status: 'applied' | 'superseded'
  models: ModelDescriptor[]
}

export interface ModelCatalogStore {
  list(providerId?: string): ModelDescriptor[]
  replaceProviderModels(
    providerId: string,
    inputs: readonly unknown[],
  ): ModelDescriptor[]
}

export class ModelCatalogService {
  private readonly refreshVersions = new Map<string, number>()

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly models: ModelRegistry,
    private readonly catalog: ModelCatalogStore,
  ) {}

  initialize(): { loaded: number; providers: number } {
    const descriptors = this.catalog.list()
    const byProvider = new Map<string, ModelDescriptor[]>()
    for (const descriptor of descriptors) {
      const providerModels = byProvider.get(descriptor.providerId) ?? []
      providerModels.push(descriptor)
      byProvider.set(descriptor.providerId, providerModels)
    }
    for (const [providerId, providerModels] of byProvider) {
      this.models.replaceProviderModels(providerId, providerModels)
    }
    return { loaded: descriptors.length, providers: byProvider.size }
  }

  async refresh(providerId: string): Promise<ModelCatalogRefreshResult> {
    const adapter = this.providers.resolve(providerId)
    const version = (this.refreshVersions.get(providerId) ?? 0) + 1
    this.refreshVersions.set(providerId, version)

    const discovered = await adapter.listModels()
    const currentAdapter = this.providers.resolve(providerId)
    if (this.refreshVersions.get(providerId) !== version || currentAdapter !== adapter) {
      return {
        status: 'superseded',
        models: this.models.list({ providerId }),
      }
    }

    const previous = this.models.list({ providerId })
    const models = this.models.replaceProviderModels(providerId, discovered)
    try {
      this.catalog.replaceProviderModels(providerId, models)
    } catch (error) {
      this.models.replaceProviderModels(providerId, previous)
      throw error
    }
    return { status: 'applied', models }
  }
}
