import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const columns = sqliteTable("columns", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  wipLimit: integer("wip_limit"),
  isTerminal: integer("is_terminal", { mode: "boolean" }).notNull().default(false),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  columnId: text("column_id")
    .notNull()
    .references(() => columns.id),
  position: integer("position").notNull(),
  createdBy: text("created_by").notNull(),
  assignedTo: text("assigned_to"),
  parentId: text("parent_id").references((): ReturnType<typeof text> => tasks.id),
  dependsOn: text("depends_on", { mode: "json" }).$type<string[]>().notNull().default([]),
  files: text("files", { mode: "json" }).$type<string[]>().notNull().default([]),
  labels: text("labels", { mode: "json" }).$type<string[]>().notNull().default([]),
  blockedReason: text("blocked_reason"),
  version: integer("version").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const undoLog = sqliteTable("undo_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operation: text("operation").notNull(),
  data: text("data", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
