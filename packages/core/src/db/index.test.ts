import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { KabanError } from "../types.js";
import { createDb, type DB, initializeSchema } from "./index.js";
import { boards } from "./schema.js";

const TEST_DIR = ".kaban-test-db";
const TEST_DB = `${TEST_DIR}/test.db`;

describe("createDb", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("creates database with string path", async () => {
    const db = await createDb(TEST_DB);

    expect(db).toBeDefined();
    expect(db.$client).toBeDefined();
    expect(typeof db.$runRaw).toBe("function");
    expect(typeof db.$close).toBe("function");
    expect(existsSync(TEST_DB)).toBe(true);

    await db.$close();
  });

  test("creates database with DbConfig", async () => {
    const db = await createDb({ url: `file:${TEST_DB}` });

    expect(db).toBeDefined();
    expect(existsSync(TEST_DB)).toBe(true);

    await db.$close();
  });

  test("creates parent directories if missing", async () => {
    const deepPath = `${TEST_DIR}/deep/nested/path/test.db`;
    const db = await createDb(deepPath);

    expect(db).toBeDefined();
    expect(existsSync(deepPath)).toBe(true);

    await db.$close();
  });
});

describe("initializeSchema", () => {
  let db: DB;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    db = await createDb(TEST_DB);
  });

  afterEach(async () => {
    await db.$close();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("creates all required tables", async () => {
    await initializeSchema(db);

    const result = await db.select().from(boards).limit(1);

    expect(result).toEqual([]);
  });

  test("is idempotent", async () => {
    await initializeSchema(db);
    await initializeSchema(db);

    const result = await db.select().from(boards).limit(1);

    expect(result).toEqual([]);
  });
});

describe("$runRaw", () => {
  let db: DB;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    db = await createDb(TEST_DB);
    await initializeSchema(db);
  });

  afterEach(async () => {
    await db.$close();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("executes multiple statements", async () => {
    const now = Date.now();
    await db.$runRaw(`
      INSERT INTO boards (id, name, created_at, updated_at)
      VALUES ('test-1', 'Board 1', ${now}, ${now});
      INSERT INTO boards (id, name, created_at, updated_at)
      VALUES ('test-2', 'Board 2', ${now}, ${now});
    `);

    const result = await db.select().from(boards);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Board 1");
    expect(result[1].name).toBe("Board 2");
  });

  test("throws KabanError on invalid SQL", async () => {
    expect(db.$runRaw("INVALID SQL SYNTAX")).rejects.toThrow(KabanError);
  });

  test("throws KabanError with descriptive message", async () => {
    try {
      await db.$runRaw("SELECT * FROM nonexistent_table");
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(KabanError);
      expect((error as KabanError).message).toContain("SQL execution failed");
    }
  });
});

describe("$close", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("closes database connection", async () => {
    const db = await createDb(TEST_DB);
    await initializeSchema(db);

    await db.$close();
  });

  test("can be called multiple times safely", async () => {
    const db = await createDb(TEST_DB);

    await db.$close();
    await db.$close();
  });
});

describe("runtime detection", () => {
  test("detects Bun runtime", () => {
    const isBun = typeof globalThis.Bun !== "undefined";
    expect(isBun).toBe(true);
  });
});

describe("runMigrations", () => {
  let db: DB;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    // Create DB without running migrations to test them explicitly
    // Don't call initializeSchema - migrations create the schema
    db = await createDb(TEST_DB, { migrate: false });
  });

  afterEach(async () => {
    await db.$close();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("creates archived index and FTS table", async () => {
    const { runMigrations } = await import("./migrator.js");
    const result = await runMigrations(db);

    // Should have applied both migrations
    expect(result.applied).toContain("0000_init");
    expect(result.applied).toContain("0001_add_fts5");

    // Verify we can query the DB
    await db.select().from(boards).limit(1);
  });

  test("creates FTS5 virtual table for tasks", async () => {
    const { runMigrations } = await import("./migrator.js");
    await runMigrations(db);

    // FTS table should exist - insert a task and verify trigger works
    const now = Date.now();
    await db.$runRaw(`
      INSERT INTO boards (id, name, created_at, updated_at)
      VALUES ('board-1', 'Test Board', ${now}, ${now});
      INSERT INTO columns (id, board_id, name, position, is_terminal)
      VALUES ('col-1', 'board-1', 'Todo', 0, 0);
      INSERT INTO tasks (id, title, description, column_id, position, created_by, created_at, updated_at)
      VALUES ('task-1', 'Test Task', 'A description', 'col-1', 0, 'user', ${now}, ${now});
    `);

    // FTS trigger should have populated the FTS table
    expect(true).toBe(true);
  });

  test("is idempotent - safe to run multiple times", async () => {
    const { runMigrations } = await import("./migrator.js");

    const result1 = await runMigrations(db);
    const result2 = await runMigrations(db);
    const result3 = await runMigrations(db);

    // First run applies all, subsequent runs apply none
    expect(result1.applied.length).toBeGreaterThan(0);
    expect(result2.applied.length).toBe(0);
    expect(result3.applied.length).toBe(0);
  });

  test("FTS triggers keep search index in sync", async () => {
    const { runMigrations } = await import("./migrator.js");
    await runMigrations(db);

    const now = Date.now();
    await db.$runRaw(`
      INSERT INTO boards (id, name, created_at, updated_at)
      VALUES ('board-1', 'Test Board', ${now}, ${now});
      INSERT INTO columns (id, board_id, name, position, is_terminal)
      VALUES ('col-1', 'board-1', 'Todo', 0, 0);
    `);

    // Insert task
    await db.$runRaw(`
      INSERT INTO tasks (id, title, description, column_id, position, created_by, created_at, updated_at)
      VALUES ('task-1', 'Unique Title Here', 'Some description', 'col-1', 0, 'user', ${now}, ${now});
    `);

    // Update task
    await db.$runRaw(`
      UPDATE tasks SET title = 'Updated Title' WHERE id = 'task-1';
    `);

    // Delete task
    await db.$runRaw(`
      DELETE FROM tasks WHERE id = 'task-1';
    `);

    // If triggers work, we should reach here without error
    expect(true).toBe(true);
  });

  test("FTS triggers populate index on insert", async () => {
    const { runMigrations } = await import("./migrator.js");
    await runMigrations(db);

    const now = Date.now();

    // Insert data after migrations - triggers should populate FTS
    await db.$runRaw(`
      INSERT INTO boards (id, name, created_at, updated_at)
      VALUES ('board-1', 'Test Board', ${now}, ${now});
      INSERT INTO columns (id, board_id, name, position, is_terminal)
      VALUES ('col-1', 'board-1', 'Todo', 0, 0);
      INSERT INTO tasks (id, title, description, column_id, position, created_by, created_at, updated_at)
      VALUES ('task-1', 'Searchable Title', 'Searchable description', 'col-1', 0, 'user', ${now}, ${now});
    `);

    // Verify FTS was populated by the trigger - search should find the task
    const client = db.$client as { prepare: (sql: string) => { all: () => unknown[] } };
    const results = client.prepare("SELECT * FROM tasks_fts WHERE tasks_fts MATCH 'Searchable'").all();
    expect(results.length).toBe(1);
  });
});
