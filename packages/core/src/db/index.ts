import { ExitCode, KabanError } from "../types.js";
import type { CreateDbOptions, DB, DbConfig } from "./types.js";
import { fileUrlToPath } from "./utils.js";

export * from "./schema.js";
export { runMigrations } from "./migrator.js";
export type { CreateDbOptions, DB, DbConfig } from "./types.js";

const isBun = typeof globalThis.Bun !== "undefined" && typeof globalThis.Bun.version === "string";

export async function createDb(
   config: DbConfig | string,
   options: CreateDbOptions = {},
): Promise<DB> {
   const { migrate = true } = options;

   try {
     let db: DB;
     const driver = process.env.KABAN_DB_DRIVER;
     const noLibsql = process.env.KABAN_NO_LIBSQL === "true";
     const preferBun = isBun && driver !== "libsql";
     const forceLibsql = driver === "libsql";

     if (noLibsql && forceLibsql) {
       throw new KabanError(
         "LibSQL is disabled (KABAN_NO_LIBSQL=true) but was explicitly requested",
         ExitCode.GENERAL_ERROR,
       );
     }

     if (typeof config === "string") {
       if (forceLibsql) {
         if (noLibsql) {
           throw new KabanError(
             "LibSQL is disabled (KABAN_NO_LIBSQL=true) but was explicitly requested",
             ExitCode.GENERAL_ERROR,
           );
         } else {
           const { createLibsqlDb } = await import("./libsql-adapter.js");
           db = await createLibsqlDb({ url: `file:${config}` });
         }
       } else if (preferBun) {
         const { createBunDb } = await import("./bun-adapter.js");
         db = await createBunDb(config);
       } else if (noLibsql) {
         const { createBunDb } = await import("./bun-adapter.js");
         db = await createBunDb(config);
       } else {
         const { createLibsqlDb } = await import("./libsql-adapter.js");
         db = await createLibsqlDb({ url: `file:${config}` });
       }
     } else if (forceLibsql) {
       if (noLibsql) {
         throw new KabanError(
           "LibSQL is disabled (KABAN_NO_LIBSQL=true) but was explicitly requested",
           ExitCode.GENERAL_ERROR,
         );
       } else {
         const { createLibsqlDb } = await import("./libsql-adapter.js");
         db = await createLibsqlDb(config);
       }
     } else if (preferBun && config.url.startsWith("file:")) {
       const { createBunDb } = await import("./bun-adapter.js");
       db = await createBunDb(fileUrlToPath(config.url));
     } else if (noLibsql) {
       const { createBunDb } = await import("./bun-adapter.js");
       db = await createBunDb(fileUrlToPath(config.url));
     } else {
       const { createLibsqlDb } = await import("./libsql-adapter.js");
       db = await createLibsqlDb(config);
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

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_board_task_id INTEGER NOT NULL DEFAULT 0,
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
  board_task_id INTEGER,
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
  due_date INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS undo_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATE', 'UPDATE', 'DELETE')),
  object_type TEXT NOT NULL CHECK (object_type IN ('task', 'column', 'board')),
  object_id TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  actor TEXT
);

CREATE TABLE IF NOT EXISTS task_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  to_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('blocks', 'blocked_by', 'related')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(from_task_id, to_task_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_audits_object ON audits(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON audits(timestamp);
CREATE INDEX IF NOT EXISTS idx_task_links_from ON task_links(from_task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_to ON task_links(to_task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_type ON task_links(link_type);

-- Trigger: task INSERT
CREATE TRIGGER IF NOT EXISTS audit_task_insert
AFTER INSERT ON tasks
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, new_value, actor)
  VALUES ('CREATE', 'task', NEW.id, 
    json_object('title', NEW.title, 'columnId', NEW.column_id),
    NEW.created_by);
END;

-- Trigger: task UPDATE
CREATE TRIGGER IF NOT EXISTS audit_task_update
AFTER UPDATE ON tasks
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'title', OLD.title, NEW.title, NEW.updated_by
  WHERE (OLD.title IS NULL AND NEW.title IS NOT NULL)
     OR (OLD.title IS NOT NULL AND NEW.title IS NULL)
     OR (OLD.title <> NEW.title);
  
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'columnId', OLD.column_id, NEW.column_id, NEW.updated_by
  WHERE (OLD.column_id IS NULL AND NEW.column_id IS NOT NULL)
     OR (OLD.column_id IS NOT NULL AND NEW.column_id IS NULL)
     OR (OLD.column_id <> NEW.column_id);
  
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'assignedTo', OLD.assigned_to, NEW.assigned_to, NEW.updated_by
  WHERE (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL)
     OR (OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL)
     OR (OLD.assigned_to <> NEW.assigned_to);

  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'description', OLD.description, NEW.description, NEW.updated_by
  WHERE (OLD.description IS NULL AND NEW.description IS NOT NULL)
     OR (OLD.description IS NOT NULL AND NEW.description IS NULL)
     OR (OLD.description <> NEW.description);

  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'archived', OLD.archived, NEW.archived, NEW.updated_by
  WHERE (OLD.archived IS NULL AND NEW.archived IS NOT NULL)
     OR (OLD.archived IS NOT NULL AND NEW.archived IS NULL)
     OR (OLD.archived <> NEW.archived);

  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'labels', OLD.labels, NEW.labels, NEW.updated_by
  WHERE (OLD.labels IS NULL AND NEW.labels IS NOT NULL)
     OR (OLD.labels IS NOT NULL AND NEW.labels IS NULL)
     OR (OLD.labels <> NEW.labels);
END;

-- Trigger: task DELETE
CREATE TRIGGER IF NOT EXISTS audit_task_delete
AFTER DELETE ON tasks
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, old_value)
  VALUES ('DELETE', 'task', OLD.id,
    json_object('title', OLD.title, 'columnId', OLD.column_id));
END;
`;

export async function initializeSchema(db: DB) {
  await db.$runRaw(SCHEMA_SQL);
}
