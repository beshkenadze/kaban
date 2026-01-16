import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = "/tmp/kaban-cli-test";
const CLI = join(import.meta.dir, "../dist/index.js");

function run(cmd: string): string {
  return execSync(`bun ${CLI} ${cmd}`, {
    cwd: TEST_DIR,
    encoding: "utf-8",
  });
}

describe("CLI Integration", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("full workflow: init -> add -> list -> move -> done", () => {
    const initOutput = run("init --name 'Test Board'");
    expect(initOutput).toContain("Initialized");

    run('add "Task 1"');
    run('add "Task 2" --column backlog');
    run('add "Task 3" --agent claude');

    const listOutput = run("list");
    expect(listOutput).toContain("Task 1");
    expect(listOutput).toContain("Task 2");
    expect(listOutput).toContain("Task 3");

    const agentList = run("list --agent claude");
    expect(agentList).toContain("Task 3");
    expect(agentList).not.toContain("Task 1");

    const jsonOutput = run("list --json");
    const tasks = JSON.parse(jsonOutput);
    expect(tasks).toHaveLength(3);

    const statusOutput = run("status");
    expect(statusOutput).toContain("Test Board");

    const taskId = tasks[0].id.slice(0, 8);
    run(`move ${taskId} in_progress`);

    const afterMove = run("list --json");
    const movedTask = JSON.parse(afterMove).find((t: { id: string }) => t.id.startsWith(taskId));
    expect(movedTask.columnId).toBe("in_progress");

    run(`done ${taskId}`);
    const afterDone = run("list --json");
    const doneTask = JSON.parse(afterDone).find((t: { id: string }) => t.id.startsWith(taskId));
    expect(doneTask.columnId).toBe("done");
    expect(doneTask.completedAt).not.toBeNull();
  });
});
