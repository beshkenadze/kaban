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

interface ExecError extends Error {
  stdout?: Buffer | string;
  stderr?: Buffer | string;
  status?: number;
}

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const quotedArgs = args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(" ");
    const stdout = execSync(`bun ${CLI} ${quotedArgs}`, {
      cwd: TEST_DIR,
      encoding: "utf-8",
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error) {
    const e = error as ExecError;
    return {
      stdout: e.stdout?.toString() || "",
      stderr: e.stderr?.toString() || e.message || "",
      exitCode: e.status || 1,
    };
  }
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
     const jsonResponse = JSON.parse(jsonOutput);
     expect(jsonResponse.success).toBe(true);
     expect(jsonResponse.data).toHaveLength(3);

     const statusOutput = run("status");
     expect(statusOutput).toContain("Test Board");

     const taskId = jsonResponse.data[0].id;
     run(`move ${taskId} in_progress`);

     const afterMove = run("list --json");
     const afterMoveResponse = JSON.parse(afterMove);
     const movedTask = afterMoveResponse.data.find((t: { id: string }) => t.id === taskId);
     expect(movedTask.columnId).toBe("in_progress");

     run(`done ${taskId}`);
     const afterDone = run("list --json");
     const afterDoneResponse = JSON.parse(afterDone);
     const doneTask = afterDoneResponse.data.find((t: { id: string }) => t.id === taskId);
     expect(doneTask.columnId).toBe("done");
     expect(doneTask.completedAt).not.toBeNull();
   });
});

describe("assign command", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    run("init --name 'Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("assigns task to agent", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: assignOut, exitCode } = runCli(["assign", id!, "claude"]);
    expect(exitCode).toBe(0);
    expect(assignOut).toContain("Assigned");
    expect(assignOut).toContain("claude");
    
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    const tasks = response.data;
    const task = tasks.find((t: { id: string }) => t.id.startsWith(id!));
    expect(task.assignedTo).toBe("claude");
  });

  test("unassigns task with --clear", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    runCli(["assign", id!, "claude"]);
    const { stdout: clearOut, exitCode } = runCli(["assign", id!, "--clear"]);
    expect(exitCode).toBe(0);
    expect(clearOut).toContain("Unassigned");
    
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    const tasks = response.data;
    const task = tasks.find((t: { id: string }) => t.id.startsWith(id!));
    expect(task.assignedTo).toBeNull();
  });

  test("fails on invalid agent name", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stderr, exitCode } = runCli(["assign", id!, "Invalid Agent!"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Error");
  });

  test("shows previous assignee when reassigning", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    runCli(["assign", id!, "claude"]);
    const { stdout: reassignOut } = runCli(["assign", id!, "gemini"]);
    expect(reassignOut).toContain("gemini");
    expect(reassignOut).toContain("was: claude");
  });

  test("errors when --clear used with agent argument", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stderr, exitCode } = runCli(["assign", id!, "claude", "--clear"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Cannot use --clear with agent");
  });

  test("outputs valid JSON with --json flag", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: jsonOut, exitCode } = runCli(["assign", id!, "claude", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(jsonOut);
    expect(result.data.assignedTo).toBe("claude");
    expect(result.data.id).toBeDefined();
  });

   test("can assign archived task (resolveTask finds archived tasks)", async () => {
     const { stdout } = runCli(["add", "Test task"]);
     const id = stdout.match(/\[([^\]]+)\]/)?.[1];
     
     runCli(["move", id!, "done"]);
     runCli(["archive"]);
     
     const { stdout: assignOut, exitCode } = runCli(["assign", id!, "claude"]);
     expect(exitCode).toBe(0);
     expect(assignOut).toContain("Assigned");
   });
});

describe("move --assign", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    run("init --name 'Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("assigns task when moving with --assign", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: moveOut, exitCode } = runCli([
      "move", id!, "in_progress", "--assign", "claude"
    ]);
    expect(exitCode).toBe(0);
    expect(moveOut).toContain("In Progress");
    expect(moveOut).toContain("assigned to claude");
    
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    const tasks = response.data;
    const task = tasks.find((t: { id: string }) => t.id.startsWith(id!));
    expect(task.assignedTo).toBe("claude");
  });

  test("auto-assigns with current agent when --assign without value", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { exitCode } = runCli(["move", id!, "in_progress", "--assign"]);
    expect(exitCode).toBe(0);
    
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    const tasks = response.data;
    const task = tasks.find((t: { id: string }) => t.id.startsWith(id!));
    expect(task.assignedTo).toBeTruthy();
  });

  test("fails with invalid agent name in --assign", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stderr, exitCode } = runCli([
      "move", id!, "in_progress", "--assign", "Invalid Agent!"
    ]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Error");
  });

  test("--assign works with --next flag", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { exitCode } = runCli(["move", id!, "--next", "--assign", "claude"]);
    expect(exitCode).toBe(0);
    
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    const tasks = response.data;
    const task = tasks.find((t: { id: string }) => t.id.startsWith(id!));
    expect(task.assignedTo).toBe("claude");
    expect(task.columnId).toBe("in_progress");
  });

  test("JSON output includes assignedTo after move --assign", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: jsonOut, exitCode } = runCli([
      "move", id!, "in_progress", "--assign", "claude", "--json"
    ]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(jsonOut);
    expect(result.data.assignedTo).toBe("claude");
  });
});

describe("get command", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    run("init --name 'Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("gets task by full ID", async () => {
    const { stdout } = runCli(["add", "Test task", "--description", "Test description"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    const fullId = response.data.find((t: { id: string }) => t.id.startsWith(id!))?.id;
    
    const { stdout: getOut, exitCode } = runCli(["get", fullId]);
    expect(exitCode).toBe(0);
    expect(getOut).toContain("Test task");
    expect(getOut).toContain("Test description");
  });

  test("gets task by partial ID", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: getOut, exitCode } = runCli(["get", id!]);
    expect(exitCode).toBe(0);
    expect(getOut).toContain("Test task");
  });

  test("returns JSON with --json flag", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: jsonOut, exitCode } = runCli(["get", id!, "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(jsonOut);
    expect(result.data.title).toBe("Test task");
    expect(result.data.id).toContain(id);
  });

  test("fails for non-existent task", async () => {
    const { stderr, exitCode } = runCli(["get", "nonexistent"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not found");
  });
});

describe("edit command", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    run("init --name 'Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("edits task title", async () => {
    const { stdout } = runCli(["add", "Original title"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: editOut, exitCode } = runCli(["edit", id!, "--title", "New title"]);
    expect(exitCode).toBe(0);
    expect(editOut).toContain("New title");
    
    const { stdout: getOut } = runCli(["get", id!, "--json"]);
    const result = JSON.parse(getOut);
    expect(result.data.title).toBe("New title");
  });

  test("edits task description", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { exitCode } = runCli(["edit", id!, "--description", "New description"]);
    expect(exitCode).toBe(0);
    
    const { stdout: getOut } = runCli(["get", id!, "--json"]);
    const result = JSON.parse(getOut);
    expect(result.data.description).toBe("New description");
  });

  test("clears description with --clear-description", async () => {
    const { stdout } = runCli(["add", "Test task", "--description", "Original"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { exitCode } = runCli(["edit", id!, "--clear-description"]);
    expect(exitCode).toBe(0);
    
    const { stdout: getOut } = runCli(["get", id!, "--json"]);
    const result = JSON.parse(getOut);
    expect(result.data.description).toBeNull();
  });

  test("edits labels", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { exitCode } = runCli(["edit", id!, "--labels", "bug, urgent"]);
    expect(exitCode).toBe(0);
    
    const { stdout: getOut } = runCli(["get", id!, "--json"]);
    const result = JSON.parse(getOut);
    expect(result.data.labels).toContain("bug");
    expect(result.data.labels).toContain("urgent");
  });

  test("fails without any update options", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stderr, exitCode } = runCli(["edit", id!]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No updates specified");
  });

  test("returns JSON with --json flag", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: jsonOut, exitCode } = runCli(["edit", id!, "--title", "Updated", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(jsonOut);
    expect(result.data.title).toBe("Updated");
  });
});

describe("delete command", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    run("init --name 'Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("deletes task with --force", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: deleteOut, exitCode } = runCli(["delete", id!, "--force"]);
    expect(exitCode).toBe(0);
    expect(deleteOut).toContain("Deleted");
    
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    expect(response.data.length).toBe(0);
  });

  test("returns JSON with --json flag", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: jsonOut, exitCode } = runCli(["delete", id!, "--force", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(jsonOut);
    expect(result.data.deleted).toBe(true);
  });

  test("fails for non-existent task", async () => {
    const { stderr, exitCode } = runCli(["delete", "nonexistent", "--force"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not found");
  });
});

describe("next command", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    run("init --name 'Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("returns next task from todo column", async () => {
    runCli(["add", "Task 1"]);
    runCli(["add", "Task 2"]);
    
    const { stdout: nextOut, exitCode } = runCli(["next"]);
    expect(exitCode).toBe(0);
    expect(nextOut).toContain("Next:");
    expect(nextOut).toContain("Score:");
  });

  test("returns task from specified column", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    runCli(["move", id!, "in_progress"]);
    
    const { stdout: nextOut, exitCode } = runCli(["next", "--column", "in_progress"]);
    expect(exitCode).toBe(0);
    expect(nextOut).toContain("Test task");
  });

  test("returns JSON with --json flag", async () => {
    runCli(["add", "Test task"]);
    
    const { stdout: jsonOut, exitCode } = runCli(["next", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(jsonOut);
    expect(result.data.task.title).toBe("Test task");
    expect(result.data.score).toBeDefined();
  });

  test("handles empty column", async () => {
    const { stdout: nextOut, exitCode } = runCli(["next"]);
    expect(exitCode).toBe(0);
    expect(nextOut).toContain("No actionable tasks");
  });
});

describe("stats command", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    run("init --name 'Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("shows board statistics", async () => {
    runCli(["add", "Task 1"]);
    runCli(["add", "Task 2"]);
    
    const { stdout: statsOut, exitCode } = runCli(["stats"]);
    expect(exitCode).toBe(0);
    expect(statsOut).toContain("Board Statistics");
    expect(statsOut).toContain("Active tasks:");
    expect(statsOut).toContain("By Column:");
  });

  test("returns JSON with --json flag", async () => {
    runCli(["add", "Task 1"]);
    
    const { stdout: jsonOut, exitCode } = runCli(["stats", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(jsonOut);
    expect(result.data.activeTasks).toBe(1);
    expect(result.data.byColumn).toBeDefined();
    expect(Array.isArray(result.data.byColumn)).toBe(true);
  });

  test("counts archived tasks correctly", async () => {
    const { stdout } = runCli(["add", "Task 1"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    runCli(["move", id!, "done"]);
    runCli(["archive"]);
    
    const { stdout: jsonOut } = runCli(["stats", "--json"]);
    const result = JSON.parse(jsonOut);
    expect(result.data.archivedTasks).toBe(1);
    expect(result.data.activeTasks).toBe(0);
  });
});

describe("audit command", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
    run("init --name 'Test Board'");
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("audit list shows entries after task creation", () => {
    runCli(["add", "Test task"]);
    
    const { stdout, exitCode } = runCli(["audit", "list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Audit Log");
    expect(stdout).toContain("CREATE");
    expect(stdout).toContain("task");
  });

  test("audit list --json returns valid JSON", () => {
    runCli(["add", "Test task"]);
    
    const { stdout, exitCode } = runCli(["audit", "list", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.success).toBe(true);
    expect(result.data.entries).toBeDefined();
    expect(result.data.total).toBeGreaterThan(0);
  });

  test("audit task shows task history", () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    runCli(["move", id!, "in_progress"]);
    
    const { stdout: historyOut, exitCode } = runCli(["audit", "task", id!]);
    expect(exitCode).toBe(0);
    expect(historyOut).toContain("History for");
    expect(historyOut).toContain("CREATED");
    expect(historyOut).toContain("columnId");
  });

  test("audit task --json returns valid JSON", () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: jsonOut, exitCode } = runCli(["audit", "task", id!, "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(jsonOut);
    expect(result.success).toBe(true);
    expect(result.data.task.id).toBeDefined();
    expect(result.data.entries).toBeDefined();
  });

  test("audit task fails for non-existent task", () => {
    const { stderr, exitCode } = runCli(["audit", "task", "nonexistent"]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not found");
  });

  test("audit stats shows statistics", () => {
    runCli(["add", "Task 1"]);
    runCli(["add", "Task 2"]);
    
    const { stdout, exitCode } = runCli(["audit", "stats"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Audit Statistics");
    expect(stdout).toContain("Total entries:");
    expect(stdout).toContain("By Event Type:");
    expect(stdout).toContain("By Object Type:");
  });

  test("audit stats --json returns valid JSON", () => {
    runCli(["add", "Test task"]);
    
    const { stdout, exitCode } = runCli(["audit", "stats", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.success).toBe(true);
    expect(result.data.totalEntries).toBeGreaterThan(0);
    expect(result.data.byEventType).toBeDefined();
    expect(result.data.byObjectType).toBeDefined();
  });

  test("audit actor shows changes by actor", () => {
    runCli(["add", "Task by alice", "--agent", "alice"]);
    runCli(["add", "Task by bob", "--agent", "bob"]);
    
    const { stdout, exitCode } = runCli(["audit", "actor", "alice"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Changes by @alice");
    expect(stdout).toContain("Task by alice");
  });

  test("audit list with --actor filter", () => {
    runCli(["add", "Task by alice", "--agent", "alice"]);
    runCli(["add", "Task by bob", "--agent", "bob"]);
    
    const { stdout, exitCode } = runCli(["audit", "list", "--actor", "alice", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.data.entries.every((e: { actor: string }) => e.actor === "alice")).toBe(true);
  });

  test("audit list with --type filter", () => {
    runCli(["add", "Test task"]);
    
    const { stdout, exitCode } = runCli(["audit", "list", "--type", "task", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.data.entries.every((e: { objectType: string }) => e.objectType === "task")).toBe(true);
  });

  test("audit list with --event filter", () => {
    runCli(["add", "Test task"]);
    
    const { stdout, exitCode } = runCli(["audit", "list", "--event", "CREATE", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.data.entries.every((e: { eventType: string }) => e.eventType === "CREATE")).toBe(true);
  });

  test("audit list with --limit option", () => {
    for (let i = 0; i < 5; i++) {
      runCli(["add", `Task ${i}`]);
    }
    
    const { stdout, exitCode } = runCli(["audit", "list", "--limit", "2", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.data.entries.length).toBe(2);
    expect(result.data.hasMore).toBe(true);
  });
});
