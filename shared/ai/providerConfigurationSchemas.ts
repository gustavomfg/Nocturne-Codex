import { z } from 'zod'
import {
  PROVIDER_CONFIGURATION_LIMITS,
  providerConfigurationTypes,
} from './providerConfiguration'

export const providerConfigurationInputSchema = z.object({
  providerType: z.enum(providerConfigurationTypes),
  displayName: z.string().trim().min(1)
    .max(PROVIDER_CONFIGURATION_LIMITS.displayNameCharacters),
  source: z.enum(['local', 'remote']),
  baseUrl: z.string().trim().min(1)
    .max(PROVIDER_CONFIGURATION_LIMITS.baseUrlCharacters),
  enabled: z.boolean(),
  requiresAuthentication: z.boolean(),
  timeoutMs: z.number().int()
    .min(PROVIDER_CONFIGURATION_LIMITS.minimumTimeoutMs)
    .max(PROVIDER_CONFIGURATION_LIMITS.maximumTimeoutMs),
}).strict()

export const providerConfigurationSummarySchema = providerConfigurationInputSchema.extend({
  id: z.string().uuid(),
  credentialConfigured: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict()
