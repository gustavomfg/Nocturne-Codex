import { z } from 'zod'
import { agentModes, suggestionStatuses } from '../suggestions'
import { PERSISTENCE_LIMITS } from '../constants'

export const idSchema = z.string().uuid()
export const pageSchema = z.object({ offset: z.number().int().min(0).max(1_000_000), limit: z.number().int().min(1).max(200) }).strict()
export const conversationPageSchema = pageSchema.extend({ conversationId: idSchema })
export const codexSendSchema = z.object({ conversationId: idSchema, prompt: z.string().trim().min(1).max(100_000), attachments: z.array(z.string()).max(10).default([]), mode: z.enum(agentModes).default('build') })
export const approvalSchema = z.object({ key: z.string().min(1), accepted: z.boolean(), forSession: z.boolean().optional() })
export const workspaceFavoriteSchema = z.object({ workspace: z.string().min(1), favorite: z.boolean() })
export const workspaceToolSchema = z.object({ workspace: z.string().min(1), tool: z.enum(['editor', 'terminal']) })
export const fileActionSchema = z.object({ conversationId: idSchema, filePath: z.string().min(1), action: z.enum(['file', 'folder', 'editor']) })
export const filePreviewSchema = z.object({ conversationId: idSchema, filePath: z.string().min(1) })
export const suggestionStatusSchema = z.object({ conversationId: idSchema, suggestionId: idSchema, status: z.enum(suggestionStatuses), result: z.string().max(20_000).optional() })
export const gitCommitSchema = z.object({ conversationId: idSchema, message: z.string().trim().min(1).max(200), files: z.array(z.string().min(1).max(4_000)).min(1).max(1_000) })
export const saveAssistantSchema = z.object({ conversationId: idSchema, content: z.string().max(PERSISTENCE_LIMITS.assistantCharacters), metadata: z.unknown().optional() })
export const saveMarkdownSchema = z.object({ conversationId: idSchema, content: z.string().max(PERSISTENCE_LIMITS.documentCharacters), name: z.string().trim().min(1).max(PERSISTENCE_LIMITS.documentNameCharacters).default('documento.md') })
export const exportDocumentSchema = z.object({ conversationId: idSchema, content: z.string().max(PERSISTENCE_LIMITS.documentCharacters), format: z.enum(['docx', 'pdf', 'html']) })
