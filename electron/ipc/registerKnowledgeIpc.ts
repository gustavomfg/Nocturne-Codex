import type { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { LocalDatabase } from '../database/Database'
import type { Logger } from '../logging/Logger'
import { extractSuggestions } from '../../shared/suggestions'
import { idSchema, suggestionStatusSchema } from '../../shared/ipc/schemas'
import { safeIpcMain } from './safeIpc'

interface WorkspaceContext { content: string; rules: string; updatedAt: string }
interface Dependencies {
  workspace(conversationId: string): string
  read(workspace: string): WorkspaceContext
  write(workspace: string, content: string, rules: string): WorkspaceContext
  recordDecision(workspace: string, suggestion: { title: string; status: string; updatedAt: string }): void
}

export function registerKnowledgeIpc(win: BrowserWindow, database: LocalDatabase, logger: Logger, dependencies: Dependencies) {
  const ipcMain = safeIpcMain(win)
  ipcMain.handle('memory:get', (_event, value: unknown) => {
    const workspace = dependencies.workspace(idSchema.parse(value)); const files = dependencies.read(workspace); const persisted = database.getWorkspaceMemory(workspace)
    if (!persisted.content || Date.parse(persisted.updatedAt) <= Date.parse(files.updatedAt)) return files
    const marker = '\n\n# Regras do projeto\n'; const markerAt = persisted.content.indexOf(marker)
    return dependencies.write(workspace, markerAt >= 0 ? persisted.content.slice(0, markerAt) : persisted.content, markerAt >= 0 ? persisted.content.slice(markerAt + marker.length) : files.rules)
  })
  ipcMain.handle('memory:set', (_event, value: unknown) => {
    const data = z.object({ conversationId: idSchema, content: z.string().max(20_000), rules: z.string().max(20_000).default('') }).parse(value); const workspace = dependencies.workspace(data.conversationId)
    const result = dependencies.write(workspace, data.content, data.rules); database.setWorkspaceMemory(workspace, `${data.content}\n\n# Regras do projeto\n${data.rules}`); return result
  })
  ipcMain.handle('artifacts:list', (_event, value: unknown) => database.listArtifacts(idSchema.parse(value)))
  ipcMain.handle('artifacts:delete', (_event, value: unknown) => { const data = z.object({ conversationId: idSchema, artifactId: idSchema }).parse(value); if (!database.deleteArtifact(data.artifactId, data.conversationId)) throw new Error('Artefato não encontrado ou já removido.'); return { deleted: true } })
  ipcMain.handle('suggestions:list', (_event, value: unknown) => database.listSuggestions(idSchema.parse(value)))
  ipcMain.handle('suggestions:create', (_event, value: unknown) => {
    const data = z.object({ conversationId: idSchema, content: z.string().max(1_000_000) }).parse(value); const workspace = dependencies.workspace(data.conversationId); const extracted = extractSuggestions(data.content)
    const suggestions = extracted.suggestions.map((suggestion) => database.addSuggestion(data.conversationId, workspace, suggestion)); if (suggestions.length) logger.info('artifacts', 'Sugestões de review persistidas', { conversationId: data.conversationId, count: suggestions.length }); return { suggestions, content: extracted.content }
  })
  ipcMain.handle('suggestions:status', (_event, value: unknown) => { const data = suggestionStatusSchema.parse(value); const suggestion = database.listSuggestions(data.conversationId).find((item) => item.id === data.suggestionId); if (!suggestion) throw new Error('Sugestão não pertence a esta conversa.'); const updated = database.setSuggestionStatus(data.suggestionId, data.status, data.result); dependencies.recordDecision(suggestion.workspaceId, updated); return updated })
}
