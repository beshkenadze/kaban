import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { createDb, type DB, initializeSchema } from "./index.js";
import { boards } from "./schema.js";
import { KabanError } from "../types.js";

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
