export const DATABASE_SCHEMA_VERSION = 11

export const RENDERER_LIMITS = {
  activities: 300,
  activityDetailCharacters: 64_000,
  streamCharacters: 2_000_000,
} as const

export const PERSISTENCE_LIMITS = {
  assistantCharacters: 2_000_000,
  documentCharacters: 2_000_000,
  documentNameCharacters: 200,
} as const

export const UI_TIMING = {
  streamFlushMs: 80,
  activityFlushMs: 150,
  diagnosticsIntervalMs: 10_000,
} as const

export const COLLECTION_PAGE_LIMITS = { conversations: 100, artifacts: 50, suggestions: 50, brainMemories: 50 } as const
