import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { createDb, type DB, initializeSchema } from "../db/index.js";
import { DEFAULT_CONFIG, KabanError } from "../types.js";
import { BoardService } from "./board.js";
import { TaskService } from "./task.js";

const TEST_DIR = ".kaban-test-task";
const TEST_DB = `${TEST_DIR}/board.db`;

describe("TaskService", () => {
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

  describe("addTask", () => {
    test("creates task with defaults", async () => {
      const task = await taskService.addTask({ title: "Test task" });

      expect(task.title).toBe("Test task");
      expect(task.columnId).toBe("todo");
      expect(task.createdBy).toBe("user");
      expect(task.version).toBe(1);
      expect(task.id).toHaveLength(26);
    });

    test("creates task with custom column and agent", async () => {
      const task = await taskService.addTask({
        title: "Agent task",
        columnId: "backlog",
        agent: "claude",
      });

      expect(task.columnId).toBe("backlog");
      expect(task.createdBy).toBe("claude");
    });

    test("throws on invalid column", async () => {
      expect(taskService.addTask({ title: "Test", columnId: "invalid" })).rejects.toThrow(
        KabanError,
      );
    });
  });

  describe("getTask", () => {
    test("returns task by ID", async () => {
      const created = await taskService.addTask({ title: "Test" });
      const found = await taskService.getTask(created.id);

      expect(found).not.toBeNull();
      expect(found?.title).toBe("Test");
    });

    test("returns null for nonexistent task", async () => {
      expect(await taskService.getTask("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBeNull();
    });
  });

  describe("listTasks", () => {
    test("returns all tasks", async () => {
      await taskService.addTask({ title: "Task 1" });
      await taskService.addTask({ title: "Task 2" });

      const tasks = await taskService.listTasks();
      expect(tasks).toHaveLength(2);
    });

    test("filters by column", async () => {
      await taskService.addTask({ title: "Todo", columnId: "todo" });
      await taskService.addTask({ title: "Backlog", columnId: "backlog" });

      const tasks = await taskService.listTasks({ columnId: "todo" });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Todo");
    });

    test("filters by agent", async () => {
      await taskService.addTask({ title: "User task", agent: "user" });
      await taskService.addTask({ title: "Claude task", agent: "claude" });

      const tasks = await taskService.listTasks({ agent: "claude" });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Claude task");
    });
  });

  describe("deleteTask", () => {
    test("deletes task", async () => {
      const task = await taskService.addTask({ title: "To delete" });
      await taskService.deleteTask(task.id);

      expect(await taskService.getTask(task.id)).toBeNull();
    });

    test("throws on nonexistent task", async () => {
      expect(taskService.deleteTask("01ARZ3NDEKTSV4RRFFQ69G5FAV")).rejects.toThrow(KabanError);
    });
  });

  describe("moveTask", () => {
    test("moves task to new column", async () => {
      const task = await taskService.addTask({ title: "Movable", columnId: "todo" });
      const moved = await taskService.moveTask(task.id, "in_progress");

      expect(moved.columnId).toBe("in_progress");
      expect(moved.version).toBe(2);
    });

    test("rejects move when WIP limit exceeded", async () => {
      await taskService.addTask({ title: "Task 1", columnId: "in_progress" });
      await taskService.addTask({ title: "Task 2", columnId: "in_progress" });
      await taskService.addTask({ title: "Task 3", columnId: "in_progress" });

      const task = await taskService.addTask({ title: "Task 4", columnId: "todo" });

      expect(taskService.moveTask(task.id, "in_progress")).rejects.toThrow(/WIP limit/);
    });

    test("allows move with --force when WIP limit exceeded", async () => {
      await taskService.addTask({ title: "Task 1", columnId: "in_progress" });
      await taskService.addTask({ title: "Task 2", columnId: "in_progress" });
      await taskService.addTask({ title: "Task 3", columnId: "in_progress" });

      const task = await taskService.addTask({ title: "Task 4", columnId: "todo" });
      const moved = await taskService.moveTask(task.id, "in_progress", { force: true });

      expect(moved.columnId).toBe("in_progress");
    });

    test("sets completedAt when moving to terminal column", async () => {
      const task = await taskService.addTask({ title: "To complete" });
      const moved = await taskService.moveTask(task.id, "done");

      expect(moved.completedAt).not.toBeNull();
    });
  });

  describe("optimistic locking", () => {
    test("rejects update with stale version", async () => {
      const task = await taskService.addTask({ title: "Original" });

      await taskService.updateTask(task.id, { title: "Updated by other" });

      expect(taskService.updateTask(task.id, { title: "My update" }, task.version)).rejects.toThrow(
        /modified by another agent/,
      );
    });

    test("succeeds with correct version", async () => {
      const task = await taskService.addTask({ title: "Original" });
      const updated = await taskService.updateTask(task.id, { title: "Updated" }, task.version);

      expect(updated.title).toBe("Updated");
      expect(updated.version).toBe(2);
    });
  });
});
