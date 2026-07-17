import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalDatabase } from '../electron/database/Database'
import Sqlite from 'better-sqlite3'
import { migrations } from '../electron/database/migrations'
import { DATABASE_SCHEMA_VERSION } from '../shared/constants'
import { PERSISTENCE_PERFORMANCE_BUDGETS } from '../shared/ipc/backupLimits'

const directories: string[] = []
const create = () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-test-')); directories.push(directory); return new LocalDatabase(directory) }
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

describe('persistência SQLite', () => {
  it('mantém migrações incrementais, ordenadas e sem lacunas', () => {
    expect(migrations.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(migrations[migrations.length - 1]?.version).toBe(DATABASE_SCHEMA_VERSION)
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
  it('pagina conversas, artefatos e sugestões sem materializar a coleção completa', () => {
    const db = create(); const workspace = '/tmp/collections'
    const conversations = Array.from({ length: 4 }, () => db.createConversation(workspace))
    for (let index = 0; index < 4; index += 1) db.addArtifact(conversations[0].id, workspace, 'markdown', `Artefato ${index}`)
    const suggestion = { title: 'Paginar', description: 'Coleção', reasoning: 'Limite', category: 'performance' as const, severity: 'medium' as const, affectedFiles: [], proposedChanges: 'page', expectedBenefits: [], complexity: 'low' as const, risk: 'low' as const }
    for (let index = 0; index < 4; index += 1) db.addSuggestion(conversations[0].id, workspace, { ...suggestion, title: `Sugestão ${index}` })
    expect(db.listConversationPage(0, 2)).toMatchObject({ hasMore: true, items: { length: 2 } })
    expect(db.listConversationPage(2, 2)).toMatchObject({ hasMore: false, items: { length: 2 } })
    expect(db.listArtifactPage(conversations[0].id, 0, 2)).toMatchObject({ hasMore: true, items: { length: 2 } })
    expect(db.listSuggestionPage(conversations[0].id, 2, 2)).toMatchObject({ hasMore: false, items: { length: 2 } })
    db.close()
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
    expect(migrated.pragma('user_version', { simple: true })).toBe(7)
    const tables = migrated.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
    expect(tables.map((item) => item.name)).toContain('suggestions')
    expect(tables.map((item) => item.name)).toContain('workspace_memory')
    migrated.close()
  })
  it('mantém índices de navegação e relacionamentos após a migração', () => {
    const db = create(); db.close()
    const directory = directories[directories.length - 1]
    const sqlite = new Sqlite(path.join(directory, 'nocturne.db'), { readonly: true })
    const indexes = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as Array<{ name: string }>
    expect(indexes.map((item) => item.name)).toEqual(expect.arrayContaining(['idx_conversations_updated', 'idx_workspaces_recent', 'idx_artifacts_file', 'idx_suggestion_decisions_suggestion']))
    sqlite.close()
  })
  it('migra o banco real da linha 0.7 sem perder conversas', () => {
    const db = create(); const conversation = db.createConversation('/tmp/from-0.7'); db.addMessage(conversation.id, 'user', 'Preservar'); db.close()
    const directory = directories[directories.length - 1]
    const file = path.join(directory, 'nocturne.db')
    const previous = new Sqlite(file)
    previous.exec('DROP INDEX idx_conversations_updated; DROP INDEX idx_workspaces_recent; DROP INDEX idx_artifacts_file; DROP INDEX idx_suggestion_decisions_suggestion; PRAGMA user_version = 6;')
    previous.close()
    const migrated = new LocalDatabase(directory)
    expect(migrated.listMessages(conversation.id)[0].content).toBe('Preservar')
    const migrationBackups = fs.readdirSync(directory).filter((name) => name.startsWith('nocturne.db.backup-'))
    expect(migrationBackups).toHaveLength(1)
    expect(fs.statSync(path.join(directory, migrationBackups[0])).mode & 0o777).toBe(0o600)
    migrated.close()
    const verified = new Sqlite(file, { readonly: true })
    expect(verified.pragma('user_version', { simple: true })).toBe(7)
    verified.close()
  })
  it('recusa schema futuro antes de executar manutenção ou migrações', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nocturne-test-')); directories.push(directory)
    const file = path.join(directory, 'nocturne.db')
    const future = new Sqlite(file)
    future.pragma('user_version = 8')
    future.close()
    expect(() => new LocalDatabase(directory)).toThrow(/schema 8.*suporta até o schema 7/)
    const preserved = new Sqlite(file, { readonly: true })
    expect(preserved.pragma('user_version', { simple: true })).toBe(8)
    preserved.close()
  })
  it('reverte integralmente uma restauração inválida', () => {
    const db = create(); const existing = db.createConversation('/tmp/existing'); db.addMessage(existing.id, 'user', 'Estado anterior')
    const now = new Date().toISOString()
    expect(() => db.importData({
      workspaces: [{ path: '/tmp/import', name: 'import', favorite: 0, authorized: 0, created_at: now, last_opened_at: now }],
      conversations: [{ id: '00000000-0000-4000-8000-000000000001', workspace: '/tmp/import', created_at: now, updated_at: now }],
      messages: [], artifacts: [], memories: [], suggestions: [], suggestionDecisions: [],
    })).toThrow()
    expect(db.listConversations().map((item) => item.id)).toContain(existing.id)
    expect(db.listMessages(existing.id)[0].content).toBe('Estado anterior')
    db.close()
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
  it('restaura e pagina a carga representativa dentro do orçamento de release', () => {
    const workspace = '/tmp/performance'
    const conversationId = '00000000-0000-4000-8000-000000000001'
    const now = new Date().toISOString()
    const messages = Array.from({ length: PERSISTENCE_PERFORMANCE_BUDGETS.representativeRestoreRecords }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`,
      conversation_id: conversationId,
      role: 'assistant',
      content: `Mensagem de desempenho ${index} ${'x'.repeat(256)}`,
      metadata: null,
      created_at: new Date(Date.parse(now) + index).toISOString(),
    }))
    const db = create()
    const importStarted = performance.now()
    db.importData({
      workspaces: [{ path: workspace, name: 'performance', favorite: 0, authorized: 1, created_at: now, last_opened_at: now }],
      conversations: [{ id: conversationId, title: 'Carga', workspace, codex_thread_id: null, created_at: now, updated_at: now }],
      messages,
      artifacts: [], memories: [], suggestions: [], suggestionDecisions: [], settings: { theme: 'dark' },
    })
    const importDuration = performance.now() - importStarted
    const pageStarted = performance.now()
    const page = db.listMessagePage(conversationId)
    const pageDuration = performance.now() - pageStarted
    expect(page.items).toHaveLength(100)
    expect(importDuration).toBeLessThan(PERSISTENCE_PERFORMANCE_BUDGETS.restoreMs)
    expect(pageDuration).toBeLessThan(PERSISTENCE_PERFORMANCE_BUDGETS.firstPageMs)
    db.close()
  }, 10_000)
})
