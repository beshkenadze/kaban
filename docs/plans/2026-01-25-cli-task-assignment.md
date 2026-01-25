# CLI Task Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable agents to claim/assign tasks via CLI, fixing the "all tasks = user" problem.

**Architecture:** Add `assign` command for explicit assignment, extend `move` command with `--claim` flag for auto-assignment when moving to in-progress. Both use existing `TaskService.updateTask()` API.

**Tech Stack:** TypeScript, Commander.js, @kaban-board/core

---

## Problem Summary

| Issue | Root Cause |
|-------|------------|
| All tasks assigned to "user" | CLI doesn't set `assignedTo` field |
| No assign command | `assignedTo` exists in schema but no CLI interface |
| move doesn't claim | `moveTask` doesn't update `assignedTo` |

## Solution

1. **New `assign` command** - Explicit task assignment
2. **`--claim` flag on `move`** - Auto-assign when moving to in-progress
3. **Tests** - Unit tests for both features

---

### Task 1: Create `assign` Command

**Files:**
- Create: `packages/cli/src/commands/assign.ts`
- Modify: `packages/cli/src/index.ts` (register command)

**Step 1: Write the failing test**

Add to `packages/cli/src/cli.test.ts`:

```typescript
describe("assign command", () => {
  test("assigns task to agent", async () => {
    const { stdout } = await runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: assignOut, exitCode } = await runCli(["assign", id!, "claude"]);
    expect(exitCode).toBe(0);
    expect(assignOut).toContain("Assigned");
    expect(assignOut).toContain("claude");
  });

  test("unassigns task with --clear", async () => {
    const { stdout } = await runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    await runCli(["assign", id!, "claude"]);
    const { stdout: clearOut, exitCode } = await runCli(["assign", id!, "--clear"]);
    expect(exitCode).toBe(0);
    expect(clearOut).toContain("Unassigned");
  });

  test("fails on invalid agent name", async () => {
    const { stdout } = await runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { exitCode } = await runCli(["assign", id!, "Invalid Agent!"]);
    expect(exitCode).not.toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/cli && pnpm test -- --testNamePattern="assign command"`
Expected: FAIL with "assign" command not found

**Step 3: Create assign command**

Create `packages/cli/src/commands/assign.ts`:

```typescript
import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const assignCommand = new Command("assign")
  .description("Assign a task to an agent")
  .argument("<id>", "Task ID (can be partial)")
  .argument("[agent]", "Agent to assign (omit with --clear to unassign)")
  .option("-c, --clear", "Unassign the task")
  .option("-j, --json", "Output as JSON")
  .action(async (id, agent, options) => {
    const json = options.json;
    try {
      const { taskService } = await getContext();

      const tasks = await taskService.listTasks();
      const task = tasks.find((t) => t.id.startsWith(id));

      if (!task) {
        if (json) outputError(2, `Task '${id}' not found`);
        console.error(`Error: Task '${id}' not found`);
        process.exit(2);
      }

      if (options.clear) {
        const updated = await taskService.updateTask(task.id, { assignedTo: null });
        if (json) {
          outputSuccess(updated);
          return;
        }
        console.log(`Unassigned [${updated.id.slice(0, 8)}] "${updated.title}"`);
        return;
      }

      if (!agent) {
        if (json) outputError(4, "Specify an agent or use --clear");
        console.error("Error: Specify an agent or use --clear to unassign");
        process.exit(4);
      }

      const updated = await taskService.updateTask(task.id, { assignedTo: agent });

      if (json) {
        outputSuccess(updated);
        return;
      }

      console.log(`Assigned [${updated.id.slice(0, 8)}] "${updated.title}" to ${updated.assignedTo}`);
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
```

**Step 4: Register command in index.ts**

In `packages/cli/src/index.ts`, add:

```typescript
import { assignCommand } from "./commands/assign.js";

// ... in command registration section:
program.addCommand(assignCommand);
```

**Step 5: Run test to verify it passes**

Run: `cd packages/cli && pnpm test -- --testNamePattern="assign command"`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/cli/src/commands/assign.ts packages/cli/src/index.ts packages/cli/src/cli.test.ts
git commit -m "feat(cli): add assign command for task assignment"
```

---

### Task 2: Add `--claim` Flag to Move Command

**Files:**
- Modify: `packages/cli/src/commands/move.ts`

**Step 1: Write the failing test**

Add to `packages/cli/src/cli.test.ts`:

```typescript
describe("move --claim", () => {
  test("claims task when moving with --claim", async () => {
    const { stdout } = await runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { stdout: moveOut, exitCode } = await runCli([
      "move", id!, "in-progress", "--claim", "claude"
    ]);
    expect(exitCode).toBe(0);
    expect(moveOut).toContain("in-progress");
    
    // Verify assignment
    const { stdout: listOut } = await runCli(["list", "--json"]);
    const tasks = JSON.parse(listOut);
    const task = tasks.find((t: any) => t.id.startsWith(id));
    expect(task.assignedTo).toBe("claude");
  });

  test("auto-claims with current agent when --claim without value", async () => {
    const { stdout } = await runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    const { exitCode } = await runCli(["move", id!, "in-progress", "--claim"]);
    expect(exitCode).toBe(0);
    
    const { stdout: listOut } = await runCli(["list", "--json"]);
    const tasks = JSON.parse(listOut);
    const task = tasks.find((t: any) => t.id.startsWith(id));
    expect(task.assignedTo).toBe("user"); // default agent
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/cli && pnpm test -- --testNamePattern="move --claim"`
Expected: FAIL with unknown option '--claim'

**Step 3: Add --claim flag to move command**

Modify `packages/cli/src/commands/move.ts`:

```typescript
import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getAgent, getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const moveCommand = new Command("move")
  .description("Move a task to a different column")
  .argument("<id>", "Task ID (can be partial)")
  .argument("[column]", "Target column")
  .option("-n, --next", "Move to next column")
  .option("-f, --force", "Force move even if WIP limit exceeded")
  .option("-C, --claim [agent]", "Claim task (assign to agent, defaults to current agent)")
  .option("-j, --json", "Output as JSON")
  .action(async (id, column, options) => {
    const json = options.json;
    try {
      const { taskService, boardService } = await getContext();

      const tasks = await taskService.listTasks();
      const task = tasks.find((t) => t.id.startsWith(id));

      if (!task) {
        if (json) outputError(2, `Task '${id}' not found`);
        console.error(`Error: Task '${id}' not found`);
        process.exit(2);
      }

      let targetColumn = column;

      if (options.next) {
        const columns = await boardService.getColumns();
        const currentIdx = columns.findIndex((c) => c.id === task.columnId);
        if (currentIdx < columns.length - 1) {
          targetColumn = columns[currentIdx + 1].id;
        } else {
          if (json) outputError(4, "Task is already in the last column");
          console.error("Error: Task is already in the last column");
          process.exit(4);
        }
      }

      if (!targetColumn) {
        if (json) outputError(4, "Specify a column or use --next");
        console.error("Error: Specify a column or use --next");
        process.exit(4);
      }

      // Handle --claim flag
      if (options.claim !== undefined) {
        const claimAgent = options.claim === true ? getAgent() : options.claim;
        await taskService.updateTask(task.id, { assignedTo: claimAgent });
      }

      const moved = await taskService.moveTask(task.id, targetColumn, {
        force: options.force,
      });

      if (json) {
        outputSuccess(moved);
        return;
      }

      const col = await boardService.getColumn(moved.columnId);
      let msg = `Moved [${moved.id.slice(0, 8)}] to ${col?.name}`;
      if (options.claim !== undefined) {
        const claimAgent = options.claim === true ? getAgent() : options.claim;
        msg += ` (claimed by ${claimAgent})`;
      }
      console.log(msg);
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
```

**Step 4: Run test to verify it passes**

Run: `cd packages/cli && pnpm test -- --testNamePattern="move --claim"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/commands/move.ts packages/cli/src/cli.test.ts
git commit -m "feat(cli): add --claim flag to move command for auto-assignment"
```

---

### Task 3: Update Help and Documentation

**Files:**
- Modify: `packages/cli/README.md` (if exists)

**Step 1: Update CLI help output verification**

Run: `cd packages/cli && bun run src/index.ts --help`

Verify new commands appear:
- `assign <id> [agent]` - Assign a task to an agent
- `move` now shows `--claim` option

**Step 2: Add usage examples to README (if exists)**

```markdown
### Assign Tasks

```bash
# Assign task to an agent
kaban assign abc123 claude

# Unassign a task
kaban assign abc123 --clear

# Claim task when moving to in-progress
kaban move abc123 in-progress --claim claude

# Claim with current agent (uses KABAN_AGENT or "user")
kaban move abc123 in-progress --claim
```
```

**Step 3: Commit**

```bash
git add packages/cli/README.md
git commit -m "docs(cli): add assign command and --claim flag documentation"
```

---

## Summary

| Command | Usage | Description |
|---------|-------|-------------|
| `kaban assign <id> <agent>` | `kaban assign abc claude` | Assign task to agent |
| `kaban assign <id> --clear` | `kaban assign abc --clear` | Unassign task |
| `kaban move <id> <col> --claim [agent]` | `kaban move abc in-progress --claim` | Move and claim |

## Testing Checklist

- [ ] `assign` command assigns task correctly
- [ ] `assign --clear` unassigns task
- [ ] `assign` rejects invalid agent names
- [ ] `move --claim agent` assigns to specified agent
- [ ] `move --claim` (no value) assigns to current agent (KABAN_AGENT or "user")
- [ ] JSON output works for both commands
- [ ] Error handling works correctly
