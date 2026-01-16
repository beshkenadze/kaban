import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { TaskService } from "./task.js";
import { BoardService } from "./board.js";
import { createDb, initializeSchema, type DB } from "../db/index.js";
import { DEFAULT_CONFIG, KabanError, ExitCode } from "../types.js";
import { unlinkSync, existsSync, rmSync } from "node:fs";

const TEST_DIR = ".kaban-test-task";
const TEST_DB = `${TEST_DIR}/board.db`;

describe("TaskService", () => {
  let db: DB;
  let boardService: BoardService;
  let taskService: TaskService;

  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    db = createDb(TEST_DB);
    initializeSchema(db);
    boardService = new BoardService(db);
    taskService = new TaskService(db, boardService);
    boardService.initializeBoard(DEFAULT_CONFIG);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  describe("addTask", () => {
    test("creates task with defaults", () => {
      const task = taskService.addTask({ title: "Test task" });

      expect(task.title).toBe("Test task");
      expect(task.columnId).toBe("todo");
      expect(task.createdBy).toBe("user");
      expect(task.version).toBe(1);
      expect(task.id).toHaveLength(26);
    });

    test("creates task with custom column and agent", () => {
      const task = taskService.addTask({
        title: "Agent task",
        columnId: "backlog",
        agent: "claude",
      });

      expect(task.columnId).toBe("backlog");
      expect(task.createdBy).toBe("claude");
    });

    test("throws on invalid column", () => {
      expect(() =>
        taskService.addTask({ title: "Test", columnId: "invalid" }),
      ).toThrow(KabanError);
    });
  });

  describe("getTask", () => {
    test("returns task by ID", () => {
      const created = taskService.addTask({ title: "Test" });
      const found = taskService.getTask(created.id);

      expect(found).not.toBeNull();
      expect(found?.title).toBe("Test");
    });

    test("returns null for nonexistent task", () => {
      expect(taskService.getTask("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBeNull();
    });
  });

  describe("listTasks", () => {
    test("returns all tasks", () => {
      taskService.addTask({ title: "Task 1" });
      taskService.addTask({ title: "Task 2" });

      const tasks = taskService.listTasks();
      expect(tasks).toHaveLength(2);
    });

    test("filters by column", () => {
      taskService.addTask({ title: "Todo", columnId: "todo" });
      taskService.addTask({ title: "Backlog", columnId: "backlog" });

      const tasks = taskService.listTasks({ columnId: "todo" });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Todo");
    });

    test("filters by agent", () => {
      taskService.addTask({ title: "User task", agent: "user" });
      taskService.addTask({ title: "Claude task", agent: "claude" });

      const tasks = taskService.listTasks({ agent: "claude" });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Claude task");
    });
  });

  describe("deleteTask", () => {
    test("deletes task", () => {
      const task = taskService.addTask({ title: "To delete" });
      taskService.deleteTask(task.id);

      expect(taskService.getTask(task.id)).toBeNull();
    });

    test("throws on nonexistent task", () => {
      expect(() =>
        taskService.deleteTask("01ARZ3NDEKTSV4RRFFQ69G5FAV"),
      ).toThrow(KabanError);
    });
  });

  describe("moveTask", () => {
    test("moves task to new column", () => {
      const task = taskService.addTask({ title: "Movable", columnId: "todo" });
      const moved = taskService.moveTask(task.id, "in_progress");

      expect(moved.columnId).toBe("in_progress");
      expect(moved.version).toBe(2);
    });

    test("rejects move when WIP limit exceeded", () => {
      // in_progress has wipLimit: 3
      taskService.addTask({ title: "Task 1", columnId: "in_progress" });
      taskService.addTask({ title: "Task 2", columnId: "in_progress" });
      taskService.addTask({ title: "Task 3", columnId: "in_progress" });

      const task = taskService.addTask({ title: "Task 4", columnId: "todo" });

      expect(() => taskService.moveTask(task.id, "in_progress")).toThrow(
        /WIP limit/,
      );
    });

    test("allows move with --force when WIP limit exceeded", () => {
      taskService.addTask({ title: "Task 1", columnId: "in_progress" });
      taskService.addTask({ title: "Task 2", columnId: "in_progress" });
      taskService.addTask({ title: "Task 3", columnId: "in_progress" });

      const task = taskService.addTask({ title: "Task 4", columnId: "todo" });
      const moved = taskService.moveTask(task.id, "in_progress", { force: true });

      expect(moved.columnId).toBe("in_progress");
    });

    test("sets completedAt when moving to terminal column", () => {
      const task = taskService.addTask({ title: "To complete" });
      const moved = taskService.moveTask(task.id, "done");

      expect(moved.completedAt).not.toBeNull();
    });
  });
});
