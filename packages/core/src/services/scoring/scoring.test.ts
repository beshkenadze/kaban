import { describe, expect, test } from "bun:test";
import type { Task } from "../../types.js";
import {
  createBlockingScorer,
  dueDateScorer,
  fifoScorer,
  priorityScorer,
  ScoringService,
} from "./index.js";

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "test-id",
    boardTaskId: 1,
    title: "Test Task",
    description: null,
    columnId: "todo",
    position: 0,
    createdBy: "user",
    assignedTo: null,
    parentId: null,
    dependsOn: [],
    files: [],
    labels: [],
    blockedReason: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    archived: false,
    archivedAt: null,
    dueDate: null,
    updatedBy: null,
    ...overrides,
  };
}

describe("ScoringService", () => {
  describe("basic operations", () => {
    test("adds and removes scorers", () => {
      const service = new ScoringService();
      service.addScorer(fifoScorer);

      expect(service.getScorers()).toHaveLength(1);

      service.removeScorer("fifo");
      expect(service.getScorers()).toHaveLength(0);
    });

    test("scores task with no scorers returns 0", async () => {
      const service = new ScoringService();
      const task = createTask();

      const result = await service.scoreTask(task);

      expect(result.score).toBe(0);
      expect(result.breakdown).toEqual({});
    });
  });

  describe("ranking", () => {
    test("ranks tasks by total score (highest first)", async () => {
      const service = new ScoringService();
      service.addScorer(priorityScorer);

      const tasks = [
        createTask({ id: "low", labels: ["low"] }),
        createTask({ id: "high", labels: ["high"] }),
        createTask({ id: "medium", labels: ["medium"] }),
      ];

      const ranked = await service.rankTasks(tasks);

      expect(ranked[0].task.id).toBe("high");
      expect(ranked[1].task.id).toBe("medium");
      expect(ranked[2].task.id).toBe("low");
    });
  });
});

describe("fifoScorer", () => {
  test("older tasks score higher", async () => {
    const oldTask = createTask({
      id: "old",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });
    const newTask = createTask({
      id: "new",
      createdAt: new Date(),
    });

    const oldScore = await fifoScorer.score(oldTask);
    const newScore = await fifoScorer.score(newTask);

    expect(oldScore).toBeGreaterThan(newScore);
    expect(oldScore).toBeGreaterThan(6);
    expect(newScore).toBeLessThan(1);
  });

  test("is deterministic", async () => {
    const task = createTask({ createdAt: new Date("2024-01-01") });

    const score1 = await fifoScorer.score(task);
    const score2 = await fifoScorer.score(task);

    expect(score1).toBe(score2);
  });
});

describe("priorityScorer", () => {
  test("critical label scores highest", async () => {
    const critical = createTask({ labels: ["critical"] });
    const high = createTask({ labels: ["high"] });
    const none = createTask({ labels: [] });

    expect(await priorityScorer.score(critical)).toBe(1000);
    expect(await priorityScorer.score(high)).toBe(100);
    expect(await priorityScorer.score(none)).toBe(0);
  });

  test("recognizes p0-p4 labels", async () => {
    const p0 = createTask({ labels: ["p0"] });
    const p2 = createTask({ labels: ["p2"] });

    expect(await priorityScorer.score(p0)).toBe(1000);
    expect(await priorityScorer.score(p2)).toBe(100);
  });

  test("uses highest priority when multiple labels", async () => {
    const task = createTask({ labels: ["low", "critical", "medium"] });

    expect(await priorityScorer.score(task)).toBe(1000);
  });

  test("is case-insensitive", async () => {
    const task = createTask({ labels: ["CRITICAL"] });

    expect(await priorityScorer.score(task)).toBe(1000);
  });
});

describe("dueDateScorer", () => {
  test("overdue tasks score highest", async () => {
    const overdue = createTask({
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    const today = createTask({
      dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });
    const nextWeek = createTask({
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const overdueScore = await dueDateScorer.score(overdue);
    const todayScore = await dueDateScorer.score(today);
    const nextWeekScore = await dueDateScorer.score(nextWeek);

    expect(overdueScore).toBeGreaterThan(todayScore);
    expect(todayScore).toBeGreaterThan(nextWeekScore);
  });

  test("no due date returns 0", async () => {
    const task = createTask({ dueDate: null });

    expect(await dueDateScorer.score(task)).toBe(0);
  });
});

describe("blockingScorer", () => {
  test("tasks blocking more score higher", async () => {
    const blockingCounts: Record<string, number> = {
      blocker: 5,
      minor: 1,
      none: 0,
    };

    const scorer = createBlockingScorer(async (id) => blockingCounts[id] ?? 0);

    const blocker = createTask({ id: "blocker" });
    const minor = createTask({ id: "minor" });
    const none = createTask({ id: "none" });

    expect(await scorer.score(blocker)).toBe(250);
    expect(await scorer.score(minor)).toBe(50);
    expect(await scorer.score(none)).toBe(0);
  });
});

describe("combined scoring", () => {
  test("combines multiple scorers", async () => {
    const service = new ScoringService();
    service.addScorer(priorityScorer);
    service.addScorer(fifoScorer);

    const task = createTask({
      labels: ["high"],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    const result = await service.scoreTask(task);

    expect(result.breakdown.priority).toBe(100);
    expect(result.breakdown.fifo).toBeGreaterThan(2);
    expect(result.score).toBeGreaterThan(100);
  });
});
