import type { ModelReference } from './model'
import type { ModelRole } from './task'

export const fallbackPolicies = ['disabled', 'explicit', 'configured'] as const
export type FallbackPolicy = typeof fallbackPolicies[number]

export interface WorkspaceModelBindings {
  workspaceId: string
  defaultBinding?: ModelReference
  roleBindings: Partial<Record<ModelRole, ModelReference>>
  fallbackPolicy: FallbackPolicy
  fallbackBindings: ModelReference[]
}
