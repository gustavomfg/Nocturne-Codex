import type { AgentMode } from './types'
import type { BrainMemoryKind, BrainMemoryScope, BrainMemorySource } from './brainMemory'

export interface AwarenessContextSelection {
  id: string
  title: string
  source: 'workspace-memory' | 'brain-memory'
  sourceType: BrainMemorySource | 'workspace'
  sourceId: string | null
  kind: BrainMemoryKind | 'workspace-context'
  scope: BrainMemoryScope | 'workspace'
  relevance: number
  reason: string
  updatedAt: string | null
  contentPreview: string
}

export interface AwarenessSnapshot {
  mode: AgentMode
  createdAt: string
  selections: AwarenessContextSelection[]
}

export function parseAwarenessSnapshot(metadata: string | null): AwarenessSnapshot | null {
  if (!metadata) return null
  try {
    const value = (JSON.parse(metadata) as { awareness?: unknown }).awareness
    if (!value || typeof value !== 'object') return null
    const snapshot = value as AwarenessSnapshot
    if (!['review', 'build', 'docs'].includes(snapshot.mode) || !Array.isArray(snapshot.selections) || typeof snapshot.createdAt !== 'string') return null
    const selections = snapshot.selections.filter(isContextSelection)
    return { ...snapshot, selections }
  } catch {
    return null
  }
}

function isContextSelection(item: AwarenessContextSelection) {
  return item && typeof item.id === 'string' && item.id.length <= 512
    && typeof item.title === 'string' && item.title.length <= 500
    && ['workspace-memory', 'brain-memory'].includes(item.source)
    && ['workspace', 'manual', 'message', 'agent'].includes(item.sourceType)
    && (item.sourceId === null || typeof item.sourceId === 'string')
    && ['workspace-context', 'fact', 'decision', 'preference', 'constraint', 'learning'].includes(item.kind)
    && ['workspace', 'conversation'].includes(item.scope)
    && Number.isInteger(item.relevance) && item.relevance >= 0 && item.relevance <= 100
    && typeof item.reason === 'string' && item.reason.length <= 1_000
    && (item.updatedAt === null || typeof item.updatedAt === 'string')
    && typeof item.contentPreview === 'string' && item.contentPreview.length <= 500
}
