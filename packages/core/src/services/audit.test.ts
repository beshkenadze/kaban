import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { createDb, type DB, initializeSchema } from "../db/index.js";
import { DEFAULT_CONFIG } from "../types.js";
import { AuditService } from "./audit.js";
import { BoardService } from "./board.js";
import { TaskService } from "./task.js";

const TEST_DIR = ".kaban-test-audit";
const TEST_DB = `${TEST_DIR}/board.db`;

describe("AuditService", () => {
  let db: DB;
  let boardService: BoardService;
  let taskService: TaskService;
  let auditService: AuditService;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    db = await createDb(TEST_DB);
    await initializeSchema(db);
    boardService = new BoardService(db);
    taskService = new TaskService(db, boardService);
    auditService = new AuditService(db);
    await boardService.initializeBoard(DEFAULT_CONFIG);
  });

  afterEach(async () => {
    await db.$close();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  describe("getHistory", () => {
    test("returns empty result when no audit entries", async () => {
      const result = await auditService.getHistory({ limit: 10 });

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    test("returns recent entries after task creation", async () => {
      await taskService.addTask({ title: "Test", createdBy: "user" });
      const result = await auditService.getHistory({ limit: 10 });

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    test("filters by actor", async () => {
      await taskService.addTask({ title: "Task 1", createdBy: "alice" });
      await taskService.addTask({ title: "Task 2", createdBy: "bob" });

      const result = await auditService.getHistory({ actor: "alice" });
      expect(result.entries.every((e) => e.actor === "alice")).toBe(true);
    });

    test("filters by object type", async () => {
      await taskService.addTask({ title: "Test" });

      const result = await auditService.getHistory({ objectType: "task" });
      expect(result.entries.every((e) => e.objectType === "task")).toBe(true);
    });

    test("filters by event type", async () => {
      await taskService.addTask({ title: "Test" });

      const result = await auditService.getHistory({ eventType: "CREATE" });
      expect(result.entries.every((e) => e.eventType === "CREATE")).toBe(true);
    });

    test("filters by date range", async () => {
      await taskService.addTask({ title: "Test" });
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const result = await auditService.getHistory({
        since: yesterday,
        until: now,
      });

      for (const entry of result.entries) {
        expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
        expect(entry.timestamp.getTime()).toBeLessThanOrEqual(now.getTime());
      }
    });

    test("paginates correctly", async () => {
      for (let i = 0; i < 5; i++) {
        await taskService.addTask({ title: `Task ${i}` });
      }

      const page1 = await auditService.getHistory({ limit: 2 });
      const page2 = await auditService.getHistory({ limit: 2, offset: 2 });

      expect(page1.entries.length).toBe(2);
      expect(page2.entries.length).toBe(2);
      expect(page1.hasMore).toBe(true);
    });

    test("caps limit at 1000", async () => {
      const result = await auditService.getHistory({ limit: 2000 });
      expect(result.entries.length).toBeLessThanOrEqual(1000);
    });

    test("filters by objectId", async () => {
      const task1 = await taskService.addTask({ title: "Task 1" });
      await taskService.addTask({ title: "Task 2" });

      const result = await auditService.getHistory({ objectId: task1.id });
      expect(result.entries.every((e) => e.objectId === task1.id)).toBe(true);
    });

    test("combines multiple filters", async () => {
      const task = await taskService.addTask({ title: "Original", createdBy: "alice" });
      await taskService.updateTask(task.id, { title: "Updated" }, undefined, "alice");

      const result = await auditService.getHistory({
        actor: "alice",
        eventType: "UPDATE",
        objectType: "task",
      });

      expect(result.entries.every((e) => e.actor === "alice")).toBe(true);
      expect(result.entries.every((e) => e.eventType === "UPDATE")).toBe(true);
      expect(result.entries.every((e) => e.objectType === "task")).toBe(true);
    });
  });

  describe("getTaskHistory", () => {
    test("returns history for specific task", async () => {
      const task = await taskService.addTask({ title: "Original" });
      await taskService.updateTask(task.id, { title: "Updated" }, undefined, "user");
      await taskService.moveTask(task.id, "in_progress");

      const history = await auditService.getTaskHistory(task.id);

      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history.every((e) => e.objectId === task.id)).toBe(true);
    });

    test("returns empty array for invalid task ID", async () => {
      const history = await auditService.getTaskHistory("nonexistent-id");
      expect(history).toHaveLength(0);
    });

    test("returns entries in reverse chronological order", async () => {
      const task = await taskService.addTask({ title: "Test" });
      await taskService.updateTask(task.id, { title: "Updated 1" }, undefined, "user");
      await taskService.updateTask(task.id, { title: "Updated 2" }, undefined, "user");

      const history = await auditService.getTaskHistory(task.id);

      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          history[i + 1].timestamp.getTime()
        );
      }
    });
  });

  describe("getRecentChanges", () => {
    test("returns recent entries across all objects", async () => {
      await taskService.addTask({ title: "Task 1" });
      await taskService.addTask({ title: "Task 2" });

      const changes = await auditService.getRecentChanges(10);
      expect(changes.length).toBeGreaterThanOrEqual(2);
    });

    test("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await taskService.addTask({ title: `Task ${i}` });
      }

      const changes = await auditService.getRecentChanges(2);
      expect(changes.length).toBe(2);
    });
  });

  describe("getChangesByActor", () => {
    test("returns changes by specific actor", async () => {
      await taskService.addTask({ title: "Task 1", createdBy: "alice" });
      await taskService.addTask({ title: "Task 2", createdBy: "bob" });
      await taskService.addTask({ title: "Task 3", createdBy: "alice" });

      const changes = await auditService.getChangesByActor("alice");
      expect(changes.every((e) => e.actor === "alice")).toBe(true);
      expect(changes.length).toBe(2);
    });

    test("returns empty array for unknown actor", async () => {
      await taskService.addTask({ title: "Task 1", createdBy: "alice" });

      const changes = await auditService.getChangesByActor("unknown");
      expect(changes).toHaveLength(0);
    });
  });

  describe("getStats", () => {
    test("returns correct statistics", async () => {
      await taskService.addTask({ title: "Test", createdBy: "alice" });
      await taskService.addTask({ title: "Test 2", createdBy: "bob" });

      const stats = await auditService.getStats();

      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.byEventType.CREATE).toBeGreaterThan(0);
      expect(stats.byObjectType.task).toBeGreaterThan(0);
      expect(stats.recentActors).toContain("alice");
      expect(stats.recentActors).toContain("bob");
    });

    test("returns zeros when no audit entries", async () => {
      const stats = await auditService.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.byEventType.CREATE).toBe(0);
      expect(stats.byEventType.UPDATE).toBe(0);
      expect(stats.byEventType.DELETE).toBe(0);
      expect(stats.byObjectType.task).toBe(0);
      expect(stats.byObjectType.column).toBe(0);
      expect(stats.byObjectType.board).toBe(0);
      expect(stats.recentActors).toHaveLength(0);
    });

    test("includes UPDATE and DELETE counts", async () => {
      const task = await taskService.addTask({ title: "Original" });
      await taskService.updateTask(task.id, { title: "Updated" }, undefined, "user");
      await taskService.deleteTask(task.id);

      const stats = await auditService.getStats();

      expect(stats.byEventType.CREATE).toBeGreaterThan(0);
      expect(stats.byEventType.UPDATE).toBeGreaterThan(0);
      expect(stats.byEventType.DELETE).toBeGreaterThan(0);
    });
  });
});
