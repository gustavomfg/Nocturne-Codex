import { z } from 'zod'
import {
  AI_EXECUTION_LIMITS,
  normalizedErrorCodes,
  normalizedFinishReasons,
} from './execution'

const identifierSchema = z.string().trim().min(1).max(AI_EXECUTION_LIMITS.identifierCharacters)
const tokenCountSchema = z.number().int().nonnegative()

export const executionIdSchema = z.string().uuid()

export const normalizedUsageSchema = z.object({
  inputTokens: tokenCountSchema.optional(),
  cachedInputTokens: tokenCountSchema.optional(),
  outputTokens: tokenCountSchema.optional(),
}).strict().refine(
  (usage) => usage.inputTokens !== undefined
    || usage.cachedInputTokens !== undefined
    || usage.outputTokens !== undefined,
  'Informe ao menos um contador de uso.',
)

export const normalizedProviderErrorSchema = z.object({
  code: z.enum(normalizedErrorCodes),
  message: z.string().trim().min(1).max(AI_EXECUTION_LIMITS.errorMessageCharacters),
  retryable: z.boolean(),
  retryAfterMs: z.number().int().nonnegative().optional(),
}).strict()

export const executionEventPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('execution.started'),
    providerId: identifierSchema,
    modelId: identifierSchema,
  }).strict(),
  z.object({
    type: z.literal('message.delta'),
    messageId: identifierSchema,
    delta: z.string().min(1).max(AI_EXECUTION_LIMITS.messageDeltaCharacters),
  }).strict(),
  z.object({
    type: z.literal('usage.updated'),
    usage: normalizedUsageSchema,
  }).strict(),
  z.object({
    type: z.literal('execution.completed'),
    finishReason: z.enum(normalizedFinishReasons),
  }).strict(),
  z.object({
    type: z.literal('execution.failed'),
    error: normalizedProviderErrorSchema,
  }).strict(),
  z.object({
    type: z.literal('execution.cancelled'),
    reason: z.string().trim().min(1).max(AI_EXECUTION_LIMITS.errorMessageCharacters).optional(),
  }).strict(),
])

const executionEventEnvelopeSchema = z.object({
  executionId: executionIdSchema,
  sequence: z.number().int().nonnegative(),
  timestamp: z.string().datetime({ offset: true }),
}).strict()

export const normalizedExecutionEventSchema = z.intersection(
  executionEventEnvelopeSchema,
  executionEventPayloadSchema,
)
