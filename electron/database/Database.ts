import Database from 'better-sqlite3'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import type { Suggestion, SuggestionStatus } from '../../shared/suggestions'

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

export interface WorkspaceRow { path: string; name: string; favorite: boolean; createdAt: string; lastOpenedAt: string }
export interface ArtifactRow { id: string; conversationId: string; workspace: string; type: string; title: string; filePath: string | null; content: string | null; metadata: string | null; createdAt: string; updatedAt: string }

const importColumns: Record<string, ReadonlySet<string>> = {
  workspaces: new Set(['path', 'name', 'favorite', 'created_at', 'last_opened_at']),
  conversations: new Set(['id', 'title', 'workspace', 'codex_thread_id', 'created_at', 'updated_at']),
  messages: new Set(['id', 'conversation_id', 'role', 'content', 'metadata', 'created_at']),
  artifacts: new Set(['id', 'conversation_id', 'workspace', 'type', 'title', 'file_path', 'content', 'metadata', 'created_at', 'updated_at']),
  workspace_memory: new Set(['workspace', 'content', 'updated_at']),
  suggestions: new Set(['id', 'workspace_id', 'conversation_id', 'title', 'description', 'reasoning', 'category', 'severity', 'affected_files', 'proposed_changes', 'expected_benefits', 'complexity', 'risk', 'status', 'result', 'created_at', 'updated_at']),
  suggestion_decisions: new Set(['id', 'suggestion_id', 'status', 'result', 'created_at']),
}

export class LocalDatabase {
  private db: Database.Database
  private readonly databasePath: string

  constructor(userDataPath: string) {
    this.databasePath = path.join(userDataPath, 'nocturne.db')
    this.db = new Database(this.databasePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    const integrity = this.db.pragma('quick_check', { simple: true }) as string
    if (integrity !== 'ok') throw new Error(`Banco de dados corrompido (${integrity}). Preserve o arquivo e restaure um backup.`)
    const schemaVersion = this.db.pragma('user_version', { simple: true }) as number
    if (schemaVersion < 5 && fs.existsSync(this.databasePath)) {
      fs.copyFileSync(this.databasePath, `${this.databasePath}.backup-${Date.now()}`)
    }
    const migrateToVersion5 = this.db.transaction(() => {
      this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, workspace TEXT NOT NULL,
        codex_thread_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
        content TEXT NOT NULL, metadata TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
      CREATE TABLE IF NOT EXISTS workspaces (
        path TEXT PRIMARY KEY, name TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_opened_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workspace_memory (
        workspace TEXT PRIMARY KEY, content TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, workspace TEXT NOT NULL,
        type TEXT NOT NULL, title TEXT NOT NULL, file_path TEXT, content TEXT, metadata TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_artifacts_conversation ON artifacts(conversation_id, updated_at);
      CREATE TABLE IF NOT EXISTS approval_audit (
        id TEXT PRIMARY KEY, approval_key TEXT NOT NULL, decision TEXT NOT NULL,
        command TEXT, risk TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
        title TEXT NOT NULL, description TEXT NOT NULL, reasoning TEXT NOT NULL,
        category TEXT NOT NULL, severity TEXT NOT NULL, affected_files TEXT NOT NULL,
        proposed_changes TEXT NOT NULL, expected_benefits TEXT NOT NULL DEFAULT '[]', complexity TEXT NOT NULL DEFAULT 'medium', risk TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL, result TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_suggestions_conversation ON suggestions(conversation_id, updated_at);
      CREATE TABLE IF NOT EXISTS suggestion_decisions (
        id TEXT PRIMARY KEY, suggestion_id TEXT NOT NULL, status TEXT NOT NULL,
        result TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO workspaces(path,name,created_at,last_opened_at)
        SELECT workspace, workspace, MIN(created_at), MAX(updated_at) FROM conversations GROUP BY workspace;
    `)
    const columns = this.db.prepare('PRAGMA table_info(workspaces)').all() as Array<{ name: string }>
    if (!columns.some((column) => column.name === 'favorite')) this.db.exec('ALTER TABLE workspaces ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0')
    const suggestionColumns = this.db.prepare('PRAGMA table_info(suggestions)').all() as Array<{ name: string }>
    if (!suggestionColumns.some((column) => column.name === 'expected_benefits')) this.db.exec("ALTER TABLE suggestions ADD COLUMN expected_benefits TEXT NOT NULL DEFAULT '[]'")
    if (!suggestionColumns.some((column) => column.name === 'complexity')) this.db.exec("ALTER TABLE suggestions ADD COLUMN complexity TEXT NOT NULL DEFAULT 'medium'")
    if (!suggestionColumns.some((column) => column.name === 'risk')) this.db.exec("ALTER TABLE suggestions ADD COLUMN risk TEXT NOT NULL DEFAULT 'medium'")
      this.db.pragma('user_version = 5')
    })
    const migrations = [{ version: 5, up: migrateToVersion5 }]
    for (const migration of migrations) if (migration.version > schemaVersion) migration.up()
    this.cleanupOrphans()
  }

  listConversations(): ConversationRow[] {
    return this.db.prepare(`SELECT id, title, workspace, codex_thread_id codexThreadId,
      created_at createdAt, updated_at updatedAt FROM conversations ORDER BY updated_at DESC`).all() as ConversationRow[]
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
    const rows = this.db.prepare(`SELECT path, name, favorite, created_at createdAt, last_opened_at lastOpenedAt
      FROM workspaces ORDER BY favorite DESC, last_opened_at DESC`).all() as Array<Omit<WorkspaceRow, 'favorite'> & { favorite: number }>
    return rows.map((row) => ({ ...row, favorite: Boolean(row.favorite) }))
  }

  touchWorkspace(workspace: string) {
    const now = new Date().toISOString()
    this.db.prepare(`INSERT INTO workspaces(path,name,created_at,last_opened_at) VALUES(?,?,?,?)
      ON CONFLICT(path) DO UPDATE SET name=excluded.name,last_opened_at=excluded.last_opened_at`)
      .run(workspace, path.basename(workspace), now, now)
  }

  removeWorkspace(workspace: string) { this.db.prepare('DELETE FROM workspaces WHERE path=?').run(workspace) }
  setWorkspaceFavorite(workspace: string, favorite: boolean) { this.db.prepare('UPDATE workspaces SET favorite=? WHERE path=?').run(favorite ? 1 : 0, workspace) }

  getSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key,value FROM settings').all() as Array<{ key: string; value: string }>
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
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

  listArtifacts(conversationId: string): ArtifactRow[] {
    return this.db.prepare(`SELECT id,conversation_id conversationId,workspace,type,title,file_path filePath,
      content,metadata,created_at createdAt,updated_at updatedAt FROM artifacts
      WHERE conversation_id=? ORDER BY updated_at DESC`).all(conversationId) as ArtifactRow[]
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

  deleteArtifact(id: string) { this.db.prepare('DELETE FROM artifacts WHERE id=?').run(id) }
  recordApproval(key: string, accepted: boolean, command?: string, risk?: string) { this.db.prepare('INSERT INTO approval_audit(id,approval_key,decision,command,risk,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(), key, accepted ? 'accepted' : 'declined', command?.slice(0, 4_000) ?? null, risk ?? null, new Date().toISOString()) }

  listSuggestions(conversationId: string): Suggestion[] {
    const rows = this.db.prepare(`SELECT id,workspace_id workspaceId,conversation_id conversationId,title,description,reasoning,category,severity,affected_files affectedFiles,proposed_changes proposedChanges,expected_benefits expectedBenefits,complexity,risk,status,created_at createdAt,updated_at updatedAt FROM suggestions WHERE conversation_id=? ORDER BY updated_at DESC`).all(conversationId) as Array<Omit<Suggestion, 'affectedFiles' | 'expectedBenefits'> & { affectedFiles: string; expectedBenefits: string }>
    return rows.map((row) => ({ ...row, affectedFiles: JSON.parse(row.affectedFiles) as string[], expectedBenefits: JSON.parse(row.expectedBenefits) as string[] }))
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
    return this.listSuggestions(row.conversationId).find((item) => item.id === id) as Suggestion
  }

  exportData() {
    return { schemaVersion: 5, exportedAt: new Date().toISOString(), conversations: this.db.prepare('SELECT * FROM conversations').all(), workspaces: this.db.prepare('SELECT * FROM workspaces').all(), messages: this.db.prepare('SELECT * FROM messages ORDER BY created_at').all(), artifacts: this.db.prepare('SELECT * FROM artifacts ORDER BY created_at').all(), memories: this.db.prepare('SELECT * FROM workspace_memory').all(), suggestions: this.db.prepare('SELECT * FROM suggestions').all(), suggestionDecisions: this.db.prepare('SELECT * FROM suggestion_decisions').all(), settings: this.getSettings() }
  }

  importData(data: { conversations: unknown[]; workspaces: unknown[]; messages: unknown[]; artifacts: unknown[]; memories: unknown[]; suggestions?: unknown[]; suggestionDecisions?: unknown[]; settings?: Record<string, string> }) {
    const insert = (table: string, rows: unknown[]) => {
      const allowed = importColumns[table]
      if (!allowed) throw new Error(`Tabela de importação não permitida: ${table}.`)
      for (const raw of rows) {
        if (!raw || typeof raw !== 'object') continue
        const row = raw as Record<string, unknown>
        const keys = Object.keys(row).filter((key) => allowed.has(key))
        if (!keys.length) continue
        this.db.prepare(`INSERT OR IGNORE INTO ${table} (${keys.join(',')}) VALUES (${keys.map((key) => `@${key}`).join(',')})`).run(row)
      }
    }
    this.db.transaction(() => {
      insert('workspaces', data.workspaces); insert('conversations', data.conversations); insert('messages', data.messages); insert('artifacts', data.artifacts); insert('workspace_memory', data.memories); insert('suggestions', data.suggestions ?? []); insert('suggestion_decisions', data.suggestionDecisions ?? [])
      if (data.settings) this.setSettings(data.settings)
      this.cleanupOrphans()
    })()
  }

  private cleanupOrphans() {
    this.db.exec(`DELETE FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations); DELETE FROM artifacts WHERE conversation_id NOT IN (SELECT id FROM conversations); DELETE FROM suggestions WHERE conversation_id NOT IN (SELECT id FROM conversations); DELETE FROM suggestion_decisions WHERE suggestion_id NOT IN (SELECT id FROM suggestions);`)
  }

  renameFromPrompt(id: string, prompt: string) {
    const title = prompt.replace(/\s+/g, ' ').trim().slice(0, 52) || 'Nova conversa'
    this.db.prepare('UPDATE conversations SET title=?, updated_at=? WHERE id=?').run(title, new Date().toISOString(), id)
  }

  deleteConversation(id: string) { this.db.prepare('DELETE FROM conversations WHERE id=?').run(id) }

  listMessages(conversationId: string): MessageRow[] {
    return this.db.prepare(`SELECT id, conversation_id conversationId, role, content, metadata,
      created_at createdAt FROM messages WHERE conversation_id=? ORDER BY created_at`).all(conversationId) as MessageRow[]
  }

  addMessage(conversationId: string, role: MessageRow['role'], content: string, metadata?: unknown) {
    const row: MessageRow = { id: randomUUID(), conversationId, role, content, metadata: metadata ? JSON.stringify(metadata) : null, createdAt: new Date().toISOString() }
    this.db.prepare(`INSERT INTO messages (id,conversation_id,role,content,metadata,created_at)
      VALUES (@id,@conversationId,@role,@content,@metadata,@createdAt)`).run(row)
    this.db.prepare('UPDATE conversations SET updated_at=? WHERE id=?').run(row.createdAt, conversationId)
    return row
  }

  close() { this.db.close() }
}
