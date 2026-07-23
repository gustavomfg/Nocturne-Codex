export const providerConfigurationTypes = ['openai-compatible'] as const

export const PROVIDER_CONFIGURATION_LIMITS = {
  identifierCharacters: 512,
  displayNameCharacters: 500,
  baseUrlCharacters: 2_048,
  credentialCharacters: 64_000,
  minimumTimeoutMs: 1_000,
  maximumTimeoutMs: 120_000,
} as const

export type ProviderConfigurationType = typeof providerConfigurationTypes[number]

export interface ProviderConfigurationInput {
  providerType: ProviderConfigurationType
  displayName: string
  source: 'local' | 'remote'
  baseUrl: string
  enabled: boolean
  requiresAuthentication: boolean
  timeoutMs: number
}

export interface ProviderConfigurationSummary extends ProviderConfigurationInput {
  id: string
  credentialConfigured: boolean
  createdAt: string
  updatedAt: string
}

export type ProviderConfigurationErrorCode =
  | 'invalid-configuration'
  | 'credential-required'
  | 'validation-failed'
  | 'configuration-not-found'
  | 'operation-failed'
