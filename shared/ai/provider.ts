export type ProviderSource = 'local' | 'remote'

export type ProviderAvailabilityStatus =
  | 'not-configured'
  | 'validating'
  | 'available'
  | 'degraded'
  | 'offline'
  | 'authentication-required'
  | 'incompatible'
  | 'disabled'

export interface ProviderDefinition {
  id: string
  displayName: string
  source: ProviderSource
}

export interface ProviderAvailability {
  status: ProviderAvailabilityStatus
  message?: string
  checkedAt?: string
}
