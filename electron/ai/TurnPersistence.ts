import path from 'node:path'
import type { AgentMode } from '../../shared/suggestions'
import { extractBrainMemoryCandidates } from '../../shared/suggestions'
import { extractSuggestions } from '../../shared/suggestions'
import { PERSISTENCE_LIMITS } from '../../shared/constants'
import type { LocalDatabase, MessageRow } from '../database/Database'

export interface CompletedTurnSnapshot {
  conversationId: string
  workspace: string
  mode: AgentMode
  content: string
  diff: string
  files: string[]
  plan: unknown[]
  planExplanation: string
}

export interface PersistedTurn {
  message: MessageRow | null
  warning?: string
}

export function persistCompletedTurn(database: LocalDatabase, snapshot: CompletedTurnSnapshot): PersistedTurn {
  if (!snapshot.content) return { message: null }
  const warnings: string[] = []
  let assistantContent = snapshot.content.slice(0, PERSISTENCE_LIMITS.assistantCharacters)

  const memoryExtraction = extractBrainMemoryCandidates(assistantContent)
  try {
    database.createBrainMemoryCandidates(snapshot.workspace, snapshot.conversationId, memoryExtraction.candidates)
    assistantContent = memoryExtraction.content || (memoryExtraction.candidates.length ? `${memoryExtraction.candidates.length} candidata(s) foram enviadas ao Segundo Cérebro para sua revisão.` : 'A resposta do agente não continha conteúdo persistível.')
  } catch {
    warnings.push('As candidatas do Segundo Cérebro não puderam ser salvas.')
  }

  if (snapshot.mode === 'review') {
    const suggestionExtraction = extractSuggestions(assistantContent)
    try {
      database.reconcileSuggestions(snapshot.conversationId, snapshot.workspace, suggestionExtraction.suggestions)
      assistantContent = suggestionExtraction.content || assistantContent
    } catch {
      warnings.push('As sugestões da análise não puderam ser salvas.')
    }
  }

  const files = [...new Set(snapshot.files)].slice(-300)
  const metadata = {
    diff: snapshot.diff.slice(-500_000),
    files: files.map((filePath) => ({ path: filePath, kind: 'modified' })),
    plan: snapshot.plan.slice(-100),
    planExplanation: snapshot.planExplanation.slice(-20_000),
  }
  const artifacts: Array<{ type: string; title: string; filePath?: string; content?: string }> = files.map((filePath) => ({ type: artifactType(filePath), title: path.basename(filePath), filePath }))
  if (snapshot.diff) artifacts.push({ type: 'report', title: 'Alterações do turno', filePath: undefined, content: snapshot.diff.slice(-500_000) })
  const message = database.saveAssistantTurn(snapshot.conversationId, snapshot.workspace, assistantContent, metadata, artifacts)
  return { message, ...(warnings.length ? { warning: warnings.join(' ') } : {}) }
}

function artifactType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) return 'image'
  if (extension === '.md') return 'markdown'
  if (['.json', '.yaml', '.yml', '.toml', '.env', '.ini'].includes(extension)) return 'configuration'
  if (['.docx', '.pdf', '.html'].includes(extension)) return 'document'
  return 'code'
}
