export const brainMemoryKinds = ['fact', 'decision', 'preference', 'constraint', 'learning'] as const
export const brainMemoryScopes = ['workspace', 'conversation'] as const
export const brainMemoryStatuses = ['candidate', 'active', 'outdated', 'archived'] as const
export const brainMemorySources = ['manual', 'message', 'agent'] as const

export type BrainMemoryKind = typeof brainMemoryKinds[number]
export type BrainMemoryScope = typeof brainMemoryScopes[number]
export type BrainMemoryStatus = typeof brainMemoryStatuses[number]
export type BrainMemorySource = typeof brainMemorySources[number]

export interface BrainMemory {
  id: string
  workspaceId: string
  conversationId: string | null
  kind: BrainMemoryKind
  scope: BrainMemoryScope
  status: BrainMemoryStatus
  content: string
  confidence: number
  sourceType: BrainMemorySource
  sourceId: string | null
  createdAt: string
  updatedAt: string
  lastConfirmedAt: string | null
  lastUsedAt: string | null
  useCount: number
}

export interface CreateBrainMemoryInput {
  conversationId?: string
  kind: BrainMemoryKind
  scope: BrainMemoryScope
  content: string
  confidence?: number
  sourceType?: BrainMemorySource
  sourceId?: string
  status?: Extract<BrainMemoryStatus, 'candidate' | 'active'>
}

export interface UpdateBrainMemoryInput {
  kind?: BrainMemoryKind
  scope?: BrainMemoryScope
  conversationId?: string | null
  content?: string
  confidence?: number
  status?: BrainMemoryStatus
}
