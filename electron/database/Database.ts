import Database from 'better-sqlite3'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import type { Suggestion, SuggestionStatus } from '../../shared/suggestions'
import type { BrainMemory, BrainMemoryCandidate, CreateBrainMemoryInput, UpdateBrainMemoryInput } from '../../shared/brainMemory'
import { DATABASE_SCHEMA_VERSION } from '../../shared/constants'
import { migrateDatabase } from './migrations'
import { ProviderConfigurationRepository } from './ProviderConfigurationRepository'
import { ModelCatalogRepository } from './ModelCatalogRepository'
import { WorkspaceModelBindingRepository } from './WorkspaceModelBindingRepository'

export interface ConversationRow {
  id: string
  title: string
  workspace: string
  codexThreadId: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageRow {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: string | null
  createdAt: string
}

export interface WorkspaceRow { path: string; name: string; favorite: boolean; authorized: boolean; createdAt: string; lastOpenedAt: string }
export interface ArtifactRow { id: string; conversationId: string; workspace: string; type: string; title: string; filePath: string | null; content: string | null; metadata: string | null; createdAt: string; updatedAt: string }

const importColumns: Record<string, ReadonlySet<string>> = {
  workspaces: new Set(['path', 'name', 'favorite', 'authorized', 'created_at', 'last_opened_at']),
  conversations: new Set(['id', 'title', 'workspace', 'codex_thread_id', 'created_at', 'updated_at']),
  messages: new Set(['id', 'conversation_id', 'role', 'content', 'metadata', 'created_at']),
  artifacts: new Set(['id', 'conversation_id', 'workspace', 'type', 'title', 'file_path', 'content', 'metadata', 'created_at', 'updated_at']),
  workspace_memory: new Set(['workspace', 'content', 'updated_at']),
  suggestions: new Set(['id', 'workspace_id', 'conversation_id', 'title', 'description', 'reasoning', 'category', 'severity', 'affected_files', 'proposed_changes', 'expected_benefits', 'complexity', 'risk', 'status', 'result', 'created_at', 'updated_at']),
  suggestion_decisions: new Set(['id', 'suggestion_id', 'status', 'result', 'created_at']),
  brain_memories: new Set(['id', 'workspace_id', 'conversation_id', 'kind', 'scope', 'status', 'content', 'confidence', 'source_type', 'source_id', 'created_at', 'updated_at', 'last_confirmed_at', 'last_used_at', 'use_count']),
  provider_configs: new Set(['id', 'provider_type', 'display_name', 'source', 'base_url', 'enabled', 'requires_authentication', 'timeout_ms', 'created_at', 'updated_at']),
  model_catalog: new Set(['provider_id', 'model_id', 'descriptor', 'updated_at']),
  workspace_model_bindings: new Set(['workspace_id', 'bindings', 'updated_at']),
}

export class LocalDatabase {
  private db: Database.Database
  private readonly databasePath: string
  readonly providerConfigurations: ProviderConfigurationRepository
  readonly modelCatalog: ModelCatalogRepository
  readonly workspaceModelBindings: WorkspaceModelBindingRepository

  constructor(userDataPath: string) {
    this.databasePath = path.join(userDataPath, 'nocturne.db')
    this.db = new Database(this.databasePath)
    const schemaVersion = this.db.pragma('user_version', { simple: true }) as number
    if (schemaVersion > DATABASE_SCHEMA_VERSION) {
      this.db.close()
      throw new Error(`Este banco usa o schema ${schemaVersion}, mas esta versão do Nocturne suporta até o schema ${DATABASE_SCHEMA_VERSION}. Atualize o aplicativo antes de abrir estes dados.`)
    }
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('temp_store = MEMORY')
    if (schemaVersion > 0 && schemaVersion < DATABASE_SCHEMA_VERSION && fs.existsSync(this.databasePath)) {
      this.db.pragma('wal_checkpoint(FULL)')
      const backupPath = `${this.databasePath}.backup-${Date.now()}`
      fs.copyFileSync(this.databasePath, backupPath)
      fs.chmodSync(backupPath, 0o600)
    }
    migrateDatabase(this.db, schemaVersion)
    this.providerConfigurations = new ProviderConfigurationRepository(this.db)
    this.modelCatalog = new ModelCatalogRepository(this.db)
    this.workspaceModelBindings = new WorkspaceModelBindingRepository(this.db)
    this.runScheduledIntegrityCheck()
    this.cleanupOrphans()
  }

  listConversations(): ConversationRow[] {
    return this.db.prepare(`SELECT id, title, workspace, codex_thread_id codexThreadId,
      created_at createdAt, updated_at updatedAt FROM conversations ORDER BY updated_at DESC`).all() as ConversationRow[]
  }

  listConversationPage(offset = 0, limit = 100) {
    const rows = this.db.prepare(`SELECT id, title, workspace, codex_thread_id codexThreadId,
      created_at createdAt, updated_at updatedAt FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(limit + 1, offset) as ConversationRow[]
    return { items: rows.slice(0, limit), hasMore: rows.length > limit }
  }

  getConversation(id: string): ConversationRow | null {
    return this.db.prepare(`SELECT id, title, workspace, codex_thread_id codexThreadId,
      created_at createdAt, updated_at updatedAt FROM conversations WHERE id=?`).get(id) as ConversationRow | undefined ?? null
  }

  async createRecoverySnapshot(retain = 5) {
    const directory = path.join(path.dirname(this.databasePath), 'backups')
    await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const destination = path.join(directory, `nocturne-before-restore-${timestamp}.db`)
    try {
      await this.db.backup(destination)
      await fs.promises.chmod(destination, 0o600)
      const snapshots = (await fs.promises.readdir(directory)).filter((name) => name.startsWith('nocturne-before-restore-') && name.endsWith('.db')).sort().reverse()
      await Promise.all(snapshots.slice(Math.max(1, retain)).map((name) => fs.promises.unlink(path.join(directory, name))))
      return destination
    } catch (error) {
      await fs.promises.unlink(destination).catch(() => undefined)
      throw new Error(`Não foi possível criar o ponto de recuperação: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  createConversation(workspace: string): ConversationRow {
    this.touchWorkspace(workspace)
    const now = new Date().toISOString()
    const row = { id: randomUUID(), title: 'Nova conversa', workspace, codexThreadId: null, createdAt: now, updatedAt: now }
    this.db.prepare(`INSERT INTO conversations (id,title,workspace,created_at,updated_at) VALUES (@id,@title,@workspace,@createdAt,@updatedAt)`).run(row)
    return row
  }

  setThread(id: string, threadId: string) {
    this.db.prepare('UPDATE conversations SET codex_thread_id=?, updated_at=? WHERE id=?').run(threadId, new Date().toISOString(), id)
  }

  clearThread(id: string) { this.db.prepare('UPDATE conversations SET codex_thread_id=NULL WHERE id=?').run(id) }

  listWorkspaces(): WorkspaceRow[] {
    const rows = this.db.prepare(`SELECT path, name, favorite, authorized, created_at createdAt, last_opened_at lastOpenedAt
      FROM workspaces ORDER BY favorite DESC, last_opened_at DESC`).all() as Array<Omit<WorkspaceRow, 'favorite' | 'authorized'> & { favorite: number; authorized: number }>
    return rows.map((row) => ({ ...row, favorite: Boolean(row.favorite), authorized: Boolean(row.authorized) }))
  }

  touchWorkspace(workspace: string) {
    const now = new Date().toISOString()
    this.db.prepare(`INSERT INTO workspaces(path,name,authorized,created_at,last_opened_at) VALUES(?,?,1,?,?)
      ON CONFLICT(path) DO UPDATE SET name=excluded.name,authorized=1,last_opened_at=excluded.last_opened_at`)
      .run(workspace, path.basename(workspace), now, now)
  }

  removeWorkspace(workspace: string) { this.db.prepare('DELETE FROM workspaces WHERE path=?').run(workspace) }
  setWorkspaceFavorite(workspace: string, favorite: boolean) { this.db.prepare('UPDATE workspaces SET favorite=? WHERE path=?').run(favorite ? 1 : 0, workspace) }

  getSettings(): Record<string, string> {
    const rows = this.db.prepare("SELECT key,value FROM settings WHERE key NOT LIKE 'maintenance.%'").all() as Array<{ key: string; value: string }>
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    if (settings.approvalPolicy !== 'untrusted') settings.approvalPolicy = 'on-request'
    settings.theme = 'dark'
    return settings
  }

  setSettings(values: Record<string, string>) {
    const statement = this.db.prepare(`INSERT INTO settings(key,value) VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    this.db.transaction(() => Object.entries(values).forEach(([key, value]) => statement.run(key, value)))()
  }

  getWorkspaceMemory(workspace: string) {
    const row = this.db.prepare('SELECT content, updated_at updatedAt FROM workspace_memory WHERE workspace=?').get(workspace) as { content: string; updatedAt: string } | undefined
    return row ?? { content: '', updatedAt: '' }
  }

  setWorkspaceMemory(workspace: string, content: string) {
    const updatedAt = new Date().toISOString()
    this.db.prepare(`INSERT INTO workspace_memory(workspace,content,updated_at) VALUES(?,?,?)
      ON CONFLICT(workspace) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at`).run(workspace, content, updatedAt)
    return { content, updatedAt }
  }

  createBrainMemory(workspaceId: string, value: CreateBrainMemoryInput): BrainMemory {
    const conversationId = value.scope === 'conversation' ? value.conversationId ?? null : null
    this.assertBrainMemoryScope(workspaceId, value.scope, conversationId)
    const now = new Date().toISOString()
    const row: BrainMemory = {
      id: randomUUID(), workspaceId, conversationId, kind: value.kind, scope: value.scope,
      status: value.status ?? 'candidate', content: value.content.trim(), confidence: value.confidence ?? 70,
      sourceType: value.sourceType ?? 'manual', sourceId: value.sourceId ?? null,
      createdAt: now, updatedAt: now, lastConfirmedAt: value.status === 'active' ? now : null,
      lastUsedAt: null, useCount: 0,
    }
    this.db.prepare(`INSERT INTO brain_memories(id,workspace_id,conversation_id,kind,scope,status,content,confidence,source_type,source_id,created_at,updated_at,last_confirmed_at,last_used_at,use_count)
      VALUES(@id,@workspaceId,@conversationId,@kind,@scope,@status,@content,@confidence,@sourceType,@sourceId,@createdAt,@updatedAt,@lastConfirmedAt,@lastUsedAt,@useCount)`).run(row)
    return row
  }

  updateBrainMemory(id: string, workspaceId: string, value: UpdateBrainMemoryInput): BrainMemory {
    const current = this.getBrainMemory(id, workspaceId)
    if (!current) throw new Error('Memória não encontrada.')
    const scope = value.scope ?? current.scope
    const conversationId = scope === 'conversation' ? value.conversationId === undefined ? current.conversationId : value.conversationId : null
    this.assertBrainMemoryScope(workspaceId, scope, conversationId)
    const status = value.status ?? current.status
    const transitions: Record<BrainMemory['status'], BrainMemory['status'][]> = {
      candidate: ['active', 'archived'], active: ['outdated', 'archived'], outdated: ['active', 'archived'], archived: ['active'],
    }
    if (status !== current.status && !transitions[current.status].includes(status)) throw new Error(`Transição de memória inválida: ${current.status} → ${status}.`)
    const updatedAt = new Date().toISOString()
    const next = {
      id, workspaceId, conversationId, kind: value.kind ?? current.kind, scope, status,
      content: value.content?.trim() ?? current.content, confidence: value.confidence ?? current.confidence,
      updatedAt, lastConfirmedAt: status === 'active' && current.status !== 'active' ? updatedAt : current.lastConfirmedAt,
    }
    this.db.prepare(`UPDATE brain_memories SET conversation_id=@conversationId,kind=@kind,scope=@scope,status=@status,content=@content,confidence=@confidence,updated_at=@updatedAt,last_confirmed_at=@lastConfirmedAt WHERE id=@id AND workspace_id=@workspaceId`).run(next)
    return this.getBrainMemory(id, workspaceId) as BrainMemory
  }

  deleteBrainMemory(id: string, workspaceId: string) {
    return this.db.prepare('DELETE FROM brain_memories WHERE id=? AND workspace_id=?').run(id, workspaceId).changes > 0
  }

  getBrainMemory(id: string, workspaceId: string): BrainMemory | null {
    const row = this.db.prepare(`${brainMemorySelect} WHERE id=? AND workspace_id=?`).get(id, workspaceId) as BrainMemory | undefined
    return row ?? null
  }

  findEquivalentBrainMemory(workspaceId: string, scope: BrainMemory['scope'], conversationId: string | null, content: string): BrainMemory | null {
    const row = this.db.prepare(`${brainMemorySelect} WHERE workspace_id=? AND scope=? AND conversation_id IS ? AND content=? COLLATE NOCASE AND status IN ('candidate','active') LIMIT 1`).get(workspaceId, scope, conversationId, content.trim()) as BrainMemory | undefined
    return row ?? null
  }

  createBrainMemoryCandidates(workspaceId: string, currentConversationId: string, candidates: BrainMemoryCandidate[]) {
    return this.db.transaction(() => candidates.flatMap((candidate) => {
      const conversationId = candidate.scope === 'conversation' ? currentConversationId : null
      if (this.findEquivalentBrainMemory(workspaceId, candidate.scope, conversationId, candidate.content)) return []
      return [this.createBrainMemory(workspaceId, { ...candidate, conversationId: conversationId ?? undefined, sourceType: 'agent', status: 'candidate' })]
    }))()
  }

  listBrainMemoryPage(workspaceId: string, offset = 0, limit = 50, query = '', status?: BrainMemory['status']) {
    const search = buildFtsQuery(query)
    const statusFilter = status ? ' AND memory.status=@status' : ''
    if (search) {
      const rows = this.db.prepare(`${brainMemorySearchSelect} WHERE memory.workspace_id=@workspaceId${statusFilter} AND brain_memories_fts MATCH @search ORDER BY bm25(brain_memories_fts), memory.updated_at DESC LIMIT @fetch OFFSET @offset`).all({ workspaceId, status, search, fetch: limit + 1, offset }) as BrainMemory[]
      return { items: rows.slice(0, limit), hasMore: rows.length > limit }
    }
    const rows = this.db.prepare(`${brainMemorySelect} WHERE workspace_id=@workspaceId${status ? ' AND status=@status' : ''} ORDER BY updated_at DESC LIMIT @fetch OFFSET @offset`).all({ workspaceId, status, fetch: limit + 1, offset }) as BrainMemory[]
    return { items: rows.slice(0, limit), hasMore: rows.length > limit }
  }

  retrieveBrainMemories(workspaceId: string, conversationId: string, query: string, limit = 8): BrainMemory[] {
    const search = buildFtsQuery(query)
    if (!search) return []
    return this.db.prepare(`${brainMemorySearchSelect} WHERE memory.workspace_id=@workspaceId AND memory.status='active' AND (memory.scope='workspace' OR memory.conversation_id=@conversationId) AND brain_memories_fts MATCH @search ORDER BY bm25(brain_memories_fts), memory.confidence DESC, memory.updated_at DESC LIMIT @limit`).all({ workspaceId, conversationId, search, limit }) as BrainMemory[]
  }

  markBrainMemoriesUsed(ids: string[]) {
    const unique = [...new Set(ids)].slice(0, 50)
    if (!unique.length) return
    this.db.prepare(`UPDATE brain_memories SET last_used_at=?,use_count=use_count+1 WHERE id IN (${unique.map(() => '?').join(',')})`).run(new Date().toISOString(), ...unique)
  }

  private assertBrainMemoryScope(workspaceId: string, scope: BrainMemory['scope'], conversationId: string | null) {
    if (scope === 'workspace' && conversationId) throw new Error('Memória do workspace não pode pertencer a uma conversa.')
    if (scope === 'conversation') {
      if (!conversationId) throw new Error('Memória da conversa exige uma conversa válida.')
      const conversation = this.getConversation(conversationId)
      if (!conversation || conversation.workspace !== workspaceId) throw new Error('A conversa da memória não pertence ao workspace atual.')
    }
  }

  listArtifacts(conversationId: string): ArtifactRow[] {
    return this.db.prepare(`SELECT id,conversation_id conversationId,workspace,type,title,file_path filePath,
      content,metadata,created_at createdAt,updated_at updatedAt FROM artifacts
      WHERE conversation_id=? ORDER BY updated_at DESC`).all(conversationId) as ArtifactRow[]
  }

  listArtifactPage(conversationId: string, offset = 0, limit = 50) {
    const rows = this.db.prepare(`SELECT id,conversation_id conversationId,workspace,type,title,file_path filePath,
      content,metadata,created_at createdAt,updated_at updatedAt FROM artifacts
      WHERE conversation_id=? ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(conversationId, limit + 1, offset) as ArtifactRow[]
    return { items: rows.slice(0, limit), hasMore: rows.length > limit }
  }

  addArtifact(conversationId: string, workspace: string, type: string, title: string, filePath?: string | null, content?: string | null, metadata?: unknown) {
    const now = new Date().toISOString()
    const existing = filePath ? this.db.prepare('SELECT id,created_at createdAt FROM artifacts WHERE conversation_id=? AND file_path=? ORDER BY updated_at DESC LIMIT 1').get(conversationId, filePath) as { id: string; createdAt: string } | undefined : undefined
    const row: ArtifactRow = { id: existing?.id ?? randomUUID(), conversationId, workspace, type, title, filePath: filePath ?? null, content: content ?? null, metadata: metadata ? JSON.stringify(metadata) : null, createdAt: existing?.createdAt ?? now, updatedAt: now }
    this.db.prepare(`INSERT INTO artifacts(id,conversation_id,workspace,type,title,file_path,content,metadata,created_at,updated_at)
      VALUES(@id,@conversationId,@workspace,@type,@title,@filePath,@content,@metadata,@createdAt,@updatedAt)
      ON CONFLICT(id) DO UPDATE SET type=excluded.type,title=excluded.title,content=excluded.content,metadata=excluded.metadata,updated_at=excluded.updated_at`).run(row)
    return row
  }

  deleteArtifact(id: string, conversationId: string) {
    return this.db.prepare('DELETE FROM artifacts WHERE id=? AND conversation_id=?').run(id, conversationId).changes > 0
  }
  recordApproval(key: string, accepted: boolean, command?: string, risk?: string) { this.db.prepare('INSERT INTO approval_audit(id,approval_key,decision,command,risk,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(), key, accepted ? 'accepted' : 'declined', command?.slice(0, 4_000) ?? null, risk ?? null, new Date().toISOString()) }

  listSuggestions(conversationId: string): Suggestion[] {
    const rows = this.db.prepare(`SELECT id,workspace_id workspaceId,conversation_id conversationId,title,description,reasoning,category,severity,affected_files affectedFiles,proposed_changes proposedChanges,expected_benefits expectedBenefits,complexity,risk,status,created_at createdAt,updated_at updatedAt FROM suggestions WHERE conversation_id=? ORDER BY updated_at DESC`).all(conversationId) as Array<Omit<Suggestion, 'affectedFiles' | 'expectedBenefits'> & { affectedFiles: string; expectedBenefits: string }>
    return rows.map((row) => ({ ...row, affectedFiles: JSON.parse(row.affectedFiles) as string[], expectedBenefits: JSON.parse(row.expectedBenefits) as string[] }))
  }

  listSuggestionPage(conversationId: string, offset = 0, limit = 50) {
    const rows = this.db.prepare(`SELECT id,workspace_id workspaceId,conversation_id conversationId,title,description,reasoning,category,severity,affected_files affectedFiles,proposed_changes proposedChanges,expected_benefits expectedBenefits,complexity,risk,status,created_at createdAt,updated_at updatedAt FROM suggestions WHERE conversation_id=? ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(conversationId, limit + 1, offset) as Array<Omit<Suggestion, 'affectedFiles' | 'expectedBenefits'> & { affectedFiles: string; expectedBenefits: string }>
    return { items: decodeSuggestions(rows.slice(0, limit)), hasMore: rows.length > limit }
  }

  getSuggestion(id: string, conversationId?: string): Suggestion | null {
    const row = this.db.prepare(`SELECT id,workspace_id workspaceId,conversation_id conversationId,title,description,reasoning,category,severity,affected_files affectedFiles,proposed_changes proposedChanges,expected_benefits expectedBenefits,complexity,risk,status,created_at createdAt,updated_at updatedAt FROM suggestions WHERE id=?${conversationId ? ' AND conversation_id=?' : ''}`).get(...(conversationId ? [id, conversationId] : [id])) as Omit<Suggestion, 'affectedFiles' | 'expectedBenefits'> & { affectedFiles: string; expectedBenefits: string } | undefined
    return row ? decodeSuggestions([row])[0] : null
  }

  addSuggestion(conversationId: string, workspaceId: string, value: Omit<Suggestion, 'id' | 'workspaceId' | 'conversationId' | 'createdAt' | 'updatedAt' | 'status'>): Suggestion {
    const now = new Date().toISOString()
    const row: Suggestion = { id: randomUUID(), workspaceId, conversationId, ...value, status: 'pending', createdAt: now, updatedAt: now }
    this.db.prepare(`INSERT INTO suggestions(id,workspace_id,conversation_id,title,description,reasoning,category,severity,affected_files,proposed_changes,expected_benefits,complexity,risk,status,created_at,updated_at) VALUES(@id,@workspaceId,@conversationId,@title,@description,@reasoning,@category,@severity,@affectedFiles,@proposedChanges,@expectedBenefits,@complexity,@risk,@status,@createdAt,@updatedAt)`).run({ ...row, affectedFiles: JSON.stringify(row.affectedFiles), expectedBenefits: JSON.stringify(row.expectedBenefits) })
    return row
  }

  setSuggestionStatus(id: string, status: SuggestionStatus, result?: string): Suggestion {
    const updatedAt = new Date().toISOString()
    const current = this.db.prepare('SELECT status FROM suggestions WHERE id=?').get(id) as { status: SuggestionStatus } | undefined
    if (!current) throw new Error('Sugestão não encontrada.')
    const allowed: Record<SuggestionStatus, SuggestionStatus[]> = { pending: ['accepted', 'rejected'], accepted: ['applied', 'rejected'], rejected: [], applied: [] }
    if (current.status !== status && !allowed[current.status].includes(status)) throw new Error(`Transição de sugestão inválida: ${current.status} → ${status}.`)
    const changed = this.db.prepare('UPDATE suggestions SET status=?,result=?,updated_at=? WHERE id=?').run(status, result?.slice(0, 20_000) ?? null, updatedAt, id)
    if (!changed.changes) throw new Error('Sugestão não encontrada.')
    this.db.prepare('INSERT INTO suggestion_decisions(id,suggestion_id,status,result,created_at) VALUES(?,?,?,?,?)').run(randomUUID(), id, status, result?.slice(0, 20_000) ?? null, updatedAt)
    const row = this.db.prepare('SELECT conversation_id conversationId FROM suggestions WHERE id=?').get(id) as { conversationId: string }
    return this.getSuggestion(id, row.conversationId) as Suggestion
  }

  exportData() {
    return { schemaVersion: DATABASE_SCHEMA_VERSION, exportedAt: new Date().toISOString(), conversations: this.db.prepare('SELECT * FROM conversations').all(), workspaces: this.db.prepare('SELECT * FROM workspaces').all(), messages: this.db.prepare('SELECT * FROM messages ORDER BY created_at').all(), artifacts: this.db.prepare('SELECT * FROM artifacts ORDER BY created_at').all(), memories: this.db.prepare('SELECT * FROM workspace_memory').all(), brainMemories: this.db.prepare('SELECT * FROM brain_memories ORDER BY created_at').all(), suggestions: this.db.prepare('SELECT * FROM suggestions').all(), suggestionDecisions: this.db.prepare('SELECT * FROM suggestion_decisions').all(), providerConfigs: this.db.prepare(`SELECT id,provider_type,display_name,source,base_url,enabled,requires_authentication,timeout_ms,created_at,updated_at FROM provider_configs ORDER BY created_at`).all(), modelCatalog: this.db.prepare('SELECT provider_id,model_id,descriptor,updated_at FROM model_catalog ORDER BY provider_id,model_id').all(), workspaceModelBindings: this.db.prepare('SELECT workspace_id,bindings,updated_at FROM workspace_model_bindings ORDER BY workspace_id').all(), settings: this.getSettings() }
  }

  importData(data: { conversations: unknown[]; workspaces: unknown[]; messages: unknown[]; artifacts: unknown[]; memories: unknown[]; brainMemories?: unknown[]; suggestions?: unknown[]; suggestionDecisions?: unknown[]; providerConfigs?: unknown[]; modelCatalog?: unknown[]; workspaceModelBindings?: unknown[]; settings?: Record<string, string> }) {
    const statements = new Map<string, Database.Statement>()
    const insert = (table: string, rows: unknown[]) => {
      const allowed = importColumns[table]
      if (!allowed) throw new Error(`Tabela de importação não permitida: ${table}.`)
      for (const raw of rows) {
        if (!raw || typeof raw !== 'object') continue
        const row = raw as Record<string, unknown>
        const keys = Object.keys(row).filter((key) => allowed.has(key))
        if (!keys.length) continue
        const signature = `${table}:${keys.join(',')}`
        let statement = statements.get(signature)
        if (!statement) {
          statement = this.db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((key) => `@${key}`).join(',')})`)
          statements.set(signature, statement)
        }
        statement.run(row)
      }
    }
    this.db.transaction(() => {
      this.db.exec('DELETE FROM workspace_model_bindings; DELETE FROM model_catalog; DELETE FROM provider_configs; DELETE FROM brain_memories; DELETE FROM suggestion_decisions; DELETE FROM suggestions; DELETE FROM artifacts; DELETE FROM messages; DELETE FROM conversations; DELETE FROM workspaces; DELETE FROM workspace_memory; DELETE FROM settings;')
      insert('workspaces', data.workspaces.map((row) => ({ ...(row as Record<string, unknown>), authorized: 0 }))); insert('conversations', data.conversations); insert('messages', data.messages); insert('artifacts', data.artifacts); insert('workspace_memory', data.memories); insert('brain_memories', data.brainMemories ?? []); insert('suggestions', data.suggestions ?? []); insert('suggestion_decisions', data.suggestionDecisions ?? []); insert('provider_configs', data.providerConfigs ?? []); insert('model_catalog', data.modelCatalog ?? []); insert('workspace_model_bindings', data.workspaceModelBindings ?? [])
      if (data.settings) this.setSettings(data.settings)
      this.cleanupOrphans()
    })()
  }

  private cleanupOrphans() {
    this.db.exec(`DELETE FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations); DELETE FROM artifacts WHERE conversation_id NOT IN (SELECT id FROM conversations); DELETE FROM suggestions WHERE conversation_id NOT IN (SELECT id FROM conversations); DELETE FROM suggestion_decisions WHERE suggestion_id NOT IN (SELECT id FROM suggestions); DELETE FROM brain_memories WHERE workspace_id NOT IN (SELECT path FROM workspaces) OR (conversation_id IS NOT NULL AND conversation_id NOT IN (SELECT id FROM conversations)); DELETE FROM workspace_model_bindings WHERE workspace_id NOT IN (SELECT path FROM workspaces);`)
  }

  private runScheduledIntegrityCheck() {
    const key = 'maintenance.lastQuickCheck'
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined
    const lastCheck = Date.parse(row?.value ?? '')
    if (Number.isFinite(lastCheck) && Date.now() - lastCheck < 7 * 24 * 60 * 60 * 1_000) return
    const integrity = this.db.pragma('quick_check', { simple: true }) as string
    if (integrity !== 'ok') throw new Error(`Banco de dados corrompido (${integrity}). Preserve o arquivo e restaure um backup.`)
    this.db.prepare(`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, new Date().toISOString())
  }

  renameFromPrompt(id: string, prompt: string) {
    const title = prompt.replace(/\s+/g, ' ').trim().slice(0, 52) || 'Nova conversa'
    this.db.prepare('UPDATE conversations SET title=?, updated_at=? WHERE id=?').run(title, new Date().toISOString(), id)
  }

  deleteConversation(id: string) { this.db.prepare('DELETE FROM conversations WHERE id=?').run(id) }

  listMessages(conversationId: string): MessageRow[] {
    return this.db.prepare(`SELECT id, conversation_id conversationId, role, content, metadata,
      created_at createdAt FROM messages WHERE conversation_id=? ORDER BY created_at, rowid`).all(conversationId) as MessageRow[]
  }

  listMessagePage(conversationId: string, offset = 0, limit = 100) {
    const rows = this.db.prepare(`SELECT id, conversation_id conversationId, role, content, metadata, created_at createdAt
      FROM messages WHERE conversation_id=? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`).all(conversationId, limit + 1, offset) as MessageRow[]
    return { items: rows.slice(0, limit).reverse(), hasMore: rows.length > limit }
  }

  addMessage(conversationId: string, role: MessageRow['role'], content: string, metadata?: unknown) {
    const row: MessageRow = { id: randomUUID(), conversationId, role, content, metadata: metadata ? JSON.stringify(metadata) : null, createdAt: new Date().toISOString() }
    this.db.prepare(`INSERT INTO messages (id,conversation_id,role,content,metadata,created_at)
      VALUES (@id,@conversationId,@role,@content,@metadata,@createdAt)`).run(row)
    this.db.prepare('UPDATE conversations SET updated_at=? WHERE id=?').run(row.createdAt, conversationId)
    return row
  }

  close() {
    if (!this.db.open) return
    this.db.pragma('optimize')
    this.db.pragma('wal_checkpoint(PASSIVE)')
    this.db.close()
  }
}

function decodeSuggestions(rows: Array<Omit<Suggestion, 'affectedFiles' | 'expectedBenefits'> & { affectedFiles: string; expectedBenefits: string }>) {
  return rows.map((row) => ({ ...row, affectedFiles: JSON.parse(row.affectedFiles) as string[], expectedBenefits: JSON.parse(row.expectedBenefits) as string[] }))
}

const brainMemoryColumns = (prefix = '') => `${prefix}id,${prefix}workspace_id workspaceId,${prefix}conversation_id conversationId,${prefix}kind,${prefix}scope,${prefix}status,${prefix}content,${prefix}confidence,${prefix}source_type sourceType,${prefix}source_id sourceId,${prefix}created_at createdAt,${prefix}updated_at updatedAt,${prefix}last_confirmed_at lastConfirmedAt,${prefix}last_used_at lastUsedAt,${prefix}use_count useCount`
const brainMemorySelect = `SELECT ${brainMemoryColumns()} FROM brain_memories`
const brainMemorySearchSelect = `SELECT ${brainMemoryColumns('memory.')} FROM brain_memories memory JOIN brain_memories_fts ON brain_memories_fts.rowid=memory.rowid`

function buildFtsQuery(value: string) {
  const tokens = value.normalize('NFKC').match(/[\p{L}\p{N}_-]{2,}/gu)?.slice(0, 12) ?? []
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' OR ')
}
