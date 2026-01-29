import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { createDb, type DB, initializeSchema } from "../db/index.js";
import { DEFAULT_CONFIG, KabanError } from "../types.js";
import { BoardService } from "./board.js";
import { TaskService } from "./task.js";

const TEST_DIR = ".kaban-test-dependency";
const TEST_DB = `${TEST_DIR}/board.db`;

describe("Cycle Detection", () => {
  let db: DB;
  let boardService: BoardService;
  let taskService: TaskService;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    db = await createDb(TEST_DB);
    await initializeSchema(db);
    boardService = new BoardService(db);
    taskService = new TaskService(db, boardService);
    await boardService.initializeBoard(DEFAULT_CONFIG);
  });

  afterEach(async () => {
    await db.$close();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("detects direct self-reference", async () => {
    const task = await taskService.addTask({ title: "A" });

    await expect(taskService.addDependency(task.id, task.id)).rejects.toThrow(
      /cannot depend on itself/i
    );
  });

  test("detects simple cycle (A->B->A)", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });

    await taskService.addDependency(a.id, b.id);

    await expect(taskService.addDependency(b.id, a.id)).rejects.toThrow(/cycle/i);
  });

  test("detects indirect cycle (A->B->C->A)", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });
    const c = await taskService.addTask({ title: "C" });

    await taskService.addDependency(a.id, b.id);
    await taskService.addDependency(b.id, c.id);

    await expect(taskService.addDependency(c.id, a.id)).rejects.toThrow(/cycle/i);
  });

  test("allows valid dependency chain (no cycle)", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });
    const c = await taskService.addTask({ title: "C" });
    const d = await taskService.addTask({ title: "D" });

    await taskService.addDependency(a.id, b.id);
    await taskService.addDependency(b.id, c.id);

    const result = await taskService.addDependency(d.id, a.id);
    expect(result.dependsOn).toContain(a.id);
  });

  test("handles long chain (10+ nodes)", async () => {
    const tasks = [];
    for (let i = 0; i < 12; i++) {
      tasks.push(await taskService.addTask({ title: `Task ${i}` }));
    }

    for (let i = 0; i < 11; i++) {
      await taskService.addDependency(tasks[i].id, tasks[i + 1].id);
    }

    await expect(taskService.addDependency(tasks[11].id, tasks[0].id)).rejects.toThrow(/cycle/i);
  });

  test("handles diamond pattern without false positive", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });
    const c = await taskService.addTask({ title: "C" });
    const d = await taskService.addTask({ title: "D" });

    await taskService.addDependency(a.id, b.id);
    await taskService.addDependency(a.id, c.id);
    await taskService.addDependency(b.id, d.id);

    const result = await taskService.addDependency(c.id, d.id);
    expect(result.dependsOn).toContain(d.id);
  });

  test("error message contains cycle indicator", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });

    await taskService.addDependency(a.id, b.id);

    try {
      await taskService.addDependency(b.id, a.id);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(KabanError);
      expect((e as KabanError).message).toContain("cycle");
      expect((e as KabanError).message).toMatch(/→/);
    }
  });

  test("detects 4-node cycle", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });
    const c = await taskService.addTask({ title: "C" });
    const d = await taskService.addTask({ title: "D" });

    await taskService.addDependency(a.id, b.id);
    await taskService.addDependency(b.id, c.id);
    await taskService.addDependency(c.id, d.id);

    await expect(taskService.addDependency(d.id, a.id)).rejects.toThrow(/cycle/i);
  });

  test("allows multiple dependencies when no cycle", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });
    const c = await taskService.addTask({ title: "C" });

    await taskService.addDependency(a.id, b.id);
    const result = await taskService.addDependency(a.id, c.id);

    expect(result.dependsOn).toContain(b.id);
    expect(result.dependsOn).toContain(c.id);
    expect(result.dependsOn).toHaveLength(2);
  });

  test("handles disconnected graphs correctly", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });
    const c = await taskService.addTask({ title: "C" });
    const d = await taskService.addTask({ title: "D" });

    await taskService.addDependency(a.id, b.id);

    const result = await taskService.addDependency(c.id, d.id);
    expect(result.dependsOn).toContain(d.id);
  });

  test("cycle in branching path is detected", async () => {
    const a = await taskService.addTask({ title: "A" });
    const b = await taskService.addTask({ title: "B" });
    const c = await taskService.addTask({ title: "C" });
    const d = await taskService.addTask({ title: "D" });

    await taskService.addDependency(a.id, b.id);
    await taskService.addDependency(a.id, c.id);
    await taskService.addDependency(c.id, d.id);
    await taskService.addDependency(d.id, b.id);

    await expect(taskService.addDependency(b.id, a.id)).rejects.toThrow(/cycle/i);
  });
});
