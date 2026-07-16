import type Database from 'better-sqlite3'

interface Migration { version: number; up(db: Database.Database): void }

const hasColumn = (db: Database.Database, table: string, column: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((item) => item.name === column)

export const migrations: Migration[] = [
  { version: 1, up: (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, workspace TEXT NOT NULL, codex_thread_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, metadata TEXT, created_at TEXT NOT NULL, FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `) },
  { version: 2, up: (db) => {
    db.exec('CREATE TABLE IF NOT EXISTS workspaces (path TEXT PRIMARY KEY, name TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_opened_at TEXT NOT NULL);')
    if (!hasColumn(db, 'workspaces', 'favorite')) db.exec('ALTER TABLE workspaces ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0')
    db.exec('INSERT OR IGNORE INTO workspaces(path,name,created_at,last_opened_at) SELECT workspace, workspace, MIN(created_at), MAX(updated_at) FROM conversations GROUP BY workspace;')
  } },
  { version: 3, up: (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_memory (workspace TEXT PRIMARY KEY, content TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, workspace TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, file_path TEXT, content TEXT, metadata TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS idx_artifacts_conversation ON artifacts(conversation_id, updated_at);
    CREATE TABLE IF NOT EXISTS approval_audit (id TEXT PRIMARY KEY, approval_key TEXT NOT NULL, decision TEXT NOT NULL, command TEXT, risk TEXT, created_at TEXT NOT NULL);
  `) },
  { version: 4, up: (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS suggestions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, conversation_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, reasoning TEXT NOT NULL, category TEXT NOT NULL, severity TEXT NOT NULL, affected_files TEXT NOT NULL, proposed_changes TEXT NOT NULL, expected_benefits TEXT NOT NULL DEFAULT '[]', complexity TEXT NOT NULL DEFAULT 'medium', risk TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS idx_suggestions_conversation ON suggestions(conversation_id, updated_at);
    CREATE TABLE IF NOT EXISTS suggestion_decisions (id TEXT PRIMARY KEY, suggestion_id TEXT NOT NULL, status TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL, FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE);
  `) },
  { version: 5, up: (db) => {
    if (!hasColumn(db, 'suggestions', 'expected_benefits')) db.exec("ALTER TABLE suggestions ADD COLUMN expected_benefits TEXT NOT NULL DEFAULT '[]'")
    if (!hasColumn(db, 'suggestions', 'complexity')) db.exec("ALTER TABLE suggestions ADD COLUMN complexity TEXT NOT NULL DEFAULT 'medium'")
    if (!hasColumn(db, 'suggestions', 'risk')) db.exec("ALTER TABLE suggestions ADD COLUMN risk TEXT NOT NULL DEFAULT 'medium'")
  } },
  { version: 6, up: (db) => {
    if (!hasColumn(db, 'workspaces', 'authorized')) db.exec('ALTER TABLE workspaces ADD COLUMN authorized INTEGER NOT NULL DEFAULT 1')
  } },
  { version: 7, up: (db) => db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workspaces_recent ON workspaces(favorite DESC, last_opened_at DESC);
    CREATE INDEX IF NOT EXISTS idx_artifacts_file ON artifacts(conversation_id, file_path, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_suggestion_decisions_suggestion ON suggestion_decisions(suggestion_id, created_at);
  `) },
]

export function migrateDatabase(db: Database.Database, currentVersion: number) {
  // Builds antigos podiam marcar v1 após criar apenas conversations. A etapa
  // inicial é idempotente e também repara esse snapshot legado incompleto.
  if (currentVersion > 0) db.transaction(() => migrations[0].up(db))()
  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue
    db.transaction(() => { migration.up(db); db.pragma(`user_version = ${migration.version}`) })()
  }
}
