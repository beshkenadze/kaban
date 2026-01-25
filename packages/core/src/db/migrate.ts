import type { DB } from "./index.js";

interface TableInfo {
  name: string;
}

interface BunSqliteClient {
  prepare: (sql: string) => { all: () => TableInfo[] };
}

async function columnExists(db: DB, table: string, column: string): Promise<boolean> {
  const client = db.$client as unknown as BunSqliteClient;
  const result = client.prepare(`PRAGMA table_info(${table})`).all();
  return result.some((row) => row.name === column);
}

export async function migrateArchiveSupport(db: DB): Promise<void> {
  // Add archived column if not exists (for database upgrades)
  if (!(await columnExists(db, "tasks", "archived"))) {
    await db.$runRaw("ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }

  if (!(await columnExists(db, "tasks", "archived_at"))) {
    await db.$runRaw("ALTER TABLE tasks ADD COLUMN archived_at INTEGER");
  }

  // Create index for efficient archive queries
  await db.$runRaw("CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived)");

  // Create FTS5 virtual table for full-text search
  // Uses unicode61 tokenizer with remove_diacritics for proper Russian language support
  await db.$runRaw(`
    CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
      id, title, description,
      content='tasks',
      content_rowid='rowid',
      tokenize='unicode61 remove_diacritics 2'
    )
  `);

  // Create trigger to keep FTS in sync on INSERT
  await db.$runRaw(`
    CREATE TRIGGER IF NOT EXISTS tasks_fts_insert AFTER INSERT ON tasks BEGIN
      INSERT INTO tasks_fts(rowid, id, title, description)
      VALUES (NEW.rowid, NEW.id, NEW.title, COALESCE(NEW.description, ''));
    END
  `);

  // Create trigger to keep FTS in sync on DELETE
  await db.$runRaw(`
    CREATE TRIGGER IF NOT EXISTS tasks_fts_delete AFTER DELETE ON tasks BEGIN
      INSERT INTO tasks_fts(tasks_fts, rowid, id, title, description)
      VALUES('delete', OLD.rowid, OLD.id, OLD.title, COALESCE(OLD.description, ''));
    END
  `);

  // Create trigger to keep FTS in sync on UPDATE
  await db.$runRaw(`
    CREATE TRIGGER IF NOT EXISTS tasks_fts_update AFTER UPDATE ON tasks BEGIN
      INSERT INTO tasks_fts(tasks_fts, rowid, id, title, description)
      VALUES('delete', OLD.rowid, OLD.id, OLD.title, COALESCE(OLD.description, ''));
      INSERT INTO tasks_fts(rowid, id, title, description)
      VALUES (NEW.rowid, NEW.id, NEW.title, COALESCE(NEW.description, ''));
    END
  `);

  // Populate FTS with existing data (only if FTS table is empty)
  await db.$runRaw(`
    INSERT INTO tasks_fts(rowid, id, title, description)
    SELECT rowid, id, title, COALESCE(description, '') FROM tasks
    WHERE NOT EXISTS (SELECT 1 FROM tasks_fts LIMIT 1)
  `);
}
