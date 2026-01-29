import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  maxBoardTaskId: integer("max_board_task_id").notNull().default(0),
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
  boardTaskId: integer("board_task_id"),
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
  dueDate: integer("due_date", { mode: "timestamp" }),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  updatedBy: text("updated_by"),
});

export const undoLog = sqliteTable("undo_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  operation: text("operation").notNull(),
  data: text("data", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const audits = sqliteTable("audits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  eventType: text("event_type", { enum: ["CREATE", "UPDATE", "DELETE"] }).notNull(),
  objectType: text("object_type", { enum: ["task", "column", "board"] }).notNull(),
  objectId: text("object_id").notNull(),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  actor: text("actor"),
});

export const linkTypes = ["blocks", "blocked_by", "related"] as const;
export type LinkType = (typeof linkTypes)[number];

export const taskLinks = sqliteTable("task_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromTaskId: text("from_task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  toTaskId: text("to_task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  linkType: text("link_type", { enum: linkTypes }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
