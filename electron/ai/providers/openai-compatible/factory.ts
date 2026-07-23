import type {
  ProviderConfigurationInput,
} from '../../../../shared/ai/providerConfiguration'
import { providerConfigurationInputSchema } from '../../../../shared/ai/providerConfigurationSchemas'
import type { ConfiguredProviderAdapterFactory } from '../../ProviderConfigurationService'
import { ModelRegistry } from '../../ModelRegistry'
import { OpenAICompatibleProviderAdapter } from './adapter'
import { parseOpenAICompatibleConfig } from './config'

export class OpenAICompatibleAdapterFactory implements ConfiguredProviderAdapterFactory {
  constructor(
    private readonly models: ModelRegistry,
    private readonly request?: typeof fetch,
  ) {}

  normalize(input: unknown): ProviderConfigurationInput {
    const parsed = providerConfigurationInputSchema.parse(input)
    const normalized = parseOpenAICompatibleConfig({
      id: 'provider-validation',
      ...toAdapterConfig(parsed),
    })
    return {
      ...parsed,
      baseUrl: normalized.baseUrl,
    }
  }

  create(
    id: string,
    input: ProviderConfigurationInput,
    resolveCredential: () => Promise<string | undefined>,
  ) {
    return new OpenAICompatibleProviderAdapter({
      config: { id, ...toAdapterConfig(input) },
      models: this.models.list({ providerId: id }),
      resolveCredential,
      fetch: this.request,
    })
  }
}

function toAdapterConfig(input: ProviderConfigurationInput) {
  return {
    displayName: input.displayName,
    source: input.source,
    baseUrl: input.baseUrl,
    enabled: input.enabled,
    requiresAuthentication: input.requiresAuthentication,
    timeoutMs: input.timeoutMs,
  }
}
