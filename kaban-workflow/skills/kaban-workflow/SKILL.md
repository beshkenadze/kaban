---
name: kaban-workflow
description: Use when calling TodoWrite with 3+ items, starting multi-step tasks, or when user mentions "board", "kanban", "track progress". Syncs TodoWrite with persistent Kaban board.
---

# Kaban Workflow

Persistent Kanban board for AI agent coordination. Tasks survive sessions and sync with TodoWrite.

**Core principle:** TodoWrite for session visibility, Kaban for persistence.

## When to Activate

- Multi-step features (3+ tasks)
- User says "plan", "track", "board", "kanban"
- Session start with existing board
- Delegating to sub-agents

**Not for:** Single tasks, pure research, throwaway work.

## Availability

### MCP Tools (Preferred)

```
kaban_status          - board status
kaban_list_tasks      - list tasks
kaban_add_task        - add task
kaban_move_task       - move between columns
kaban_complete_task   - mark done
```

### CLI Fallback

```bash
which kaban           # check installation
kaban status          # board status
kaban list            # list tasks
kaban add "title"     # add task
kaban done <id>       # complete task
```

**Install:** `npm i -g @kaban-board/cli` or `brew install beshkenadze/tap/kaban`

### Never Do

- Check `.kaban/board.db` directly
- Run source code (`bun run`, `npx ts-node`)

## Task Sync

| Action | TodoWrite | Kaban |
|--------|-----------|-------|
| Create | `todowrite` | `kaban_add_task` |
| Start | `status: in_progress` | `kaban_move_task → in-progress` |
| Complete | `status: completed` | `kaban_complete_task` |

Always mirror changes to both systems.

## Session Start

```
1. kaban_status (or kaban status)
   ├─ No board → proceed normally
   └─ Board exists → check in-progress tasks
      └─ Ask: "Resume [task]?"
```

## Sub-Agent Delegation

```
1. kaban_update_task(assignedTo: "frontend-ui-ux-engineer")
2. Task tool prompt includes Kaban task ID
3. Sub-agent calls kaban_complete_task when done
```

## Columns

| Column | WIP Limit |
|--------|-----------|
| Backlog | - |
| To Do | - |
| In Progress | 3 |
| Done | - |

## Labels

| Type | Examples |
|------|----------|
| Type | `bug`, `feature`, `refactor` |
| Priority | `p0`, `p1`, `p2`, `p3` |
| Domain | `frontend`, `backend`, `infra` |

## Quick Reference

### CLI Commands

| Command | Description |
|---------|-------------|
| `kaban init` | Initialize board |
| `kaban status` | Board summary |
| `kaban add "title"` | Add task |
| `kaban list` | List tasks |
| `kaban move <id> <col>` | Move task |
| `kaban done <id>` | Complete task |

### MCP Tools

| Tool | Key Parameters |
|------|----------------|
| `kaban_add_task` | title, column?, labels? |
| `kaban_move_task` | id, column |
| `kaban_update_task` | id, assignedTo?, labels? |
| `kaban_complete_task` | id |
| `kaban_list_tasks` | columnId?, blocked? |
| `kaban_status` | - |

## Rules

1. Always sync TodoWrite ↔ Kaban
2. Include task ID when delegating
3. Respect WIP limits (ask before forcing)
4. Use CLI or MCP tools only (never direct DB access)
