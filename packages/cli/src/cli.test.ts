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

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  try {
    const quotedArgs = args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`).join(" ");
    const stdout = execSync(`bun ${CLI} ${quotedArgs}`, {
      cwd: TEST_DIR,
      encoding: "utf-8",
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() || "",
      stderr: error.stderr?.toString() || error.message || "",
      exitCode: error.status || 1,
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

     const taskId = jsonResponse.data[0].id.slice(0, 8);
     run(`move ${taskId} in_progress`);

     const afterMove = run("list --json");
     const afterMoveResponse = JSON.parse(afterMove);
     const movedTask = afterMoveResponse.data.find((t: { id: string }) => t.id.startsWith(taskId));
     expect(movedTask.columnId).toBe("in_progress");

     run(`done ${taskId}`);
     const afterDone = run("list --json");
     const afterDoneResponse = JSON.parse(afterDone);
     const doneTask = afterDoneResponse.data.find((t: { id: string }) => t.id.startsWith(taskId));
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
    
    // Verify actual assignment in database
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    const tasks = response.data;
    const task = tasks.find((t: any) => t.id.startsWith(id));
    expect(task.assignedTo).toBe("claude");
  });

  test("unassigns task with --clear", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    runCli(["assign", id!, "claude"]);
    const { stdout: clearOut, exitCode } = runCli(["assign", id!, "--clear"]);
    expect(exitCode).toBe(0);
    expect(clearOut).toContain("Unassigned");
    
    // Verify unassignment
    const { stdout: listOut } = runCli(["list", "--json"]);
    const response = JSON.parse(listOut);
    const tasks = response.data;
    const task = tasks.find((t: any) => t.id.startsWith(id));
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

   test("fails when assigning archived task", async () => {
     const { stdout } = runCli(["add", "Test task"]);
     const id = stdout.match(/\[([^\]]+)\]/)?.[1];
     
     runCli(["move", id!, "done"]);
     runCli(["archive"]);
     
     const { stderr, exitCode } = runCli(["assign", id!, "claude"]);
     expect(exitCode).not.toBe(0);
     expect(stderr).toContain("not found"); // Archived tasks not in active list
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
    const task = tasks.find((t: any) => t.id.startsWith(id));
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
    const task = tasks.find((t: any) => t.id.startsWith(id));
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
    const task = tasks.find((t: any) => t.id.startsWith(id));
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
