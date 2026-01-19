import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

export * from "./schema.js";

export type DB = ReturnType<typeof createDb>;

export interface DbConfig {
  url: string;
  authToken?: string;
}

export function createDb(config: DbConfig | string) {
  const dbConfig = typeof config === "string" ? { url: `file:${config}` } : config;

  if (dbConfig.url.startsWith("file:")) {
    const filePath = dbConfig.url.replace("file:", "");
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const client = createClient(dbConfig);
  return drizzle(client, { schema });
}

export async function initializeSchema(db: DB) {
  const client = (db as unknown as { $client: Client }).$client;

  await client.executeMultiple(`
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
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS undo_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
  `);
}
