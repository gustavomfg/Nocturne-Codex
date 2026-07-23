import type { ProviderAvailability, ProviderDefinition } from '../../shared/ai/provider'

export interface ProviderAdapter {
  readonly definition: ProviderDefinition
  getAvailability(): ProviderAvailability | Promise<ProviderAvailability>
  listModels(): readonly unknown[] | Promise<readonly unknown[]>
  dispose?(): void | Promise<void>
}

export type ProviderRegistryErrorCode = 'duplicate-provider' | 'provider-not-found'

export class ProviderRegistryError extends Error {
  constructor(
    readonly code: ProviderRegistryErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ProviderRegistryError'
  }
}

export class ProviderRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>()

  register(adapter: ProviderAdapter) {
    const { id } = adapter.definition
    if (this.adapters.has(id)) {
      throw new ProviderRegistryError('duplicate-provider', `Provider já registrado: ${id}`)
    }
    this.adapters.set(id, adapter)
  }

  list(): ProviderDefinition[] {
    return [...this.adapters.values()].map(({ definition }) => ({ ...definition }))
  }

  resolve(providerId: string): ProviderAdapter {
    const adapter = this.adapters.get(providerId)
    if (!adapter) {
      throw new ProviderRegistryError('provider-not-found', `Provider não registrado: ${providerId}`)
    }
    return adapter
  }

  async getAvailability(providerId: string): Promise<ProviderAvailability> {
    return this.resolve(providerId).getAvailability()
  }

  async unregister(providerId: string): Promise<boolean> {
    const adapter = this.adapters.get(providerId)
    if (!adapter) return false

    this.adapters.delete(providerId)
    await adapter.dispose?.()
    return true
  }

  async dispose(): Promise<void> {
    const adapters = [...this.adapters.values()]
    this.adapters.clear()
    await Promise.all(adapters.map((adapter) => adapter.dispose?.()))
  }
}
