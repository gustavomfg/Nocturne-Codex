export const RENDERER_LIMITS = {
  activities: 300,
  activityDetailCharacters: 64_000,
  streamCharacters: 2_000_000,
} as const

export const UI_TIMING = {
  streamFlushMs: 80,
  activityFlushMs: 150,
  diagnosticsIntervalMs: 10_000,
} as const
