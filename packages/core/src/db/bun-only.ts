import { ExitCode, KabanError } from "../types.js";
import type { CreateDbOptions, DB, DbConfig } from "./types.js";
import { fileUrlToPath } from "./utils.js";

export * from "./schema.js";
export { runMigrations } from "./migrator.js";
export type { CreateDbOptions, DB, DbConfig } from "./types.js";

export async function createDb(
  config: DbConfig | string,
  options: CreateDbOptions = {},
): Promise<DB> {
  const { migrate = true } = options;

  try {
    const driver = process.env.KABAN_DB_DRIVER;
    if (driver === "libsql") {
      throw new KabanError(
        "LibSQL driver requested but this build only supports bun:sqlite",
        ExitCode.GENERAL_ERROR,
      );
    }

    const { createBunDb } = await import("./bun-adapter.js");

    let db: DB;
    if (typeof config === "string") {
      db = await createBunDb(config);
    } else {
      db = await createBunDb(fileUrlToPath(config.url));
    }

    if (migrate) {
      const { runMigrations } = await import("./migrator.js");
      await runMigrations(db);
    }

    return db;
  } catch (error) {
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR,
    );
  }
}

export async function initializeSchema(db: DB) {
  const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  wip_limit INTEGER,
  is_terminal INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  column_id TEXT NOT NULL REFERENCES columns(id),
  position INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  assigned_to TEXT,
  parent_id TEXT REFERENCES tasks(id),
  depends_on TEXT NOT NULL DEFAULT '[]',
  files TEXT NOT NULL DEFAULT '[]',
  labels TEXT NOT NULL DEFAULT '[]',
  blocked_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER
);

CREATE TABLE IF NOT EXISTS undo_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
`;
  await db.$runRaw(SCHEMA_SQL);
}
