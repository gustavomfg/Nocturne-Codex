import type { LocalDatabase, ConversationRow } from '../database/Database'
import { assertSafeWorkspaceScope } from '../security/WorkspaceTrust'

export function getConversation(database: LocalDatabase, id: string): ConversationRow {
  const conversation = database.getConversation(id)
  if (!conversation) throw new Error('Conversa não encontrada.')
  return conversation
}

export function getAuthorizedWorkspace(database: LocalDatabase, value: string) {
  const workspace = assertSafeWorkspaceScope(value)
  const workspaces = database.listWorkspaces()
  if (workspaces.some((item) => item.authorized && item.path === value)) return workspace
  const authorized = workspaces.some((item) => {
    if (!item.authorized) return false
    try { return assertSafeWorkspaceScope(item.path) === workspace } catch { return false }
  })
  if (!authorized) throw new Error('Workspace não autorizado. Selecione novamente a pasta pelo aplicativo antes de continuar.')
  return workspace
}

export function getAuthorizedConversation(database: LocalDatabase, id: string): ConversationRow {
  const conversation = getConversation(database, id)
  return { ...conversation, workspace: getAuthorizedWorkspace(database, conversation.workspace) }
}
