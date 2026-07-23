import { z } from 'zod'
import { modelAvailabilityStatuses, modelCapabilities } from './model'

export const modelCapabilitySchema = z.enum(modelCapabilities)
export const modelAvailabilitySchema = z.enum(modelAvailabilityStatuses)

const priceSchema = z.number().finite().nonnegative()

export const modelPricingSchema = z.object({
  currency: z.literal('USD'),
  inputPerMillionTokens: priceSchema.optional(),
  cachedInputPerMillionTokens: priceSchema.optional(),
  outputPerMillionTokens: priceSchema.optional(),
  effectiveAt: z.string().trim().min(1),
}).strict().refine(
  (pricing) => pricing.inputPerMillionTokens !== undefined
    || pricing.cachedInputPerMillionTokens !== undefined
    || pricing.outputPerMillionTokens !== undefined,
  'Informe ao menos um preço normalizado.',
)

export const modelDescriptorSchema = z.object({
  providerId: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  family: z.string().trim().min(1).optional(),
  version: z.string().trim().min(1).optional(),
  source: z.enum(['local', 'remote']),
  capabilities: z.array(modelCapabilitySchema),
  contextWindow: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  pricing: modelPricingSchema.optional(),
  availability: modelAvailabilitySchema,
}).strict().superRefine((descriptor, context) => {
  if (new Set(descriptor.capabilities).size !== descriptor.capabilities.length) {
    context.addIssue({
      code: 'custom',
      path: ['capabilities'],
      message: 'Capacidades duplicadas não são permitidas.',
    })
  }
})
