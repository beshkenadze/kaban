import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { createDb, type DB, initializeSchema } from "../db/index.js";
import { DEFAULT_CONFIG } from "../types.js";
import { BoardService } from "./board.js";

const TEST_DIR = ".kaban-test-board";
const TEST_DB = `${TEST_DIR}/board.db`;

describe("BoardService", () => {
  let db: DB;
  let service: BoardService;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    db = await createDb(TEST_DB);
    await initializeSchema(db);
    service = new BoardService(db);
  });

  afterEach(async () => {
    await db.$close();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("initializeBoard creates board and columns", async () => {
    const board = await service.initializeBoard(DEFAULT_CONFIG);

    expect(board.name).toBe("Kaban Board");
    expect(board.id).toBeDefined();

    const columns = await service.getColumns();
    expect(columns).toHaveLength(5);
    expect(columns[0].id).toBe("backlog");
    expect(columns[4].isTerminal).toBe(true);
  });

  test("getBoard returns board or null", async () => {
    expect(await service.getBoard()).toBeNull();

    await service.initializeBoard(DEFAULT_CONFIG);
    const board = await service.getBoard();

    expect(board).not.toBeNull();
    expect(board?.name).toBe("Kaban Board");
  });

  test("getColumn returns column by ID", async () => {
    await service.initializeBoard(DEFAULT_CONFIG);

    const column = await service.getColumn("in_progress");
    expect(column).not.toBeNull();
    expect(column?.wipLimit).toBe(3);

    expect(await service.getColumn("nonexistent")).toBeNull();
  });

  test("getTerminalColumn returns done column", async () => {
    await service.initializeBoard(DEFAULT_CONFIG);

    const terminal = await service.getTerminalColumn();
    expect(terminal).not.toBeNull();
    expect(terminal?.id).toBe("done");
  });
});
