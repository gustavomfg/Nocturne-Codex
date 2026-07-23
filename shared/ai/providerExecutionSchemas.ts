import { z } from 'zod'
import { executionIdSchema, normalizedProviderErrorSchema } from './executionSchemas'
import { modelDescriptorSchema } from './modelSchemas'
import { normalizedTaskSchema } from './taskSchemas'

export const providerStreamPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.delta'),
    messageId: z.string().trim().min(1).max(512),
    delta: z.string().min(1).max(100_000),
  }).strict(),
  z.object({
    type: z.literal('usage.updated'),
    usage: z.object({
      inputTokens: z.number().int().nonnegative().optional(),
      cachedInputTokens: z.number().int().nonnegative().optional(),
      outputTokens: z.number().int().nonnegative().optional(),
    }).strict().refine(
      (usage) => Object.values(usage).some((value) => value !== undefined),
      'Informe ao menos um contador de uso.',
    ),
  }).strict(),
])

export const providerExecutionRequestSchema = z.object({
  executionId: executionIdSchema,
  task: normalizedTaskSchema,
  model: modelDescriptorSchema,
}).strict()

export const providerExecutionResultSchema = z.object({
  finishReason: z.enum(['stop', 'length', 'unknown']),
}).strict()

export const providerExecutionErrorSchema = normalizedProviderErrorSchema
