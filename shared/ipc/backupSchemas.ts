import { z } from 'zod'
import { agentModes, suggestionStatuses } from '../suggestions'
import { BACKUP_LIMITS } from './backupLimits'

const uuid = z.string().uuid()
const timestamp = z.string().datetime({ offset: true })
const pathValue = z.string().min(1).max(4_000)
const jsonText = (limit: number) => z.string().max(limit).refine((value) => { try { JSON.parse(value); return true } catch { return false } }, 'JSON inválido')

const workspace = z.object({ path: pathValue, name: z.string().min(1).max(500), favorite: z.union([z.literal(0), z.literal(1)]).default(0), authorized: z.union([z.literal(0), z.literal(1)]).optional(), created_at: timestamp, last_opened_at: timestamp }).strict()
const conversation = z.object({ id: uuid, title: z.string().min(1).max(500), workspace: pathValue, codex_thread_id: z.string().max(500).nullable().default(null), created_at: timestamp, updated_at: timestamp }).strict()
const message = z.object({ id: uuid, conversation_id: uuid, role: z.enum(['user', 'assistant', 'system']), content: z.string().max(2_000_000), metadata: jsonText(500_000).nullable().default(null), created_at: timestamp }).strict()
const artifact = z.object({ id: uuid, conversation_id: uuid, workspace: pathValue, type: z.string().min(1).max(50), title: z.string().min(1).max(500), file_path: pathValue.nullable().default(null), content: z.string().max(2_000_000).nullable().default(null), metadata: jsonText(500_000).nullable().default(null), created_at: timestamp, updated_at: timestamp }).strict()
const memory = z.object({ workspace: pathValue, content: z.string().max(50_000), updated_at: timestamp }).strict()
const suggestion = z.object({ id: uuid, workspace_id: pathValue, conversation_id: uuid, title: z.string().min(1).max(200), description: z.string().max(4_000), reasoning: z.string().max(8_000), category: z.string().min(1).max(50), severity: z.enum(['info', 'low', 'medium', 'high', 'critical']), affected_files: jsonText(100_000), proposed_changes: z.string().max(200_000), expected_benefits: jsonText(100_000).default('[]'), complexity: z.enum(['low', 'medium', 'high']).default('medium'), risk: z.enum(['low', 'medium', 'high']).default('medium'), status: z.enum(suggestionStatuses), result: z.string().max(20_000).nullable().default(null), created_at: timestamp, updated_at: timestamp }).strict()
const decision = z.object({ id: uuid, suggestion_id: uuid, status: z.enum(suggestionStatuses), result: z.string().max(20_000).nullable().default(null), created_at: timestamp }).strict()
const settings = z.object({ model: z.string().max(100).optional(), sandbox: z.enum(['read-only', 'workspace-write']).optional(), approvalPolicy: z.enum(['untrusted', 'on-request']).optional(), codexPath: z.string().max(1_000).optional(), diagnosticMode: z.enum(['true', 'false']).optional(), theme: z.literal('dark').optional(), defaultAgentMode: z.enum(agentModes).optional() }).strict()

export const backupSchema = z.object({ schemaVersion: z.number().int().min(1).max(6), exportedAt: timestamp.optional(), conversations: z.array(conversation).max(25_000), workspaces: z.array(workspace).max(5_000), messages: z.array(message).max(100_000), artifacts: z.array(artifact).max(50_000), memories: z.array(memory).max(5_000), suggestions: z.array(suggestion).max(25_000).default([]), suggestionDecisions: z.array(decision).max(50_000).default([]), settings: settings.optional() }).strict().superRefine((data, context) => {
  const totalRecords = data.conversations.length + data.workspaces.length + data.messages.length + data.artifacts.length + data.memories.length + data.suggestions.length + data.suggestionDecisions.length
  if (totalRecords > BACKUP_LIMITS.maxRecords) context.addIssue({ code: 'custom', message: `O backup excede o limite agregado de ${new Intl.NumberFormat('pt-BR').format(BACKUP_LIMITS.maxRecords)} registros.` })
  const conversations = new Set(data.conversations.map((item) => item.id))
  const workspaces = new Set(data.workspaces.map((item) => item.path))
  const suggestions = new Set(data.suggestions.map((item) => item.id))
  for (const [index, item] of data.conversations.entries()) if (!workspaces.has(item.workspace)) context.addIssue({ code: 'custom', path: ['conversations', index, 'workspace'], message: 'Workspace referenciado não existe no backup.' })
  for (const [index, item] of data.messages.entries()) if (!conversations.has(item.conversation_id)) context.addIssue({ code: 'custom', path: ['messages', index, 'conversation_id'], message: 'Conversa referenciada não existe no backup.' })
  for (const [index, item] of data.artifacts.entries()) { if (!conversations.has(item.conversation_id)) context.addIssue({ code: 'custom', path: ['artifacts', index, 'conversation_id'], message: 'Conversa referenciada não existe no backup.' }); if (!workspaces.has(item.workspace)) context.addIssue({ code: 'custom', path: ['artifacts', index, 'workspace'], message: 'Workspace referenciado não existe no backup.' }) }
  for (const [index, item] of data.memories.entries()) if (!workspaces.has(item.workspace)) context.addIssue({ code: 'custom', path: ['memories', index, 'workspace'], message: 'Workspace referenciado não existe no backup.' })
  for (const [index, item] of data.suggestions.entries()) { if (!conversations.has(item.conversation_id)) context.addIssue({ code: 'custom', path: ['suggestions', index, 'conversation_id'], message: 'Conversa referenciada não existe no backup.' }); if (!workspaces.has(item.workspace_id)) context.addIssue({ code: 'custom', path: ['suggestions', index, 'workspace_id'], message: 'Workspace referenciado não existe no backup.' }) }
  for (const [index, item] of data.suggestionDecisions.entries()) if (!suggestions.has(item.suggestion_id)) context.addIssue({ code: 'custom', path: ['suggestionDecisions', index, 'suggestion_id'], message: 'Sugestão referenciada não existe no backup.' })
})

export type BackupData = z.infer<typeof backupSchema>
