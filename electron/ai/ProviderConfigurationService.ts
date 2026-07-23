import type {
  ProviderConfigurationErrorCode,
  ProviderConfigurationInput,
  ProviderConfigurationSummary,
} from '../../shared/ai/providerConfiguration'
import type { ProviderAvailability } from '../../shared/ai/provider'
import type { ProviderAdapter } from './ProviderRegistry'
import { ProviderRegistry } from './ProviderRegistry'

export interface ConfiguredProviderAdapterFactory {
  normalize(input: unknown): ProviderConfigurationInput
  create(
    id: string,
    input: ProviderConfigurationInput,
    resolveCredential: () => Promise<string | undefined>,
  ): ProviderAdapter
}

export interface ProviderCredentialChange {
  credential?: string
  clearCredential?: boolean
}

export interface ProviderConfigurationStore {
  list(): ProviderConfigurationSummary[]
  get(id: string): ProviderConfigurationSummary | null
  create(input: unknown, credentialReference?: string | null): ProviderConfigurationSummary
  update(
    id: string,
    input: unknown,
    credentialReference?: string | null,
  ): ProviderConfigurationSummary
  getCredentialReference(id: string): string | null
  listCredentialReferences(): string[]
  delete(id: string): { deleted: boolean; credentialReference: string | null }
}

export interface ProviderCredentialStore {
  create(secret: string): Promise<string>
  resolve(reference: string): Promise<string | undefined>
  delete(reference: string): Promise<boolean>
  prune(allowedReferences: readonly string[]): Promise<number>
}

export class ProviderConfigurationServiceError extends Error {
  constructor(
    readonly code: ProviderConfigurationErrorCode,
    message: string,
    readonly availability?: ProviderAvailability,
  ) {
    super(message)
    this.name = 'ProviderConfigurationServiceError'
  }
}

export class ProviderConfigurationService {
  private operation: Promise<void> = Promise.resolve()

  constructor(
    private readonly configurations: ProviderConfigurationStore,
    private readonly credentials: ProviderCredentialStore,
    private readonly providers: ProviderRegistry,
    private readonly factory: ConfiguredProviderAdapterFactory,
  ) {}

  list() {
    return this.configurations.list()
  }

  initialize(): Promise<{
    loaded: number
    rejected: string[]
    prunedCredentials: number
  }> {
    return this.exclusive(async () => {
      let loaded = 0
      const rejected: string[] = []
      for (const configuration of this.configurations.list()) {
        try {
          const normalized = this.factory.normalize(toInput(configuration))
          this.providers.register(this.createPersistentAdapter(
            configuration.id,
            normalized,
          ))
          loaded += 1
        } catch {
          rejected.push(configuration.id)
        }
      }
      const prunedCredentials = await this.credentials.prune(
        this.configurations.listCredentialReferences(),
      )
      return { loaded, rejected, prunedCredentials }
    })
  }

  create(
    input: unknown,
    change: ProviderCredentialChange = {},
  ): Promise<ProviderConfigurationSummary> {
    return this.exclusive(async () => {
      const normalized = this.normalize(input)
      validateCredentialChange(change)
      const credential = change.clearCredential ? undefined : change.credential
      this.assertCredentialState(normalized, Boolean(credential))
      await this.validateEnabledConfiguration(normalized, async () => credential)

      let credentialReference: string | null = null
      let configuration: ProviderConfigurationSummary | undefined
      try {
        if (credential !== undefined) {
          credentialReference = await this.credentials.create(credential)
        }
        configuration = this.configurations.create(normalized, credentialReference)
        this.providers.register(this.createPersistentAdapter(
          configuration.id,
          normalized,
        ))
        return configuration
      } catch {
        if (configuration) this.configurations.delete(configuration.id)
        if (credentialReference) {
          await this.credentials.delete(credentialReference).catch(() => undefined)
        }
        throw new ProviderConfigurationServiceError(
          'operation-failed',
          'Não foi possível criar a configuração do Provider.',
        )
      }
    })
  }

  update(
    id: string,
    input: unknown,
    change: ProviderCredentialChange = {},
  ): Promise<ProviderConfigurationSummary> {
    return this.exclusive(async () => {
      const current = this.configurations.get(id)
      if (!current) throw notFoundError()
      const currentReference = this.configurations.getCredentialReference(id)
      const normalized = this.normalize(input)
      validateCredentialChange(change)

      const willHaveCredential = change.clearCredential
        ? false
        : change.credential !== undefined || currentReference !== null
      this.assertCredentialState(normalized, willHaveCredential)
      await this.validateEnabledConfiguration(normalized, async () => {
        if (change.clearCredential) return undefined
        if (change.credential !== undefined) return change.credential
        return currentReference
          ? await this.credentials.resolve(currentReference)
          : undefined
      })

      let nextReference: string | null | undefined
      try {
        if (change.clearCredential) nextReference = null
        else if (change.credential !== undefined) {
          nextReference = await this.credentials.create(change.credential)
        }
        const adapter = this.createPersistentAdapter(id, normalized)
        const updated = this.configurations.update(id, normalized, nextReference)
        await this.providers.replace(adapter)
        if (currentReference && nextReference !== undefined && currentReference !== nextReference) {
          await this.credentials.delete(currentReference).catch(() => undefined)
        }
        return updated
      } catch {
        if (nextReference) {
          await this.credentials.delete(nextReference).catch(() => undefined)
        }
        throw new ProviderConfigurationServiceError(
          'operation-failed',
          'Não foi possível atualizar a configuração do Provider.',
        )
      }
    })
  }

  remove(id: string): Promise<boolean> {
    return this.exclusive(async () => {
      const removed = this.configurations.delete(id)
      if (!removed.deleted) return false
      await this.providers.unregister(id).catch(() => undefined)
      if (removed.credentialReference) {
        await this.credentials.delete(removed.credentialReference).catch(() => undefined)
      }
      return true
    })
  }

  async testConnection(id: string): Promise<ProviderAvailability> {
    const configuration = this.configurations.get(id)
    if (!configuration) throw notFoundError()
    try {
      return await this.providers.getAvailability(id)
    } catch {
      throw new ProviderConfigurationServiceError(
        'operation-failed',
        'Não foi possível testar a conexão do Provider.',
      )
    }
  }

  private normalize(input: unknown) {
    try {
      return this.factory.normalize(input)
    } catch {
      throw new ProviderConfigurationServiceError(
        'invalid-configuration',
        'A configuração do Provider é inválida.',
      )
    }
  }

  private assertCredentialState(
    input: ProviderConfigurationInput,
    credentialConfigured: boolean,
  ) {
    if (input.enabled && input.requiresAuthentication && !credentialConfigured) {
      throw new ProviderConfigurationServiceError(
        'credential-required',
        'Uma credencial é necessária para habilitar este Provider.',
      )
    }
  }

  private async validateEnabledConfiguration(
    input: ProviderConfigurationInput,
    resolveCredential: () => Promise<string | undefined>,
  ) {
    if (!input.enabled) return
    let adapter: ProviderAdapter | undefined
    try {
      adapter = this.factory.create('provider-validation', input, resolveCredential)
      const availability = await adapter.getAvailability()
      if (availability.status !== 'available') {
        throw new ProviderConfigurationServiceError(
          'validation-failed',
          'O Provider não passou na validação de conexão.',
          availability,
        )
      }
    } catch (error) {
      if (error instanceof ProviderConfigurationServiceError) throw error
      throw new ProviderConfigurationServiceError(
        'validation-failed',
        'Não foi possível validar a conexão do Provider.',
      )
    } finally {
      if (adapter?.dispose) {
        await Promise.resolve(adapter.dispose()).catch(() => undefined)
      }
    }
  }

  private createPersistentAdapter(
    id: string,
    input: ProviderConfigurationInput,
  ) {
    return this.factory.create(id, input, async () => {
      const reference = this.configurations.getCredentialReference(id)
      return reference ? await this.credentials.resolve(reference) : undefined
    })
  }

  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation)
    this.operation = result.then(() => undefined, () => undefined)
    return result
  }
}

function validateCredentialChange(change: ProviderCredentialChange) {
  if (change.credential !== undefined && change.clearCredential) {
    throw new ProviderConfigurationServiceError(
      'invalid-configuration',
      'A credencial não pode ser definida e removida na mesma operação.',
    )
  }
}

function notFoundError() {
  return new ProviderConfigurationServiceError(
    'configuration-not-found',
    'Configuração de Provider não encontrada.',
  )
}

function toInput(
  configuration: ProviderConfigurationSummary,
): ProviderConfigurationInput {
  return {
    providerType: configuration.providerType,
    displayName: configuration.displayName,
    source: configuration.source,
    baseUrl: configuration.baseUrl,
    enabled: configuration.enabled,
    requiresAuthentication: configuration.requiresAuthentication,
    timeoutMs: configuration.timeoutMs,
  }
}
