import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { backupSchema } from '../shared/ipc/backupSchemas'

const now = new Date().toISOString()
const workspace = { path: '/tmp/project', name: 'project', favorite: 0 as const, created_at: now, last_opened_at: now }
const conversation = { id: randomUUID(), title: 'Teste', workspace: workspace.path, codex_thread_id: null, created_at: now, updated_at: now }
const valid = () => ({ schemaVersion: 5, exportedAt: now, workspaces: [workspace], conversations: [conversation], messages: [], artifacts: [], memories: [], suggestions: [], suggestionDecisions: [], settings: { theme: 'dark' as const } })

describe('schema de backup', () => {
  it('aceita um backup válido e aplica defaults seguros', () => {
    expect(backupSchema.parse(valid())).toMatchObject({ schemaVersion: 5, conversations: [{ id: conversation.id }] })
  })

  it('rejeita campos desconhecidos e conteúdo excessivo', () => {
    expect(() => backupSchema.parse({ ...valid(), unexpected: true })).toThrow()
    expect(() => backupSchema.parse({ ...valid(), conversations: [{ ...conversation, title: 'x'.repeat(501) }] })).toThrow()
  })

  it('rejeita referências órfãs antes de tocar no banco', () => {
    const data = valid()
    const message = { id: randomUUID(), conversation_id: randomUUID(), role: 'user' as const, content: 'órfã', metadata: null, created_at: now }
    expect(() => backupSchema.parse({ ...data, messages: [message] })).toThrow(/Conversa referenciada não existe/)
  })

  it('rejeita UUIDs, enums e JSON serializado inválidos', () => {
    const data = valid()
    expect(() => backupSchema.parse({ ...data, conversations: [{ ...conversation, id: 'not-a-uuid' }] })).toThrow()
    const message = { id: randomUUID(), conversation_id: conversation.id, role: 'owner', content: 'x', metadata: '{', created_at: now }
    expect(() => backupSchema.parse({ ...data, messages: [message] })).toThrow()
  })
})
