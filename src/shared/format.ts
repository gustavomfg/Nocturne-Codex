import type { ChangedFile, PlanStep } from '../types'

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}
export function formatBytes(value: number) { return value < 1024 ? `${value} B` : value < 1_048_576 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1_048_576).toFixed(1)} MB` }
export function relativeTime(date: string) { const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000); return mins < 1 ? 'agora' : mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.floor(mins / 60)} h` : `${Math.floor(mins / 1440)} d` }
export function describeChanges(value: unknown) { if (!Array.isArray(value)) return ''; return value.map((item) => String((item as Record<string, unknown>).path ?? '')).filter(Boolean).join('\n') }
export function parseChanges(value: unknown): ChangedFile[] { if (!Array.isArray(value)) return []; return value.map((item) => { const change = item as Record<string, unknown>; const rawKind = String(change.kind ?? 'modified').toLowerCase(); return { path: String(change.path ?? ''), kind: (rawKind.includes('add') ? 'created' : rawKind.includes('delete') ? 'deleted' : 'modified') as ChangedFile['kind'], status: String(change.status ?? 'completed') } }).filter((item) => item.path) }
export function normalizePlanStatus(value: unknown): PlanStep['status'] { const status = String(value).toLowerCase(); return status.includes('complete') ? 'completed' : status.includes('progress') ? 'inProgress' : 'pending' }
export function isBusy(status: string) { return ['planning', 'running', 'waiting-approval', 'cancelling'].includes(status) }
export function statusText(status: string) { return ({ disconnected: 'Codex desconectado', starting: 'Conectando', ready: 'Codex pronto', planning: 'Planejando', running: 'Executando', 'waiting-approval': 'Aguardando aprovação', cancelling: 'Cancelando', completed: 'Concluído', failed: 'Falha no Codex' } as Record<string, string>)[status] ?? status }

export function humanizeCommand(command: string) {
  const lower = command.toLowerCase()
  if (/\b(npm|pnpm|yarn)\s+(test|run test)|\b(vitest|jest|pytest|cargo test|go test)\b/.test(lower)) return 'Executando testes'
  if (/\b(npm|pnpm|yarn)\s+(run\s+)?(build|typecheck|lint)\b/.test(lower)) return lower.includes('lint') ? 'Verificando qualidade do código' : lower.includes('typecheck') ? 'Verificando tipos TypeScript' : 'Compilando o projeto'
  if (/\bgit\s+(status|diff|log)\b/.test(lower)) return 'Analisando alterações Git'
  if (/\b(rg|grep|find|ls)\b/.test(lower)) return 'Explorando arquivos do projeto'
  if (/\b(cat|sed|head|tail)\b/.test(lower)) return `Lendo ${commandTarget(command)}`
  if (/\b(npm|pnpm|yarn)\s+(install|add)\b/.test(lower)) return 'Instalando dependências'
  return 'Executando comando'
}
function commandTarget(command: string) { return command.match(/[\w./-]+\.[a-zA-Z0-9]+/)?.[0] ?? 'arquivo' }
