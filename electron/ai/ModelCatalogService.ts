import type { ModelDescriptor } from '../../shared/ai/model'
import { ModelRegistry } from './ModelRegistry'
import { ProviderRegistry } from './ProviderRegistry'

export interface ModelCatalogRefreshResult {
  status: 'applied' | 'superseded'
  models: ModelDescriptor[]
}

export class ModelCatalogService {
  private readonly refreshVersions = new Map<string, number>()

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly models: ModelRegistry,
  ) {}

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

    return {
      status: 'applied',
      models: this.models.replaceProviderModels(providerId, discovered),
    }
  }
}
