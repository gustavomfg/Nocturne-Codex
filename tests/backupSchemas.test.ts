import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { backupSchema } from '../shared/ipc/backupSchemas'
import { assertBackupByteLimit, assertBackupRecordLimit, BACKUP_LIMITS } from '../shared/ipc/backupLimits'
import { parseBackupInWorker, serializeBackupInWorker } from '../electron/ipc/backupWorkers'

const now = new Date().toISOString()
const workspace = { path: '/tmp/project', name: 'project', favorite: 0 as const, created_at: now, last_opened_at: now }
const conversation = { id: randomUUID(), title: 'Teste', workspace: workspace.path, codex_thread_id: null, created_at: now, updated_at: now }
const valid = () => ({ schemaVersion: 5, exportedAt: now, workspaces: [workspace], conversations: [conversation], messages: [], artifacts: [], memories: [], suggestions: [], suggestionDecisions: [], settings: { theme: 'dark' as const } })
const temporaryFiles: string[] = []

afterEach(() => { for (const file of temporaryFiles.splice(0)) fs.rmSync(file, { force: true }) })

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
    expect(() => backupSchema.parse({ ...data, conversations: [{ ...conversation, workspace: '/tmp/unknown' }] })).toThrow(/Workspace referenciado não existe/)
  })
  it('rejeita identificadores duplicados antes da restauração', () => {
    const data = valid()
    expect(() => backupSchema.parse({ ...data, conversations: [conversation, conversation] })).toThrow(/duplicados/)
  })

  it('rejeita UUIDs, enums e JSON serializado inválidos', () => {
    const data = valid()
    expect(() => backupSchema.parse({ ...data, conversations: [{ ...conversation, id: 'not-a-uuid' }] })).toThrow()
    const message = { id: randomUUID(), conversation_id: conversation.id, role: 'owner', content: 'x', metadata: '{', created_at: now }
    expect(() => backupSchema.parse({ ...data, messages: [message] })).toThrow()
  })

  it('usa uma única fronteira agregada em todos os limites relevantes', () => {
    expect(() => assertBackupRecordLimit({ messages: new Array(50_000) })).not.toThrow()
    expect(() => assertBackupRecordLimit({ messages: new Array(50_001) })).not.toThrow()
    expect(() => assertBackupRecordLimit({ messages: new Array(BACKUP_LIMITS.maxRecords) })).not.toThrow()
    expect(() => assertBackupRecordLimit({ messages: new Array(BACKUP_LIMITS.maxRecords + 1) })).toThrow(/200\.000 registros/)
    expect(() => assertBackupByteLimit(BACKUP_LIMITS.maxBytes)).not.toThrow()
    expect(() => assertBackupByteLimit(BACKUP_LIMITS.maxBytes + 1)).toThrow(/25 MB/)
  })

  it('serializa e reabre no worker backups acima do antigo limite de 50.000 registros', async () => {
    const file = path.join(os.tmpdir(), `nocturne-backup-worker-${randomUUID()}.json`)
    temporaryFiles.push(file)
    const serialized = await serializeBackupInWorker({ messages: new Array(50_001).fill(null) })
    fs.writeFileSync(file, serialized)
    const parsed = await parseBackupInWorker(file) as { messages: unknown[] }
    expect(parsed.messages).toHaveLength(50_001)
  })
})
