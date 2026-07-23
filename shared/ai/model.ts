import type { ProviderSource } from './provider'

export const modelCapabilities = [
  'chat',
  'streaming',
  'tool-calling',
  'vision',
  'structured-output',
  'reasoning',
  'embeddings',
] as const

export const modelAvailabilityStatuses = [
  'available',
  'disabled',
  'offline',
  'missing-credentials',
  'incompatible',
  'deprecated',
] as const

export type ModelCapability = typeof modelCapabilities[number]
export type ModelAvailability = typeof modelAvailabilityStatuses[number]

export interface ModelReference {
  providerId: string
  modelId: string
}

export interface ModelPricing {
  currency: 'USD'
  inputPerMillionTokens?: number
  cachedInputPerMillionTokens?: number
  outputPerMillionTokens?: number
  effectiveAt: string
}

export interface ModelDescriptor extends ModelReference {
  displayName: string
  family?: string
  version?: string
  source: ProviderSource
  capabilities: ModelCapability[]
  contextWindow?: number
  maxOutputTokens?: number
  pricing?: ModelPricing
  availability: ModelAvailability
}
