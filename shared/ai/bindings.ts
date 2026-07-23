import type { ModelReference } from './model'

export interface WorkspaceModelBindings {
  workspaceId: string
  defaultBinding?: ModelReference
}
