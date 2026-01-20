import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
  BoardService,
  type Config,
  createDb,
  DEFAULT_CONFIG,
  initializeSchema,
  TaskService,
} from "@kaban-board/core";

const TEST_DIR = "/tmp/kaban-mcp-test";
const DB_PATH = `${TEST_DIR}/.kaban/board.db`;
const CONFIG_PATH = `${TEST_DIR}/.kaban/config.json`;

// Helper functions extracted from mcp.ts for testing
function getParam(
  args: Record<string, unknown> | undefined,
  primary: string,
  alias: string,
): string | undefined {
  if (!args) return undefined;
  return (args[primary] as string) ?? (args[alias] as string);
}

describe("MCP Parameter Helpers", () => {
  test("getParam returns primary when both provided", () => {
    const args = { id: "primary-id", taskId: "alias-id" };
    expect(getParam(args, "id", "taskId")).toBe("primary-id");
  });

  test("getParam returns alias when primary missing", () => {
    const args = { taskId: "alias-id" };
    expect(getParam(args, "id", "taskId")).toBe("alias-id");
  });

  test("getParam returns undefined when neither provided", () => {
    const args = { other: "value" };
    expect(getParam(args, "id", "taskId")).toBeUndefined();
  });

  test("getParam handles undefined args", () => {
    expect(getParam(undefined, "id", "taskId")).toBeUndefined();
  });

  test("getParam works for columnId/column alias", () => {
    expect(getParam({ column: "done" }, "columnId", "column")).toBe("done");
    expect(getParam({ columnId: "todo" }, "columnId", "column")).toBe("todo");
    expect(getParam({ columnId: "todo", column: "done" }, "columnId", "column")).toBe("todo");
  });
});

describe("Bug Regression: taskId parameter should not be undefined", () => {
  // These tests verify the exact bug scenario from KABAN_BUG.md
  // Before the fix: using taskId would result in undefined being passed to database

  test("BUG FIX: taskId parameter is correctly extracted (was undefined before fix)", () => {
    // This simulates what happens when an AI agent passes taskId instead of id
    const argsFromAgent = { taskId: "01KF6RQHNHGYWSKJFAFN0TVNQX" };

    // OLD BEHAVIOR (broken): const id = (args as { id: string }).id; // = undefined
    // NEW BEHAVIOR (fixed): uses getParam helper
    const taskId = getParam(argsFromAgent as Record<string, unknown>, "id", "taskId");

    expect(taskId).toBe("01KF6RQHNHGYWSKJFAFN0TVNQX");
    expect(taskId).not.toBeUndefined(); // This would have failed before the fix
  });

  test("BUG FIX: column parameter is correctly extracted (was undefined before fix)", () => {
    // This simulates move_task with 'column' instead of 'columnId'
    const argsFromAgent = { taskId: "01KF6RQHNHGYWSKJFAFN0TVNQX", column: "done" };

    const columnId = getParam(argsFromAgent as Record<string, unknown>, "columnId", "column");

    expect(columnId).toBe("done");
    expect(columnId).not.toBeUndefined();
  });

  test("BUG FIX: should detect missing task ID and return error message", () => {
    // Simulates when neither id nor taskId is provided
    const emptyArgs = {};

    const taskId = getParam(emptyArgs as Record<string, unknown>, "id", "taskId");

    // The handler should check for undefined and return a helpful error
    expect(taskId).toBeUndefined();
    // In the actual handler: if (!taskId) return errorResponse("Task ID required (use 'id' or 'taskId')");
  });

  test("OLD BUG: extracting id directly from args with taskId fails", () => {
    // This demonstrates the exact bug pattern that was broken
    const argsFromAgent = { taskId: "01KF6RQHNHGYWSKJFAFN0TVNQX" };

    // OLD broken code pattern:
    const oldBrokenWay = (argsFromAgent as { id: string }).id;
    expect(oldBrokenWay).toBeUndefined(); // This is what caused "Task 'undefined' not found"

    // NEW fixed code pattern:
    const newFixedWay = getParam(argsFromAgent as Record<string, unknown>, "id", "taskId");
    expect(newFixedWay).toBe("01KF6RQHNHGYWSKJFAFN0TVNQX");
  });
});

describe("MCP Task Operations with Aliases", () => {
  let db: Awaited<ReturnType<typeof createDb>>;
  let boardService: BoardService;
  let taskService: TaskService;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(`${TEST_DIR}/.kaban`, { recursive: true });

    const config: Config = {
      ...DEFAULT_CONFIG,
      board: { name: "Test Board" },
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    db = await createDb(DB_PATH);
    await initializeSchema(db);
    boardService = new BoardService(db);
    await boardService.initializeBoard(config);
    taskService = new TaskService(db, boardService);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("task can be retrieved using id parameter", async () => {
    const created = await taskService.addTask({ title: "Test task" });
    const args = { id: created.id };
    const taskId = getParam(args as Record<string, unknown>, "id", "taskId");

    expect(taskId).toBe(created.id);
    const task = await taskService.getTask(taskId!);
    expect(task?.title).toBe("Test task");
  });

  test("task can be retrieved using taskId parameter (alias)", async () => {
    const created = await taskService.addTask({ title: "Test task" });
    const args = { taskId: created.id };
    const taskId = getParam(args as Record<string, unknown>, "id", "taskId");

    expect(taskId).toBe(created.id);
    const task = await taskService.getTask(taskId!);
    expect(task?.title).toBe("Test task");
  });

  test("task can be moved using columnId parameter", async () => {
    const created = await taskService.addTask({ title: "Test task", columnId: "todo" });
    const args = { id: created.id, columnId: "in_progress" };

    const taskId = getParam(args as Record<string, unknown>, "id", "taskId");
    const columnId = getParam(args as Record<string, unknown>, "columnId", "column");

    const moved = await taskService.moveTask(taskId!, columnId!);
    expect(moved.columnId).toBe("in_progress");
  });

  test("task can be moved using column parameter (alias)", async () => {
    const created = await taskService.addTask({ title: "Test task", columnId: "todo" });
    const args = { taskId: created.id, column: "in_progress" };

    const taskId = getParam(args as Record<string, unknown>, "id", "taskId");
    const columnId = getParam(args as Record<string, unknown>, "columnId", "column");

    const moved = await taskService.moveTask(taskId!, columnId!);
    expect(moved.columnId).toBe("in_progress");
  });

  test("task can be deleted using taskId parameter", async () => {
    const created = await taskService.addTask({ title: "To delete" });
    const args = { taskId: created.id };
    const taskId = getParam(args as Record<string, unknown>, "id", "taskId");

    await taskService.deleteTask(taskId!);
    const task = await taskService.getTask(created.id);
    expect(task).toBeNull();
  });

  test("task can be updated using taskId parameter", async () => {
    const created = await taskService.addTask({ title: "Original" });
    const args = { taskId: created.id, title: "Updated" };
    const taskId = getParam(args as Record<string, unknown>, "id", "taskId");

    const updated = await taskService.updateTask(taskId!, { title: "Updated" });
    expect(updated.title).toBe("Updated");
  });

  test("complete task works with partial id via taskId", async () => {
    const created = await taskService.addTask({ title: "To complete", columnId: "todo" });
    const partialId = created.id.slice(0, 8);
    const args = { taskId: partialId };
    const taskId = getParam(args as Record<string, unknown>, "id", "taskId");

    // Simulate the complete_task logic
    const tasks = await taskService.listTasks();
    const task = tasks.find((t) => t.id.startsWith(taskId!));
    expect(task).toBeDefined();

    const terminal = await boardService.getTerminalColumn();
    const completed = await taskService.moveTask(task!.id, terminal!.id);
    expect(completed.columnId).toBe("done");
    expect(completed.completedAt).not.toBeNull();
  });
});
