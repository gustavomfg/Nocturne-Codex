import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '../electron/database/Database'
import Sqlite from 'better-sqlite3'
import { migrations } from '../electron/database/migrations'

const directories: string[] = []
const create = () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-test-')); directories.push(directory); return new LocalDatabase(directory) }
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

describe('persistência SQLite', () => {
  it('mantém migrações incrementais, ordenadas e sem lacunas', () => {
    expect(migrations.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6])
  })
  it('persiste conversa, thread, mensagens, memória e artefatos', () => {
    const db = create(); const workspace = '/tmp/workspace'; const conversation = db.createConversation(workspace)
    db.setThread(conversation.id, 'thread-1'); db.addMessage(conversation.id, 'user', 'Olá'); db.setWorkspaceMemory(workspace, 'decisão'); db.addArtifact(conversation.id, workspace, 'markdown', 'Resposta', null, '# ok')
    expect(db.listConversations()[0].codexThreadId).toBe('thread-1')
    expect(db.listMessages(conversation.id)).toHaveLength(1)
    expect(db.getWorkspaceMemory(workspace).content).toBe('decisão')
    expect(db.listArtifacts(conversation.id)[0].type).toBe('markdown'); db.close()
  })
  it('pagina históricos extensos do mais recente para o mais antigo', () => {
    const db = create(); const conversation = db.createConversation('/tmp/history')
    for (let index = 0; index < 205; index += 1) db.addMessage(conversation.id, 'user', `Mensagem ${index}`)
    const latest = db.listMessagePage(conversation.id)
    const middle = db.listMessagePage(conversation.id, 100)
    const oldest = db.listMessagePage(conversation.id, 200)
    expect(latest.items.map((message) => message.content)).toEqual(Array.from({ length: 100 }, (_, index) => `Mensagem ${index + 105}`))
    expect(middle.items).toHaveLength(100); expect(middle.hasMore).toBe(true)
    expect(oldest.items.map((message) => message.content)).toEqual(Array.from({ length: 5 }, (_, index) => `Mensagem ${index}`))
    expect(oldest.hasMore).toBe(false); db.close()
  })
  it('consulta conversa diretamente e cria snapshot consistente do estado anterior', async () => {
    const db = create(); const conversation = db.createConversation('/tmp/snapshot'); db.addMessage(conversation.id, 'user', 'Antes da restauração')
    expect(db.getConversation(conversation.id)).toMatchObject({ id: conversation.id, workspace: '/tmp/snapshot' })
    expect(db.getConversation('00000000-0000-4000-8000-000000000099')).toBeNull()
    const snapshot = await db.createRecoverySnapshot(); const recovered = new Sqlite(snapshot, { readonly: true })
    expect((recovered.prepare('SELECT content FROM messages WHERE conversation_id=?').get(conversation.id) as { content: string }).content).toBe('Antes da restauração')
    expect(fs.statSync(snapshot).mode & 0o777).toBe(0o600)
    recovered.close(); db.close()
  })
  it('exporta e importa um fluxo completo restaurável', () => {
    const source = create(); const conversation = source.createConversation('/tmp/project'); source.addMessage(conversation.id, 'assistant', 'Resposta simulada'); source.setSettings({ theme: 'dark', model: 'modelo-teste' }); const data = source.exportData(); source.close()
    const target = create(); target.importData(data); expect(target.listConversations()).toHaveLength(1); expect(target.listMessages(conversation.id)[0].content).toBe('Resposta simulada'); expect(target.getSettings().model).toBe('modelo-teste'); expect(target.listWorkspaces()[0].authorized).toBe(false); target.close()
  })
  it('substitui dados locais ao restaurar em vez de mesclar históricos', () => {
    const source = create(); const restored = source.createConversation('/tmp/restored'); const data = source.exportData(); source.close()
    const target = create(); target.createConversation('/tmp/old'); target.importData(data)
    expect(target.listConversations().map((item) => item.id)).toEqual([restored.id])
    target.close()
  })
  it('ignora colunas desconhecidas em backups sem executar SQL arbitrário', () => {
    const db = create(); const conversation = db.createConversation('/tmp/project'); const data = db.exportData()
    data.conversations[0] = { ...(data.conversations[0] as object), 'invalid_column': 'ignorada' }
    expect(() => db.importData(data)).not.toThrow()
    expect(db.listConversations().some((item) => item.id === conversation.id)).toBe(true)
    db.close()
  })
  it('migra um schema antigo atomicamente e atualiza a versão somente ao final', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-test-')); directories.push(directory)
    const file = path.join(directory, 'nocturne.db')
    const legacy = new Sqlite(file)
    legacy.exec('CREATE TABLE conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, workspace TEXT NOT NULL, codex_thread_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); PRAGMA user_version = 1;')
    legacy.close()
    const db = new LocalDatabase(directory)
    db.close()
    const migrated = new Sqlite(file, { readonly: true })
    expect(migrated.pragma('user_version', { simple: true })).toBe(6)
    const tables = migrated.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
    expect(tables.map((item) => item.name)).toContain('suggestions')
    expect(tables.map((item) => item.name)).toContain('workspace_memory')
    migrated.close()
  })
  it('atualiza um snapshot v4 adicionando somente as colunas da v5', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-test-')); directories.push(directory)
    const file = path.join(directory, 'nocturne.db'); const legacy = new Sqlite(file)
    legacy.exec(`CREATE TABLE suggestions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, conversation_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, reasoning TEXT NOT NULL, category TEXT NOT NULL, severity TEXT NOT NULL, affected_files TEXT NOT NULL, proposed_changes TEXT NOT NULL, status TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); PRAGMA user_version = 4;`)
    migrations.find((migration) => migration.version === 5)!.up(legacy); legacy.pragma('user_version = 5'); legacy.close()
    const migrated = new Sqlite(file, { readonly: true }); const columns = migrated.prepare('PRAGMA table_info(suggestions)').all() as Array<{ name: string }>
    expect(columns.map((item) => item.name)).toEqual(expect.arrayContaining(['expected_benefits', 'complexity', 'risk']))
    expect(migrated.pragma('user_version', { simple: true })).toBe(5); migrated.close()
  })
})
