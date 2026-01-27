# Kaban Marketplace

Claude Code plugins for the Kaban project.

## Installation

Add this marketplace to Claude Code:

```bash
/plugin marketplace add <path-to-repo>/marketplace
```

Or for local development:

```bash
/plugin marketplace add /path/to/kaban/marketplace
```

## Available Plugins

### kaban-workflow

**Description:** Persistent Kanban board workflow with TodoWrite sync and SessionStart resume

**Install:**
```bash
bunx skills add beshkenadze/kaban
```

Works with all AI code editors: Antigravity, Claude Code, Clawdbot, Cline, Codex, and 21+ more.

**What you get:**
- SessionStart hook that checks board status and in-progress tasks
- `kaban-workflow` skill for TodoWrite ↔ Kaban sync
- CLI-first approach (always use `kaban` CLI, never source code)

**Features:**
- Automatic board status check at session start
- In-progress task resume prompts
- TodoWrite mirroring for session visibility
- Sub-agent delegation tracking
