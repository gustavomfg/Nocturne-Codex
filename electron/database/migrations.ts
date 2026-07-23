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
  { version: 8, up: (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS brain_memories (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      conversation_id TEXT,
      kind TEXT NOT NULL CHECK(kind IN ('fact','decision','preference','constraint','learning')),
      scope TEXT NOT NULL CHECK(scope IN ('workspace','conversation')),
      status TEXT NOT NULL CHECK(status IN ('candidate','active','outdated','archived')),
      content TEXT NOT NULL,
      confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 100),
      source_type TEXT NOT NULL CHECK(source_type IN ('manual','message','agent')),
      source_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_confirmed_at TEXT,
      last_used_at TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(path) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      CHECK((scope = 'workspace' AND conversation_id IS NULL) OR (scope = 'conversation' AND conversation_id IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS idx_brain_memories_workspace ON brain_memories(workspace_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_brain_memories_conversation ON brain_memories(conversation_id, status, updated_at DESC);
    CREATE VIRTUAL TABLE IF NOT EXISTS brain_memories_fts USING fts5(content, content='brain_memories', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
    CREATE TRIGGER IF NOT EXISTS brain_memories_ai AFTER INSERT ON brain_memories BEGIN
      INSERT INTO brain_memories_fts(rowid, content) VALUES (new.rowid, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS brain_memories_ad AFTER DELETE ON brain_memories BEGIN
      INSERT INTO brain_memories_fts(brain_memories_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS brain_memories_au AFTER UPDATE OF content ON brain_memories BEGIN
      INSERT INTO brain_memories_fts(brain_memories_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
      INSERT INTO brain_memories_fts(rowid, content) VALUES (new.rowid, new.content);
    END;
    INSERT INTO brain_memories_fts(brain_memories_fts) VALUES ('rebuild');
  `) },
  { version: 9, up: (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS provider_configs (
      id TEXT PRIMARY KEY,
      provider_type TEXT NOT NULL,
      display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 500),
      source TEXT NOT NULL CHECK(source IN ('local','remote')),
      base_url TEXT NOT NULL CHECK(length(base_url) BETWEEN 1 AND 2048),
      enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
      requires_authentication INTEGER NOT NULL CHECK(requires_authentication IN (0,1)),
      credential_ref TEXT UNIQUE,
      timeout_ms INTEGER NOT NULL CHECK(timeout_ms BETWEEN 1000 AND 120000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(credential_ref IS NULL OR length(credential_ref) = 36)
    );
    CREATE INDEX IF NOT EXISTS idx_provider_configs_enabled
      ON provider_configs(enabled DESC, updated_at DESC);
  `) },
  { version: 10, up: (db) => db.exec(`
    CREATE TABLE IF NOT EXISTS model_catalog (
      provider_id TEXT NOT NULL CHECK(length(provider_id) BETWEEN 1 AND 512),
      model_id TEXT NOT NULL CHECK(length(model_id) BETWEEN 1 AND 512),
      descriptor TEXT NOT NULL CHECK(length(descriptor) BETWEEN 2 AND 100000),
      updated_at TEXT NOT NULL,
      PRIMARY KEY(provider_id, model_id)
    );
    CREATE INDEX IF NOT EXISTS idx_model_catalog_provider
      ON model_catalog(provider_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS workspace_model_bindings (
      workspace_id TEXT PRIMARY KEY,
      bindings TEXT NOT NULL CHECK(length(bindings) BETWEEN 2 AND 50000),
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(path) ON DELETE CASCADE
    );
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
