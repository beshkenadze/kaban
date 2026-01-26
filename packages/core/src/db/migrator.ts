import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "./types.js";

interface MigrationEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface MigrationJournal {
  version: string;
  dialect: string;
  entries: MigrationEntry[];
}

interface Migration {
  tag: string;
  sql: string;
}

// Import generated migrations - these get bundled as text (or paths in dev)
import journal from "../../drizzle/meta/_journal.json";
import sql0000 from "../../drizzle/0000_init.sql";
import sql0001 from "../../drizzle/0001_add_archived.sql";
import sql0002 from "../../drizzle/0002_add_fts5.sql";

const migrationSql: Record<string, string> = {
  "0000_init": sql0000,
  "0001_add_archived": sql0001,
  "0002_add_fts5": sql0002,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(__dirname, "..", "..", "drizzle");

function resolveSqlContent(sqlOrPath: string): string {
  // If it's a SQL statement (bundled), return as-is
  if (sqlOrPath.includes("CREATE") || sqlOrPath.includes("INSERT") || sqlOrPath.includes("--")) {
    return sqlOrPath;
  }

  // Otherwise it's a file path (dev mode) - read the file
  let filePath = sqlOrPath;
  if (filePath.startsWith("./")) {
    filePath = join(drizzleDir, filePath.replace("./", "").replace(/-[a-z0-9]+\.sql$/, ".sql"));
  }
  if (!isAbsolute(filePath)) {
    filePath = join(drizzleDir, filePath);
  }

  return readFileSync(filePath, "utf-8");
}

function getMigrations(): Migration[] {
  const j = journal as MigrationJournal;
  return j.entries.map((entry) => ({
    tag: entry.tag,
    sql: resolveSqlContent(migrationSql[entry.tag] ?? ""),
  }));
}

async function getAppliedMigrations(db: DB): Promise<Set<string>> {
  try {
    // Use raw SQL to check applied migrations
    const results: { tag: string }[] = [];

    // Try to query the migrations table
    const client = db.$client as unknown;

    // bun:sqlite client
    if (client && typeof (client as { prepare?: unknown }).prepare === "function") {
      const bunClient = client as { prepare: (sql: string) => { all: () => { tag: string }[] } };
      const rows = bunClient.prepare("SELECT tag FROM __drizzle_migrations").all();
      return new Set(rows.map((r) => r.tag));
    }

    // libsql client
    if (client && typeof (client as { execute?: unknown }).execute === "function") {
      const libsqlClient = client as {
        execute: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
      };
      const res = await libsqlClient.execute("SELECT tag FROM __drizzle_migrations");
      return new Set(res.rows.map((r) => String(r.tag)));
    }

    return new Set(results.map((r) => r.tag));
  } catch {
    // Table doesn't exist yet
    return new Set();
  }
}

async function createMigrationsTable(db: DB): Promise<void> {
  await db.$runRaw(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `);
}

async function recordMigration(db: DB, tag: string): Promise<void> {
  const now = Date.now();
  await db.$runRaw(`INSERT INTO __drizzle_migrations (tag, created_at) VALUES ('${tag}', ${now})`);
}

async function isLegacyDatabase(db: DB): Promise<boolean> {
  // Check if boards table exists but __drizzle_migrations doesn't
  try {
    const client = db.$client as unknown;

    // bun:sqlite client
    if (client && typeof (client as { prepare?: unknown }).prepare === "function") {
      const bunClient = client as { prepare: (sql: string) => { all: () => unknown[] } };
      const tables = bunClient
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='boards'")
        .all();
      return tables.length > 0;
    }

    // libsql client
    if (client && typeof (client as { execute?: unknown }).execute === "function") {
      const libsqlClient = client as {
        execute: (sql: string) => Promise<{ rows: unknown[] }>;
      };
      const res = await libsqlClient.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='boards'"
      );
      return res.rows.length > 0;
    }

    return false;
  } catch {
    return false;
  }
}

export async function runMigrations(db: DB): Promise<{ applied: string[] }> {
  const isLegacy = await isLegacyDatabase(db);
  await createMigrationsTable(db);

  const applied = await getAppliedMigrations(db);

  // If this is a legacy database (had tables before migration tracking),
  // mark the initial migration as applied without running it
  if (isLegacy && applied.size === 0) {
    await recordMigration(db, "0000_init");
    applied.add("0000_init");
  }

  const migrations = getMigrations();
  const toApply = migrations.filter((m) => !applied.has(m.tag));

  const newlyApplied: string[] = [];

  for (const migration of toApply) {
    if (!migration.sql) {
      throw new Error(`Migration SQL not found for: ${migration.tag}`);
    }

    // Split by statement breakpoint marker
    const statements = migration.sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      try {
        await db.$runRaw(stmt);
      } catch (err) {
        // Ignore "duplicate column name" errors for ALTER TABLE ADD COLUMN
        // This allows idempotent migrations on legacy databases
        const msg = String(err);
        if (stmt.includes("ADD COLUMN") && msg.includes("duplicate column name")) {
          continue;
        }
        throw err;
      }
    }

    await recordMigration(db, migration.tag);
    newlyApplied.push(migration.tag);
  }

  return { applied: newlyApplied };
}
