import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = "/tmp/kaban-hook-test";
const CLI = join(import.meta.dir, "../../dist/index.js");
const KABAN_CLI_ENV = { KABAN_CLI: `bun ${CLI}` };

function runCli(cmd: string): string {
  return execSync(`bun ${CLI} ${cmd}`, {
    cwd: TEST_DIR,
    encoding: "utf-8",
    env: { ...process.env, ...KABAN_CLI_ENV },
  });
}

function runSync(input: object): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("bun", [CLI, "sync", "--no-log"], {
    input: JSON.stringify(input),
    cwd: TEST_DIR,
    encoding: "utf-8",
    env: { ...process.env, ...KABAN_CLI_ENV },
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: result.status ?? 1,
  };
}

function createHookInput(
  todos: Array<{ id: string; content: string; status: string; priority: string }>,
) {
  return {
    session_id: "test-session",
    transcript_path: "/tmp/transcript",
    cwd: TEST_DIR,
    permission_mode: "default",
    hook_event_name: "PostToolUse" as const,
    tool_name: "TodoWrite" as const,
    tool_input: { todos },
    tool_use_id: "test-tool-use-id",
  };
}

describe("Hook Integration", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    runCli("init --name 'Hook Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("creates new task from TodoWrite", () => {
    const input = createHookInput([
      { id: "todo-1", content: "New task from hook", status: "pending", priority: "high" },
    ]);

    const result = runSync(input);
    expect(result.exitCode).toBe(0);

    const listOutput = runCli("list --json");
    const response = JSON.parse(listOutput);
    const task = response.data.find((t: { title: string }) => t.title === "New task from hook");

    expect(task).toBeDefined();
    expect(task.columnId).toBe("todo");
  });

  test("moves task to in_progress when status is in_progress", () => {
    runCli('add "Existing task"');

    const input = createHookInput([
      { id: "todo-1", content: "Existing task", status: "in_progress", priority: "high" },
    ]);

    const result = runSync(input);
    expect(result.exitCode).toBe(0);

    const listOutput = runCli("list --json");
    const response = JSON.parse(listOutput);
    const task = response.data.find((t: { title: string }) => t.title === "Existing task");

    expect(task).toBeDefined();
    expect(task.columnId).toBe("in_progress");
  });

  test("completes task when status is completed", () => {
    runCli('add "Task to complete"');

    const input = createHookInput([
      { id: "todo-1", content: "Task to complete", status: "completed", priority: "high" },
    ]);

    const result = runSync(input);
    expect(result.exitCode).toBe(0);

    const listOutput = runCli("list --json");
    const response = JSON.parse(listOutput);
    const task = response.data.find((t: { title: string }) => t.title === "Task to complete");

    expect(task).toBeDefined();
    expect(task.columnId).toBe("done");
  });

  test("handles multiple todos in single call", () => {
    const input = createHookInput([
      { id: "todo-1", content: "Task A", status: "pending", priority: "high" },
      { id: "todo-2", content: "Task B", status: "in_progress", priority: "medium" },
      { id: "todo-3", content: "Task C", status: "completed", priority: "low" },
    ]);

    const result = runSync(input);
    expect(result.exitCode).toBe(0);

    const listOutput = runCli("list --json");
    const response = JSON.parse(listOutput);

    const taskA = response.data.find((t: { title: string }) => t.title === "Task A");
    const taskB = response.data.find((t: { title: string }) => t.title === "Task B");
    const taskC = response.data.find((t: { title: string }) => t.title === "Task C");

    expect(taskA?.columnId).toBe("todo");
    expect(taskB?.columnId).toBe("in_progress");
    expect(taskC?.columnId).toBe("done");
  });

  test("skips cancelled tasks by default", () => {
    const input = createHookInput([
      { id: "todo-1", content: "Cancelled task", status: "cancelled", priority: "high" },
    ]);

    const result = runSync(input);
    expect(result.exitCode).toBe(0);

    const listOutput = runCli("list --json");
    const response = JSON.parse(listOutput);
    const task = response.data.find((t: { title: string }) => t.title === "Cancelled task");

    expect(task).toBeUndefined();
  });

  test("exits cleanly with empty todos array", () => {
    const input = createHookInput([]);
    const result = runSync(input);
    expect(result.exitCode).toBe(0);
  });

  test("exits cleanly with invalid JSON input", () => {
    const result = spawnSync("bun", [CLI, "sync", "--no-log"], {
      input: "not valid json",
      cwd: TEST_DIR,
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
  });

  test("exits cleanly when not TodoWrite tool", () => {
    const input = {
      session_id: "test",
      transcript_path: "/tmp",
      cwd: TEST_DIR,
      permission_mode: "default",
      hook_event_name: "PostToolUse",
      tool_name: "SomeOtherTool",
      tool_input: {},
      tool_use_id: "123",
    };

    const result = spawnSync("bun", [CLI, "sync", "--no-log"], {
      input: JSON.stringify(input),
      cwd: TEST_DIR,
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
  });

  test("handles task title with special characters", () => {
    const input = createHookInput([
      {
        id: "todo-1",
        content: 'Task with "quotes" and $pecial chars!',
        status: "pending",
        priority: "high",
      },
    ]);

    const result = runSync(input);
    expect(result.exitCode).toBe(0);

    const listOutput = runCli("list --json");
    const response = JSON.parse(listOutput);
    const task = response.data.find((t: { title: string }) => t.title.includes("quotes"));

    expect(task).toBeDefined();
  });
});

describe("Hook with no board", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("skips sync gracefully when no kaban board exists", () => {
    const input = createHookInput([
      { id: "todo-1", content: "Task without board", status: "pending", priority: "high" },
    ]);

    const result = runSync(input);
    expect(result.exitCode).toBe(0);
  });
});
