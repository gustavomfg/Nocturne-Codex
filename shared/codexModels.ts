import { z } from 'zod'

const modelIdentifierSchema = z.string().trim().min(1).max(100)

export const codexModelSchema = z.object({
  model: modelIdentifierSchema,
  displayName: z.string().trim().min(1).max(500),
  defaultReasoningEffort: z.string().trim().min(1).max(50).optional(),
  isDefault: z.boolean(),
}).strict()

export const codexModelListResultSchema = z.object({
  data: z.array(z.object({
    model: modelIdentifierSchema,
    displayName: z.string().trim().min(1).max(500),
    defaultReasoningEffort: z.string().trim().min(1).max(50).optional(),
    isDefault: z.boolean().optional(),
  })).max(100),
  nextCursor: z.string().max(1_000).nullable().optional(),
})

export type CodexModel = z.infer<typeof codexModelSchema>
