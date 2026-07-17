import compatibility from './codex-compatibility.json'

export const CODEX_COMPATIBILITY = compatibility
export const DATABASE_SCHEMA_VERSION = 7

export type CodexCompatibilityStatus = 'unsupported' | 'minimum-compatible-unverified' | 'verified'

export function classifyCodexVersion(value: string | undefined): CodexCompatibilityStatus {
  const version = value?.match(/(\d+\.\d+\.\d+)/)?.[1]
  if (!version || compareVersions(version, CODEX_COMPATIBILITY.minimum) < 0) return 'unsupported'
  return CODEX_COMPATIBILITY.verified.includes(version) ? 'verified' : 'minimum-compatible-unverified'
}

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

function compareVersions(left: string, right: string) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0)
  }
  return 0
}
