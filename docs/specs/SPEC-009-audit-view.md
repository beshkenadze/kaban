# SPEC-009: Audit Log Viewing

**Status**: Complete  
**Priority**: P2 (Medium)  
**Complexity**: Low  
**Estimated effort**: 0.5 day  
**Depends on**: SPEC-001 (Audit Log via SQLite Triggers)

> **Review Notes** (2026-01-29):
> 1. Add `idx_audits_actor` index for actor filtering performance
> 2. Limit validation: cap at 1000 max
> 3. Date format: ISO 8601 or relative ("1d", "1w")
> 4. TUI db access: pass `db` via AppState
> 5. Edge case tests: empty audit log, invalid task ID

---

## 1. Overview

Add query API and interfaces for viewing audit log data. Extends SPEC-001 which implemented automatic logging via SQLite triggers.

### Goals
- Query audit history by object, actor, time range
- View task change history
- CLI commands for human review
- MCP tools for AI agents
- TUI modal for visual history browsing

### Non-Goals
- Rollback functionality (Phase 2)
- Audit log export (use existing markdown export)
- Audit retention/cleanup policy

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Interfaces                              │
├───────────────┬───────────────┬─────────────────────────────┤
│     TUI       │      CLI      │       MCP Server            │
│  [h] history  │  kaban audit  │  kaban_get_audit_history    │
│   modal       │   commands    │  kaban_get_task_history     │
└───────┬───────┴───────┬───────┴───────────┬─────────────────┘
        │               │                   │
        └───────────────┼───────────────────┘
                        ▼
              ┌───────────────────────┐
              │     AuditService      │  ← NEW
              │   (packages/core)     │
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │   audits table        │
              │   (SQLite triggers)   │
              └───────────────────────┘
```

---

## 3. Core: AuditService

### 3.1 Types

```typescript
// packages/core/src/services/audit.ts

export type AuditEventType = "CREATE" | "UPDATE" | "DELETE";
export type AuditObjectType = "task" | "column" | "board";

export interface AuditEntry {
  id: number;
  timestamp: Date;
  eventType: AuditEventType;
  objectType: AuditObjectType;
  objectId: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: string | null;
}

export interface AuditFilter {
  objectType?: AuditObjectType;
  objectId?: string;
  eventType?: AuditEventType;
  actor?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditHistoryResult {
  entries: AuditEntry[];
  total: number;
  hasMore: boolean;
}
```

### 3.2 Service Implementation

```typescript
export class AuditService {
  constructor(private db: DB) {}

  async getHistory(filter: AuditFilter = {}): Promise<AuditHistoryResult> {
    const conditions = [];

    if (filter.objectType) {
      conditions.push(eq(audits.objectType, filter.objectType));
    }
    if (filter.objectId) {
      conditions.push(eq(audits.objectId, filter.objectId));
    }
    if (filter.eventType) {
      conditions.push(eq(audits.eventType, filter.eventType));
    }
    if (filter.actor) {
      conditions.push(eq(audits.actor, filter.actor));
    }
    if (filter.since) {
      conditions.push(gte(audits.timestamp, filter.since));
    }
    if (filter.until) {
      conditions.push(lte(audits.timestamp, filter.until));
    }

    const limit = Math.min(filter.limit ?? 50, 1000);  // Cap at 1000 max
    const offset = filter.offset ?? 0;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const entries = await this.db
      .select()
      .from(audits)
      .where(whereClause)
      .orderBy(desc(audits.timestamp))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = entries.length > limit;
    if (hasMore) entries.pop();

    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(audits)
      .where(whereClause);

    return {
      entries,
      total: countResult[0]?.count ?? 0,
      hasMore,
    };
  }

  async getTaskHistory(taskId: string, limit = 50): Promise<AuditEntry[]> {
    const result = await this.getHistory({
      objectType: "task",
      objectId: taskId,
      limit,
    });
    return result.entries;
  }

  async getRecentChanges(limit = 50): Promise<AuditEntry[]> {
    const result = await this.getHistory({ limit });
    return result.entries;
  }

  async getChangesByActor(actor: string, limit = 50): Promise<AuditEntry[]> {
    const result = await this.getHistory({ actor, limit });
    return result.entries;
  }

  async getStats(): Promise<{
    totalEntries: number;
    byEventType: Record<AuditEventType, number>;
    byObjectType: Record<AuditObjectType, number>;
    recentActors: string[];
  }> {
    const total = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(audits);

    const byEvent = await this.db
      .select({
        eventType: audits.eventType,
        count: sql<number>`COUNT(*)`,
      })
      .from(audits)
      .groupBy(audits.eventType);

    const byObject = await this.db
      .select({
        objectType: audits.objectType,
        count: sql<number>`COUNT(*)`,
      })
      .from(audits)
      .groupBy(audits.objectType);

    const recentActors = await this.db
      .selectDistinct({ actor: audits.actor })
      .from(audits)
      .where(isNotNull(audits.actor))
      .orderBy(desc(audits.timestamp))
      .limit(10);

    return {
      totalEntries: total[0]?.count ?? 0,
      byEventType: Object.fromEntries(
        byEvent.map((e) => [e.eventType, e.count])
      ) as Record<AuditEventType, number>,
      byObjectType: Object.fromEntries(
        byObject.map((o) => [o.objectType, o.count])
      ) as Record<AuditObjectType, number>,
      recentActors: recentActors.map((a) => a.actor).filter(Boolean) as string[],
    };
  }
}
```

### 3.3 Export from Core

```typescript
// packages/core/src/index.ts (additions)

export {
  AuditService,
  type AuditEntry,
  type AuditFilter,
  type AuditHistoryResult,
  type AuditEventType,
  type AuditObjectType,
} from "./services/audit.js";
```

---

## 4. CLI: `kaban audit` Command

### 4.1 Command Structure

```bash
# List recent audit entries
kaban audit list [--limit 50] [--actor <name>] [--type task|column|board] [--json]

# View task history
kaban audit task <task-id> [--limit 50] [--json]

# View audit stats
kaban audit stats [--json]

# View changes by actor
kaban audit actor <name> [--limit 50] [--json]

# View changes since time
kaban audit list --since "2024-01-01" --until "2024-01-31"
```

### 4.2 Implementation

```typescript
// packages/cli/src/commands/audit.ts

import { AuditService, KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const auditCommand = new Command("audit")
  .description("View audit log history");

auditCommand
  .command("list")
  .description("List recent audit entries")
  .option("-l, --limit <n>", "Max entries", "50")
  .option("-a, --actor <name>", "Filter by actor")
  .option("-t, --type <type>", "Filter by object type (task|column|board)")
  .option("-e, --event <type>", "Filter by event type (CREATE|UPDATE|DELETE)")
  .option("--since <date>", "Filter from date (ISO 8601 or relative: 1d, 1w, 30d)")
  .option("--until <date>", "Filter to date (ISO 8601 or relative: 1d, 1w, 30d)")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { db } = await getContext();
      const auditService = new AuditService(db);

      const result = await auditService.getHistory({
        limit: parseInt(options.limit, 10),
        actor: options.actor,
        objectType: options.type,
        eventType: options.event,
        since: options.since ? new Date(options.since) : undefined,
        until: options.until ? new Date(options.until) : undefined,
      });

      if (json) {
        outputSuccess(result);
        return;
      }

      console.log(`\n  Audit Log (${result.entries.length} of ${result.total})\n`);
      for (const entry of result.entries) {
        const time = entry.timestamp.toISOString().slice(0, 19).replace("T", " ");
        const actor = entry.actor ? `@${entry.actor}` : "";
        const field = entry.fieldName ? `.${entry.fieldName}` : "";
        const change = entry.eventType === "UPDATE"
          ? `${entry.oldValue ?? "∅"} → ${entry.newValue ?? "∅"}`
          : entry.eventType === "CREATE"
            ? entry.newValue ?? ""
            : entry.oldValue ?? "";

        console.log(`  ${time} ${entry.eventType.padEnd(6)} ${entry.objectType}${field}`);
        console.log(`    ${entry.objectId.slice(0, 8)} ${actor} ${change}`);
      }
      if (result.hasMore) console.log(`\n  ... more entries available`);
      console.log();
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });

auditCommand
  .command("task <id>")
  .description("View history for a specific task")
  .option("-l, --limit <n>", "Max entries", "50")
  .option("-j, --json", "Output as JSON")
  .action(async (id, options) => {
    const json = options.json;
    try {
      const { db, taskService } = await getContext();
      const task = await taskService.resolveTask(id);
      if (!task) {
        if (json) outputError(2, `Task '${id}' not found`);
        console.error(`Error: Task '${id}' not found`);
        process.exit(2);
      }

      const auditService = new AuditService(db);
      const entries = await auditService.getTaskHistory(
        task.id,
        parseInt(options.limit, 10)
      );

      if (json) {
        outputSuccess({ task: { id: task.id, title: task.title }, entries });
        return;
      }

      console.log(`\n  History for [${task.id.slice(0, 8)}] "${task.title}"\n`);
      for (const entry of entries) {
        const time = entry.timestamp.toISOString().slice(0, 19).replace("T", " ");
        const actor = entry.actor ? `@${entry.actor}` : "";
        
        if (entry.eventType === "CREATE") {
          console.log(`  ${time} CREATED ${actor}`);
        } else if (entry.eventType === "DELETE") {
          console.log(`  ${time} DELETED ${actor}`);
        } else {
          const field = entry.fieldName ?? "?";
          console.log(`  ${time} ${field}: ${entry.oldValue ?? "∅"} → ${entry.newValue ?? "∅"} ${actor}`);
        }
      }
      console.log();
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });

auditCommand
  .command("stats")
  .description("Show audit statistics")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { db } = await getContext();
      const auditService = new AuditService(db);
      const stats = await auditService.getStats();

      if (json) {
        outputSuccess(stats);
        return;
      }

      console.log("\n  Audit Statistics\n");
      console.log(`  Total entries: ${stats.totalEntries}`);
      console.log("\n  By Event Type:");
      for (const [type, count] of Object.entries(stats.byEventType)) {
        console.log(`    ${type}: ${count}`);
      }
      console.log("\n  By Object Type:");
      for (const [type, count] of Object.entries(stats.byObjectType)) {
        console.log(`    ${type}: ${count}`);
      }
      console.log("\n  Recent Actors:");
      for (const actor of stats.recentActors) {
        console.log(`    ${actor}`);
      }
      console.log();
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

---

## 5. MCP Tools

### 5.1 Tool Definitions

```typescript
// Add to packages/cli/src/commands/mcp.ts ListToolsRequestSchema handler

{
  name: "kaban_get_audit_history",
  description: "Get audit log history with optional filters",
  inputSchema: {
    type: "object",
    properties: {
      objectType: { 
        type: "string", 
        enum: ["task", "column", "board"],
        description: "Filter by object type" 
      },
      objectId: { type: "string", description: "Filter by object ID" },
      eventType: { 
        type: "string", 
        enum: ["CREATE", "UPDATE", "DELETE"],
        description: "Filter by event type" 
      },
      actor: { type: "string", description: "Filter by actor name" },
      limit: { type: "number", description: "Max entries (default: 50)" },
    },
  },
},
{
  name: "kaban_get_task_history",
  description: "Get change history for a specific task",
  inputSchema: {
    type: "object",
    properties: {
      taskId: { type: "string", description: "Task ID (ULID or partial)" },
      id: { type: "string", description: "Task ID - alias for taskId" },
      limit: { type: "number", description: "Max entries (default: 50)" },
    },
  },
},
```

### 5.2 Tool Handlers

```typescript
// Add to packages/cli/src/commands/mcp.ts CallToolRequestSchema handler

case "kaban_get_audit_history": {
  const { objectType, objectId, eventType, actor, limit } = 
    (args ?? {}) as AuditFilter;
  const auditService = new AuditService(db);
  const result = await auditService.getHistory({
    objectType,
    objectId,
    eventType,
    actor,
    limit: limit ?? 50,
  });
  return jsonResponse(result);
}

case "kaban_get_task_history": {
  const taskIdArg = getParam(args as Record<string, unknown>, "taskId", "id");
  if (!taskIdArg) return errorResponse("Task ID required (use 'taskId' or 'id')");
  
  const task = await taskService.resolveTask(taskIdArg);
  if (!task) return errorResponse(`Task '${taskIdArg}' not found`);
  
  const { limit } = (args ?? {}) as { limit?: number };
  const auditService = new AuditService(db);
  const entries = await auditService.getTaskHistory(task.id, limit ?? 50);
  return jsonResponse({
    task: { id: task.id, title: task.title },
    entries,
  });
}
```

---

## 6. TUI: History Modal

### 6.1 Keybinding

| Key | Context | Action |
|-----|---------|--------|
| `h` | Task selected | Show task history modal |
| `H` | Board view | Show recent board history |

### 6.2 Modal Layout

```
┌─ Task History ──────────────────────────────────────────────┐
│ [01KG5N6W] "Implement audit log viewer"                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  2026-01-29 20:30  CREATED @user                            │
│  2026-01-29 20:35  columnId: todo → in_progress @claude     │
│  2026-01-29 20:40  title: "Impl..." → "Implement..." @user  │
│  2026-01-29 20:45  assignedTo: ∅ → claude @user             │
│  2026-01-29 21:00  columnId: in_progress → done @claude     │
│                                                              │
│  [j/k] scroll  [Enter] view task  [Esc] close               │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Implementation Outline

```typescript
// packages/tui/src/components/modals/history.ts

export async function showTaskHistoryModal(
  state: AppState,
  taskId: string
): Promise<void> {
  const { renderer, taskService } = state;
  const task = await taskService.getTask(taskId);
  if (!task) return;

  // Create AuditService from state.db (need to expose db in context)
  const auditService = new AuditService(state.db);
  const entries = await auditService.getTaskHistory(taskId, 20);

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "history-dialog",
    width: 65,
    height: 18,
  });

  // Title row
  const titleRow = new BoxRenderable(renderer, { /*...*/ });
  const title = new TextRenderable(renderer, {
    content: ` [${task.id.slice(0, 8)}] "${task.title.slice(0, 40)}" `,
    fg: COLORS.accent,
  });
  titleRow.add(title);
  dialog.add(titleRow);

  // Scrollable history list
  for (const entry of entries) {
    const row = formatAuditEntry(entry, renderer);
    dialog.add(row);
  }

  // Hint row
  const hintRow = new BoxRenderable(renderer, { /*...*/ });
  const hint = new TextRenderable(renderer, {
    content: "[j/k] scroll  [Esc] close",
    fg: COLORS.textMuted,
  });
  hintRow.add(hint);
  dialog.add(hintRow);

  renderer.root.add(overlay);
  state.modalOverlay = overlay;
  state.activeModal = "taskHistory";
}
```

### 6.4 ModalType Update

```typescript
// packages/tui/src/lib/types.ts

export type ModalType =
  | "none"
  // ... existing types
  | "taskHistory"    // NEW
  | "boardHistory";  // NEW
```

---

## 7. Testing

### 7.1 AuditService Tests

```typescript
// packages/core/src/services/audit.test.ts

describe("AuditService", () => {
  let db: DB;
  let taskService: TaskService;
  let auditService: AuditService;

  beforeEach(async () => {
    // setup
  });

  describe("getHistory", () => {
    test("returns recent entries", async () => {
      await taskService.addTask({ title: "Test", createdBy: "user" });
      const result = await auditService.getHistory({ limit: 10 });
      
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    test("filters by actor", async () => {
      await taskService.addTask({ title: "Task 1", createdBy: "alice" });
      await taskService.addTask({ title: "Task 2", createdBy: "bob" });
      
      const result = await auditService.getHistory({ actor: "alice" });
      expect(result.entries.every(e => e.actor === "alice")).toBe(true);
    });

    test("filters by object type", async () => {
      await taskService.addTask({ title: "Test" });
      
      const result = await auditService.getHistory({ objectType: "task" });
      expect(result.entries.every(e => e.objectType === "task")).toBe(true);
    });

    test("filters by event type", async () => {
      await taskService.addTask({ title: "Test" });
      
      const result = await auditService.getHistory({ eventType: "CREATE" });
      expect(result.entries.every(e => e.eventType === "CREATE")).toBe(true);
    });

    test("filters by date range", async () => {
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
  });

  describe("getTaskHistory", () => {
    test("returns history for specific task", async () => {
      const task = await taskService.addTask({ title: "Original" });
      await taskService.updateTask(task.id, { title: "Updated" }, undefined, "user");
      await taskService.moveTask(task.id, "in_progress");
      
      const history = await auditService.getTaskHistory(task.id);
      
      expect(history.length).toBeGreaterThanOrEqual(3);
      expect(history.every(e => e.objectId === task.id)).toBe(true);
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
  });
});
```

### 7.2 CLI Tests

```typescript
// Add to packages/cli/src/cli.test.ts

describe("audit command", () => {
  beforeEach(() => {
    // setup
    run("init --name 'Test Board'");
  });

  test("audit list shows entries", async () => {
    runCli(["add", "Test task"]);
    
    const { stdout, exitCode } = runCli(["audit", "list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("CREATE");
    expect(stdout).toContain("task");
  });

  test("audit task shows task history", async () => {
    const { stdout } = runCli(["add", "Test task"]);
    const id = stdout.match(/\[([^\]]+)\]/)?.[1];
    
    runCli(["move", id!, "in_progress"]);
    
    const { stdout: historyOut, exitCode } = runCli(["audit", "task", id!]);
    expect(exitCode).toBe(0);
    expect(historyOut).toContain("CREATED");
    expect(historyOut).toContain("columnId");
  });

  test("audit stats shows statistics", async () => {
    runCli(["add", "Task 1"]);
    runCli(["add", "Task 2"]);
    
    const { stdout, exitCode } = runCli(["audit", "stats"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Total entries:");
    expect(stdout).toContain("By Event Type:");
  });

  test("audit list --json returns valid JSON", async () => {
    runCli(["add", "Test task"]);
    
    const { stdout, exitCode } = runCli(["audit", "list", "--json"]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.data.entries).toBeDefined();
    expect(result.data.total).toBeGreaterThan(0);
  });
});
```

---

## 8. Implementation Plan

### Phase 1: Core (~2 hours)
- [x] Create `AuditService` in `packages/core/src/services/audit.ts`
- [x] Add types and exports to `packages/core/src/index.ts`
- [x] Write `AuditService` tests (20 tests)
- [x] Add `idx_audits_actor` index for performance

### Phase 2: CLI (~1 hour)
- [x] Create `auditCommand` in `packages/cli/src/commands/audit.ts`
- [x] Register command in `packages/cli/src/index.ts`
- [x] Write CLI tests (12 tests)

### Phase 3: MCP (~30 min)
- [x] Add `kaban_get_audit_history` tool
- [x] Add `kaban_get_task_history` tool
- [x] Update tool list in MCP server

### Phase 4: TUI (~1 hour) - Optional
- [x] Add `taskHistory` modal type
- [x] Create `showTaskHistoryModal` function  
- [x] Add `H` keybinding for history (uppercase, lowercase is navigation)
- [x] Update help modal with new keybinding
- [ ] Build and verify

---

## 9. Acceptance Criteria

- [ ] `kaban audit list` shows recent audit entries
- [ ] `kaban audit task <id>` shows task-specific history
- [ ] `kaban audit stats` shows aggregate statistics
- [ ] All commands support `--json` output
- [ ] MCP tools available and working
- [ ] CLI tests pass
- [ ] Core service tests pass
- [ ] TUI modal displays history (optional)

---

## 10. Future Enhancements

- **Audit export**: `kaban audit export --format csv`
- **Audit retention**: Auto-cleanup old entries
- **Audit diff view**: Side-by-side comparison
- **Rollback**: `kaban audit rollback <entry-id>`

---

*Spec version: 1.0.0*  
*Created: 2026-01-29*
