import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";
import { ExitCode, KabanError } from "../types.js";

export * from "./schema.js";

type DrizzleDb = ReturnType<typeof import("drizzle-orm/libsql").drizzle>;

/**
 * Database adapter interface.
 * Supports both bun:sqlite and @libsql/client backends.
 * Note: Uses libsql drizzle type for compatibility; bun:sqlite is API-compatible at runtime.
 */
export type DB = DrizzleDb & {
  /** Raw database client. Type varies by backend. */
  $client: unknown;
  /**
   * Execute raw SQL statements.
   * @internal For schema initialization only. Does not sanitize input.
   */
  $runRaw: (sql: string) => Promise<void>;
  /** Close the database connection and release resources. */
  $close: () => Promise<void>;
};

export interface DbConfig {
  url: string;
  authToken?: string;
}

const isBun = typeof globalThis.Bun !== "undefined" && typeof globalThis.Bun.version === "string";

function fileUrlToPath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("file:")) return urlOrPath;
  if (urlOrPath.startsWith("file:///") || urlOrPath.startsWith("file://localhost/")) {
    return fileURLToPath(urlOrPath);
  }
  return urlOrPath.replace(/^file:/, "");
}

function ensureDbDir(filePath: string) {
  if (filePath === ":memory:" || filePath.trim() === "") return;
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function createBunDb(filePath: string): Promise<DB> {
  let sqlite: InstanceType<typeof import("bun:sqlite").Database> | undefined;
  try {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");

    ensureDbDir(filePath);
    sqlite = new Database(filePath);
    const db = drizzle({ client: sqlite, schema });

    let closed = false;
    const sqliteRef = sqlite;

    return Object.assign(db, {
      $client: sqliteRef,
      $runRaw: async (sql: string) => {
        try {
          if (typeof sqliteRef.exec === "function") {
            sqliteRef.exec(sql);
            return;
          }
          const statements = sql.split(";").filter((s) => s.trim());
          for (const stmt of statements) {
            sqliteRef.run(stmt);
          }
        } catch (error) {
          throw new KabanError(
            `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`,
            ExitCode.GENERAL_ERROR,
          );
        }
      },
      $close: async () => {
        if (closed) return;
        closed = true;
        try {
          sqliteRef.close();
        } catch {
          // best-effort close
        }
      },
    }) as unknown as DB;
  } catch (error) {
    try {
      sqlite?.close?.();
    } catch {
      // ignore cleanup failures
    }
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create Bun database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR,
    );
  }
}

async function createLibsqlDb(config: DbConfig): Promise<DB> {
  let client: ReturnType<typeof import("@libsql/client").createClient> | undefined;
  try {
    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");

    if (config.url.startsWith("file:")) {
      ensureDbDir(fileUrlToPath(config.url));
    }

    client = createClient(config);
    const db = drizzle(client, { schema });

    let closed = false;
    const clientRef = client;

    return Object.assign(db, {
      $client: clientRef,
      $runRaw: async (sql: string) => {
        try {
          await clientRef.executeMultiple(sql);
        } catch (error) {
          throw new KabanError(
            `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`,
            ExitCode.GENERAL_ERROR,
          );
        }
      },
      $close: async () => {
        if (closed) return;
        closed = true;
        try {
          clientRef.close();
        } catch {
          // best-effort close
        }
      },
    }) as unknown as DB;
  } catch (error) {
    try {
      client?.close?.();
    } catch {
      // ignore cleanup failures
    }
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create libsql database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR,
    );
  }
}

export async function createDb(config: DbConfig | string): Promise<DB> {
  try {
    if (typeof config === "string") {
      if (isBun) {
        return await createBunDb(config);
      }
      return await createLibsqlDb({ url: `file:${config}` });
    }

    if (isBun && config.url.startsWith("file:")) {
      return await createBunDb(fileUrlToPath(config.url));
    }
    return await createLibsqlDb(config);
  } catch (error) {
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR,
    );
  }
}

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
`;

export async function initializeSchema(db: DB) {
  await db.$runRaw(SCHEMA_SQL);
}
