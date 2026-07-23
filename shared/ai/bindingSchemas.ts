import { z } from 'zod'
import { fallbackPolicies } from './bindings'
import { modelReferenceSchema } from './modelSchemas'
import { modelRoles } from './task'

const roleBindingsShape = Object.fromEntries(
  modelRoles.map((role) => [role, modelReferenceSchema.optional()]),
) as Record<typeof modelRoles[number], z.ZodOptional<typeof modelReferenceSchema>>

export const workspaceModelBindingsSchema = z.object({
  workspaceId: z.string().trim().min(1).max(512),
  defaultBinding: modelReferenceSchema.optional(),
  roleBindings: z.object(roleBindingsShape).strict(),
  fallbackPolicy: z.enum(fallbackPolicies),
  fallbackBindings: z.array(modelReferenceSchema).max(10),
}).strict().superRefine((bindings, context) => {
  const keys = bindings.fallbackBindings.map(
    ({ providerId, modelId }) => JSON.stringify([providerId, modelId]),
  )
  if (new Set(keys).size !== keys.length) {
    context.addIssue({
      code: 'custom',
      path: ['fallbackBindings'],
      message: 'Fallbacks duplicados não são permitidos.',
    })
  }
  if (bindings.fallbackPolicy === 'configured' && bindings.fallbackBindings.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['fallbackBindings'],
      message: 'Fallback configurado exige ao menos um modelo alternativo.',
    })
  }
})
