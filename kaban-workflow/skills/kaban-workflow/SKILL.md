---
name: kaban-workflow
description: Use when calling TodoWrite with 3+ items, starting multi-step implementation tasks, at session start to check existing board, or when user mentions "board", "kanban", "track progress". Syncs TodoWrite todos with persistent kaban board.
---

# Kaban Workflow

## Overview

Persistent Kanban board for AI agent coordination. Tasks survive sessions, sync with TodoWrite, and track sub-agent assignments.

**Core principle:** TodoWrite for session visibility, Kaban for persistence and delegation.

## CLI Availability Check

**ALWAYS check CLI first before any kaban operation:**

```bash
which kaban  # Must return path like /usr/local/bin/kaban
```

If not installed → inform user: "kaban CLI not found. Install instructions: TBD"

**NEVER:**
- Check `.kaban/board.db` directly with `ls` or file existence checks
- Run source code via `bun run packages/cli/src/index.ts`
- Use `npx ts-node` or similar development commands

**ALWAYS use:**
- `kaban status` - check board status
- `kaban list` - list tasks
- `kaban add` - add tasks
- `kaban mcp` - for MCP tool integration

## When to Use

**Session Start:**
- Run `kaban status` to check for existing board
- If board exists → auto-resume in-progress tasks

**During Work:**
- Multi-step features (3+ tasks)
- Delegating to sub-agents
- User says "plan", "track", "board"

**Not for:**
- Single trivial tasks
- Pure research/questions
- Throwaway explorations

## Session Start Flow

```
1. Check CLI: which kaban
   ├─ Not found → Inform user, proceed without kaban
   └─ Found → kaban status
              ├─ No board → Proceed normally
              └─ Board exists
                 ├─ In-progress tasks assigned to you?
                 │   └─ Yes → "Resume [task title]?" (require confirmation)
                 └─ No in-progress → Show status summary only
```

## Task Sync (TodoWrite ↔ Kaban)

**Mirror Pattern:** Changes sync bidirectionally.

| Action | TodoWrite | Kaban |
|--------|-----------|-------|
| Create task | `todowrite` | `kaban_add_task` |
| Start work | `status: in_progress` | `kaban_move_task → in-progress` |
| Complete | `status: completed` | `kaban_complete_task` |

**Sync on:**
- TodoWrite creation → mirror to Kaban
- Kaban task move → update TodoWrite status
- Task completion → sync both

## Sub-Agent Delegation

When delegating via Task tool:

```
1. kaban_add_task OR kaban_update_task
   - assignedTo: "{subagent_type}"  # e.g., "frontend-ui-ux-engineer"
   - labels: ["delegation", "{domain}"]

2. Task tool delegation prompt includes:
   - Kaban task ID
   - "Mark kaban task [ID] complete when done"

3. Sub-agent completes → kaban_complete_task
```

**Agent naming convention:**
```
assignedTo: "frontend-ui-ux-engineer"  # matches subagent_type
assignedTo: "oracle"                   # for architecture consults
assignedTo: "user"                     # human action required
```

## Label Conventions

| Category | Labels |
|----------|--------|
| Type | `bug`, `feature`, `refactor`, `docs`, `test` |
| Priority | `p0` (critical), `p1` (high), `p2` (medium), `p3` (low) |
| Domain | `frontend`, `backend`, `infra`, `database` |
| Status | `blocked`, `delegation`, `review` |

## Quick Reference

### CLI Commands

| Action | Command |
|--------|---------|
| Init board | `kaban init` |
| Board status | `kaban status` |
| Add task | `kaban add "title" [--column backlog] [--agent claude]` |
| List tasks | `kaban list [--column todo] [--agent claude] [--blocked]` |
| Move task | `kaban move <id> <column> [--force]` |
| Mark done | `kaban done <id>` |
| Start MCP | `kaban mcp` |

### MCP Tools (via `kaban mcp`)

| Tool | Parameters |
|------|------------|
| `kaban_add_task` | title (required), column?, agent?, dependsOn?, labels?, files? |
| `kaban_move_task` | id, column |
| `kaban_update_task` | id, title?, description?, assignedTo?, labels?, files? |
| `kaban_complete_task` | id |
| `kaban_delete_task` | id |
| `kaban_block_task` | id, reason |
| `kaban_unblock_task` | id |
| `kaban_list_tasks` | columnId?, agent?, blocked? |
| `kaban_get_task` | id |
| `kaban_get_board` | - |
| `kaban_get_columns` | - |
| `kaban_get_blocked_tasks` | - |
| `kaban_get_dependencies` | id |

### MCP Resources (read-only)

| Resource | Description |
|----------|-------------|
| `kaban://board` | Full board state |
| `kaban://tasks` | All tasks |
| `kaban://task/{id}` | Single task by ID |
| `kaban://blocked` | All blocked tasks |

## Workflow: Feature Planning

```
User: "Add dark mode to the app"

1. Confirm: "Create Kaban board for this feature?"
   └─ If yes → kaban_init (if no board)

2. Break down:
   kaban_add_task: "Create theme context"        → backlog
   kaban_add_task: "Add toggle component"        → backlog, labels: [frontend]
   kaban_add_task: "Implement dark styles"       → backlog, labels: [frontend]
   kaban_add_task: "Persist preference"          → backlog, labels: [backend]

3. Mirror to TodoWrite (user sees progress)

4. Start first task:
   kaban_move_task → in-progress
   todowrite status: in_progress
```

## Workflow: Delegation

```
Task: "Add toggle component" needs frontend expertise

1. Update task:
   kaban_update_task:
     assignedTo: "frontend-ui-ux-engineer"
     labels: ["frontend", "delegation"]

2. Delegate via Task tool:
   prompt: |
     Task ID: abc123
     Create dark mode toggle component...
     When complete, call kaban_complete_task(id="abc123")

3. Sub-agent completes → task moves to Done
```

## Workflow: Session Resume

```
Session start with existing board:

1. kaban_status → 
   {
     "columns": [
       {"name": "In Progress", "count": 2},
       {"name": "Done", "count": 5}
     ]
   }

2. kaban_list_tasks(columnId: "in-progress") →
   [
     {"id": "abc123", "title": "Implement auth", "assignedTo": "claude"}
   ]

3. Prompt user:
   "Found in-progress task: 'Implement auth'
    Resume this task?"

4. If yes → continue work
   If no  → show full board status
```

## Default Columns

| Column | ID | WIP Limit | Purpose |
|--------|-----|-----------|---------|
| Backlog | `backlog` | - | Future work |
| To Do | `todo` | - | Ready to start |
| In Progress | `in-progress` | 3 | Active work |
| Done | `done` | - | Completed (terminal) |

## WIP Limit Awareness

Before `kaban_move_task` to in-progress:
- Check column count vs WIP limit
- If at limit → warn user, suggest completing existing tasks
- Use `force: true` only with user confirmation

## Blocked Tasks

```
kaban_update_task:
  id: "abc123"
  blockedReason: "Waiting for API endpoint from backend team"

kaban_list_tasks(blocked: true) → shows all blocked tasks
```

## Checklist: Board Setup

- [ ] `kaban_init` with meaningful board name
- [ ] Break feature into atomic tasks (1-2 hour chunks)
- [ ] Add labels for categorization
- [ ] Set dependencies if tasks have order
- [ ] Mirror initial tasks to TodoWrite

## Checklist: Task Completion

- [ ] Work completed and verified
- [ ] `kaban_complete_task` called
- [ ] TodoWrite status updated to `completed`
- [ ] Dependent tasks unblocked (if any)
- [ ] Next task moved to in-progress (if continuing)

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using Kaban without TodoWrite | Always mirror - user needs session visibility |
| Forgetting to sync on completion | Update both: `kaban_complete_task` + TodoWrite |
| Checking `.kaban/board.db` with `ls` | Use `kaban status` CLI command instead |
| Running source code directly | Use installed `kaban` CLI, never `bun run` or `npx ts-node` |
| Force-moving past WIP limit silently | Warn user, get confirmation before `force: true` |
| Not including task ID in delegation | Sub-agent can't mark task complete without ID |
| Creating board for trivial tasks | Only for 3+ step features or cross-session work |
