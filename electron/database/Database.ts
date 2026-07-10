import Database from 'better-sqlite3'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

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

export interface WorkspaceRow { path: string; name: string; createdAt: string; lastOpenedAt: string }
export interface ArtifactRow { id: string; conversationId: string; workspace: string; type: string; title: string; filePath: string | null; content: string | null; metadata: string | null; createdAt: string; updatedAt: string }

export class LocalDatabase {
  private db: Database.Database

  constructor(userDataPath: string) {
    this.db = new Database(path.join(userDataPath, 'nocturne.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
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
        path TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, last_opened_at TEXT NOT NULL
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
      INSERT OR IGNORE INTO workspaces(path,name,created_at,last_opened_at)
        SELECT workspace, workspace, MIN(created_at), MAX(updated_at) FROM conversations GROUP BY workspace;
    `)
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
    return this.db.prepare(`SELECT path, name, created_at createdAt, last_opened_at lastOpenedAt
      FROM workspaces ORDER BY last_opened_at DESC`).all() as WorkspaceRow[]
  }

  touchWorkspace(workspace: string) {
    const now = new Date().toISOString()
    this.db.prepare(`INSERT INTO workspaces(path,name,created_at,last_opened_at) VALUES(?,?,?,?)
      ON CONFLICT(path) DO UPDATE SET name=excluded.name,last_opened_at=excluded.last_opened_at`)
      .run(workspace, path.basename(workspace), now, now)
  }

  removeWorkspace(workspace: string) { this.db.prepare('DELETE FROM workspaces WHERE path=?').run(workspace) }

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
