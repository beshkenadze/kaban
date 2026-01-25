import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { createDb, type DB, initializeSchema } from "../db/index.js";
import { migrateArchiveSupport } from "../db/migrate.js";
import { TaskSchema } from "../schemas.js";
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
    await migrateArchiveSupport(db);
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

    test("creates task with archived fields initialized", async () => {
      const task = await taskService.addTask({ title: "Test task" });

      expect(task.archived).toBe(false);
      expect(task.archivedAt).toBeNull();

      const parsed = TaskSchema.safeParse(task);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.archived).toBe(false);
        expect(parsed.data.archivedAt).toBeNull();
      }
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

    test("excludes archived tasks by default", async () => {
      const task1 = await taskService.addTask({ title: "Active task" });
      const task2 = await taskService.addTask({ title: "Archived task" });
      await taskService.archiveTasks("default", { taskIds: [task2.id] });

      const tasks = await taskService.listTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task1.id);
      expect(tasks[0].title).toBe("Active task");
    });

    test("includes archived tasks when includeArchived is true", async () => {
      const task1 = await taskService.addTask({ title: "Active task" });
      const task2 = await taskService.addTask({ title: "Archived task" });
      await taskService.archiveTasks("default", { taskIds: [task2.id] });

      const tasks = await taskService.listTasks({ includeArchived: true });

      expect(tasks).toHaveLength(2);
      const taskIds = tasks.map((t) => t.id);
      expect(taskIds).toContain(task1.id);
      expect(taskIds).toContain(task2.id);
    });

    test("other filters work with archive filter", async () => {
      const task1 = await taskService.addTask({ title: "Active todo", columnId: "todo" });
      const task2 = await taskService.addTask({ title: "Archived todo", columnId: "todo" });
      const task3 = await taskService.addTask({ title: "Active backlog", columnId: "backlog" });
      await taskService.archiveTasks("default", { taskIds: [task2.id] });

      const todoTasks = await taskService.listTasks({ columnId: "todo" });

      expect(todoTasks).toHaveLength(1);
      expect(todoTasks[0].id).toBe(task1.id);

      const allTodoTasks = await taskService.listTasks({ columnId: "todo", includeArchived: true });

      expect(allTodoTasks).toHaveLength(2);
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

    test("with validateDeps:true blocks move to terminal if dependencies incomplete", async () => {
      const dep1 = await taskService.addTask({ title: "Incomplete dep", columnId: "todo" });
      const dep2 = await taskService.addTask({ title: "In progress dep", columnId: "in_progress" });

      const task = await taskService.addTask({
        title: "Task with deps",
        dependsOn: [dep1.id, dep2.id],
      });

      expect(taskService.moveTask(task.id, "done", { validateDeps: true })).rejects.toThrow(
        /blocked by incomplete dependencies/,
      );
    });

    test("with validateDeps:true allows move to terminal if dependencies complete", async () => {
      const dep1 = await taskService.addTask({ title: "Completed dep 1" });
      const dep2 = await taskService.addTask({ title: "Completed dep 2" });
      await taskService.moveTask(dep1.id, "done");
      await taskService.moveTask(dep2.id, "done");

      const task = await taskService.addTask({
        title: "Task with deps",
        dependsOn: [dep1.id, dep2.id],
      });

      const moved = await taskService.moveTask(task.id, "done", { validateDeps: true });

      expect(moved.columnId).toBe("done");
    });

    test("without validateDeps allows move regardless of dependencies", async () => {
      const dep = await taskService.addTask({ title: "Incomplete dep", columnId: "todo" });

      const task = await taskService.addTask({
        title: "Task with deps",
        dependsOn: [dep.id],
      });

      const moved = await taskService.moveTask(task.id, "done");

      expect(moved.columnId).toBe("done");
    });

    test("with validateDeps:true allows move to non-terminal column regardless of dependencies", async () => {
      const dep = await taskService.addTask({ title: "Incomplete dep", columnId: "todo" });

      const task = await taskService.addTask({
        title: "Task with deps",
        dependsOn: [dep.id],
      });

      const moved = await taskService.moveTask(task.id, "in_progress", { validateDeps: true });

      expect(moved.columnId).toBe("in_progress");
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

  describe("archiveTasks", () => {
    test("archives tasks by status (column)", async () => {
      const task1 = await taskService.addTask({ title: "Task 1", columnId: "done" });
      await taskService.moveTask(task1.id, "done");
      const task2 = await taskService.addTask({ title: "Task 2", columnId: "done" });
      await taskService.moveTask(task2.id, "done");
      const task3 = await taskService.addTask({ title: "Task 3", columnId: "todo" });

      const result = await taskService.archiveTasks("default", { status: "done" });

      expect(result.archivedCount).toBe(2);
      expect(result.taskIds).toContain(task1.id);
      expect(result.taskIds).toContain(task2.id);
      expect(result.taskIds).not.toContain(task3.id);

      const archivedTask = await taskService.getTask(task1.id);
      expect(archivedTask?.archived).toBe(true);
      expect(archivedTask?.archivedAt).not.toBeNull();

      const notArchivedTask = await taskService.getTask(task3.id);
      expect(notArchivedTask?.archived).toBe(false);
    });

    test("archives tasks older than a date", async () => {
      const oldTask = await taskService.addTask({ title: "Old task" });
      const newTask = await taskService.addTask({ title: "New task" });

      const cutoffDate = new Date(Date.now() + 1000);

      const result = await taskService.archiveTasks("default", { olderThan: cutoffDate });

      expect(result.archivedCount).toBe(2);
      expect(result.taskIds).toContain(oldTask.id);
      expect(result.taskIds).toContain(newTask.id);
    });

    test("archives specific tasks by IDs", async () => {
      const task1 = await taskService.addTask({ title: "Task 1" });
      const task2 = await taskService.addTask({ title: "Task 2" });
      const task3 = await taskService.addTask({ title: "Task 3" });

      const result = await taskService.archiveTasks("default", { taskIds: [task1.id, task3.id] });

      expect(result.archivedCount).toBe(2);
      expect(result.taskIds).toContain(task1.id);
      expect(result.taskIds).toContain(task3.id);
      expect(result.taskIds).not.toContain(task2.id);

      const archived1 = await taskService.getTask(task1.id);
      const archived3 = await taskService.getTask(task3.id);
      const notArchived = await taskService.getTask(task2.id);

      expect(archived1?.archived).toBe(true);
      expect(archived3?.archived).toBe(true);
      expect(notArchived?.archived).toBe(false);
    });

    test("combines criteria with AND logic", async () => {
      const doneOldTask = await taskService.addTask({ title: "Done old", columnId: "done" });
      await taskService.moveTask(doneOldTask.id, "done");
      const todoOldTask = await taskService.addTask({ title: "Todo old", columnId: "todo" });

      const cutoffDate = new Date(Date.now() + 1000);

      const result = await taskService.archiveTasks("default", {
        status: "done",
        olderThan: cutoffDate,
      });

      expect(result.archivedCount).toBe(1);
      expect(result.taskIds).toContain(doneOldTask.id);
      expect(result.taskIds).not.toContain(todoOldTask.id);
    });

    test("throws error if no criteria provided", async () => {
      await taskService.addTask({ title: "Task" });

      expect(taskService.archiveTasks("default", {})).rejects.toThrow(
        /At least one criteria must be provided/,
      );
    });

    test("skips already-archived tasks", async () => {
      const task1 = await taskService.addTask({ title: "Task 1", columnId: "done" });
      await taskService.moveTask(task1.id, "done");
      const task2 = await taskService.addTask({ title: "Task 2", columnId: "done" });
      await taskService.moveTask(task2.id, "done");

      await taskService.archiveTasks("default", { taskIds: [task1.id] });

      const result = await taskService.archiveTasks("default", { status: "done" });

      expect(result.archivedCount).toBe(1);
      expect(result.taskIds).toContain(task2.id);
      expect(result.taskIds).not.toContain(task1.id);
    });
  });

  describe("restoreTask", () => {
    test("restores archived task to same column", async () => {
      const task = await taskService.addTask({ title: "To archive", columnId: "done" });
      await taskService.archiveTasks("default", { taskIds: [task.id] });

      const archivedTask = await taskService.getTask(task.id);
      expect(archivedTask?.archived).toBe(true);

      const restored = await taskService.restoreTask(task.id);

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.columnId).toBe("done");
      expect(restored.version).toBe(archivedTask!.version + 1);
    });

    test("restores archived task to different column", async () => {
      const task = await taskService.addTask({ title: "To archive", columnId: "done" });
      await taskService.archiveTasks("default", { taskIds: [task.id] });

      const restored = await taskService.restoreTask(task.id, "todo");

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.columnId).toBe("todo");
    });

    test("throws error if task not found", async () => {
      expect(taskService.restoreTask("01ARZ3NDEKTSV4RRFFQ69G5FAV")).rejects.toThrow(/not found/);
    });

    test("throws error if task is not archived", async () => {
      const task = await taskService.addTask({ title: "Active task" });

      expect(taskService.restoreTask(task.id)).rejects.toThrow(/not archived/);
    });

    test("throws error if target column does not exist", async () => {
      const task = await taskService.addTask({ title: "To archive", columnId: "done" });
      await taskService.archiveTasks("default", { taskIds: [task.id] });

      expect(taskService.restoreTask(task.id, "nonexistent_column")).rejects.toThrow(
        /does not exist/,
      );
    });
  });

  describe("searchArchive", () => {
    test("searches archived tasks by title", async () => {
      const task1 = await taskService.addTask({ title: "Fix authentication bug" });
      const task2 = await taskService.addTask({ title: "Add login feature" });
      await taskService.archiveTasks("default", { taskIds: [task1.id, task2.id] });

      const result = await taskService.searchArchive("authentication");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe("Fix authentication bug");
      expect(result.total).toBe(1);
    });

    test("searches archived tasks by description", async () => {
      const task1 = await taskService.addTask({
        title: "Task One",
        description: "This task involves database optimization",
      });
      const task2 = await taskService.addTask({
        title: "Task Two",
        description: "This is about UI changes",
      });
      await taskService.archiveTasks("default", { taskIds: [task1.id, task2.id] });

      const result = await taskService.searchArchive("database");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe("Task One");
      expect(result.total).toBe(1);
    });

    test("returns only archived tasks, not active ones", async () => {
      const archivedTask = await taskService.addTask({ title: "Archived search target" });
      await taskService.addTask({ title: "Active search target" });
      await taskService.archiveTasks("default", { taskIds: [archivedTask.id] });

      const result = await taskService.searchArchive("search target");

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe(archivedTask.id);
      expect(result.tasks[0].archived).toBe(true);
    });

    test("pagination works with limit and offset", async () => {
      const tasks = [];
      for (let i = 1; i <= 5; i++) {
        tasks.push(await taskService.addTask({ title: `Search item ${i}` }));
      }
      await taskService.archiveTasks("default", { taskIds: tasks.map((t) => t.id) });

      const page1 = await taskService.searchArchive("Search item", { limit: 2, offset: 0 });
      const page2 = await taskService.searchArchive("Search item", { limit: 2, offset: 2 });

      expect(page1.tasks).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page2.tasks).toHaveLength(2);
      expect(page2.total).toBe(5);

      const page1Ids = page1.tasks.map((t) => t.id);
      const page2Ids = page2.tasks.map((t) => t.id);
      expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
    });

    test("empty query returns all archived tasks", async () => {
      const task1 = await taskService.addTask({ title: "Archived One" });
      const task2 = await taskService.addTask({ title: "Archived Two" });
      await taskService.addTask({ title: "Active Task" });
      await taskService.archiveTasks("default", { taskIds: [task1.id, task2.id] });

      const result = await taskService.searchArchive("");

      expect(result.tasks).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.tasks.every((t) => t.archived)).toBe(true);
    });

    test("returns total count for pagination UI", async () => {
      const tasks = [];
      for (let i = 1; i <= 10; i++) {
        tasks.push(await taskService.addTask({ title: `Matching keyword ${i}` }));
      }
      await taskService.archiveTasks("default", { taskIds: tasks.map((t) => t.id) });

      const result = await taskService.searchArchive("keyword", { limit: 3 });

      expect(result.tasks).toHaveLength(3);
      expect(result.total).toBe(10);
    });
  });

  describe("purgeArchive", () => {
    test("deletes all archived tasks when no criteria", async () => {
      const task1 = await taskService.addTask({ title: "Archived 1" });
      const task2 = await taskService.addTask({ title: "Archived 2" });
      const task3 = await taskService.addTask({ title: "Active task" });
      await taskService.archiveTasks("default", { taskIds: [task1.id, task2.id] });

      const result = await taskService.purgeArchive();

      expect(result.deletedCount).toBe(2);
      expect(await taskService.getTask(task1.id)).toBeNull();
      expect(await taskService.getTask(task2.id)).toBeNull();
      expect(await taskService.getTask(task3.id)).not.toBeNull();
    });

    test("respects olderThan criteria", async () => {
      const task1 = await taskService.addTask({ title: "Archived 1" });
      const task2 = await taskService.addTask({ title: "Archived 2" });
      await taskService.archiveTasks("default", { taskIds: [task1.id, task2.id] });

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const task3 = await taskService.addTask({ title: "Archived 3 - newer" });
      await taskService.archiveTasks("default", { taskIds: [task3.id] });

      const archivedTask3 = await taskService.getTask(task3.id);
      const cutoffDate = archivedTask3!.archivedAt!;

      const result = await taskService.purgeArchive({ olderThan: cutoffDate });

      expect(result.deletedCount).toBe(2);
      expect(await taskService.getTask(task1.id)).toBeNull();
      expect(await taskService.getTask(task2.id)).toBeNull();
      expect(await taskService.getTask(task3.id)).not.toBeNull();
    });

    test("does not delete non-archived tasks", async () => {
      const archivedTask = await taskService.addTask({ title: "Archived" });
      const activeTask = await taskService.addTask({ title: "Active" });
      await taskService.archiveTasks("default", { taskIds: [archivedTask.id] });

      const result = await taskService.purgeArchive();

      expect(result.deletedCount).toBe(1);
      expect(await taskService.getTask(archivedTask.id)).toBeNull();
      expect(await taskService.getTask(activeTask.id)).not.toBeNull();
    });
  });

  describe("resetBoard", () => {
    test("deletes all tasks", async () => {
      const task1 = await taskService.addTask({ title: "Task 1" });
      const task2 = await taskService.addTask({ title: "Task 2" });
      const task3 = await taskService.addTask({ title: "Task 3" });
      await taskService.archiveTasks("default", { taskIds: [task3.id] });

      const result = await taskService.resetBoard();

      expect(result.deletedCount).toBe(3);
      expect(await taskService.getTask(task1.id)).toBeNull();
      expect(await taskService.getTask(task2.id)).toBeNull();
      expect(await taskService.getTask(task3.id)).toBeNull();
    });
  });

  describe("validateDependencies", () => {
    test("returns valid:true when task has no dependencies", async () => {
      const task = await taskService.addTask({ title: "Task without deps" });

      const result = await taskService.validateDependencies(task.id);

      expect(result.valid).toBe(true);
      expect(result.blockedBy).toEqual([]);
    });

    test("returns valid:true when all dependencies are completed", async () => {
      const dep1 = await taskService.addTask({ title: "Dependency 1" });
      const dep2 = await taskService.addTask({ title: "Dependency 2" });
      await taskService.moveTask(dep1.id, "done");
      await taskService.moveTask(dep2.id, "done");

      const task = await taskService.addTask({
        title: "Task with deps",
        dependsOn: [dep1.id, dep2.id],
      });

      const result = await taskService.validateDependencies(task.id);

      expect(result.valid).toBe(true);
      expect(result.blockedBy).toEqual([]);
    });

    test("returns valid:false with blockedBy when dependencies are incomplete", async () => {
      const completedDep = await taskService.addTask({ title: "Completed dep" });
      await taskService.moveTask(completedDep.id, "done");
      const incompleteDep1 = await taskService.addTask({
        title: "Incomplete dep 1",
        columnId: "todo",
      });
      const incompleteDep2 = await taskService.addTask({
        title: "Incomplete dep 2",
        columnId: "in_progress",
      });

      const task = await taskService.addTask({
        title: "Task with mixed deps",
        dependsOn: [completedDep.id, incompleteDep1.id, incompleteDep2.id],
      });

      const result = await taskService.validateDependencies(task.id);

      expect(result.valid).toBe(false);
      expect(result.blockedBy).toHaveLength(2);
      expect(result.blockedBy).toContain(incompleteDep1.id);
      expect(result.blockedBy).toContain(incompleteDep2.id);
    });

    test("throws error if task not found", async () => {
      expect(taskService.validateDependencies("01ARZ3NDEKTSV4RRFFQ69G5FAV")).rejects.toThrow(
        /not found/,
      );
    });
  });
});
