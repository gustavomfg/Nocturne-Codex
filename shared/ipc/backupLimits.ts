export const BACKUP_COLLECTION_KEYS = ['conversations', 'workspaces', 'messages', 'artifacts', 'memories', 'brainMemories', 'suggestions', 'suggestionDecisions'] as const

export const BACKUP_LIMITS = Object.freeze({
  maxBytes: 25_000_000,
  maxRecords: 200_000,
})

export const PERSISTENCE_PERFORMANCE_BUDGETS = Object.freeze({
  representativeRestoreRecords: 25_000,
  restoreMs: 2_000,
  firstPageMs: 100,
  workerRoundTripRecords: 50_001,
  workerRoundTripMs: 2_000,
})

export function countBackupRecords(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0
  const record = value as Record<string, unknown>
  return BACKUP_COLLECTION_KEYS.reduce((total, key) => total + (Array.isArray(record[key]) ? record[key].length : 0), 0)
}

export function assertBackupRecordLimit(value: unknown) {
  const total = countBackupRecords(value)
  if (total > BACKUP_LIMITS.maxRecords) throw new Error(`O backup excede o limite agregado de ${formatCount(BACKUP_LIMITS.maxRecords)} registros.`)
  return total
}

export function assertBackupByteLimit(bytes: number) {
  if (bytes > BACKUP_LIMITS.maxBytes) throw new Error(`O backup excede o limite de ${formatMegabytes(BACKUP_LIMITS.maxBytes)} MB.`)
}

function formatCount(value: number) { return new Intl.NumberFormat('pt-BR').format(value) }
function formatMegabytes(value: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1_000_000) }
