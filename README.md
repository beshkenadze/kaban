<p align="center">
  <img src="docs/assets/icon.png" alt="Kaban" width="120" height="120">
</p>

<h1 align="center">Kaban</h1>

<p align="center">
  <strong>Kanban for AI Agents</strong><br>
  Track and coordinate tasks between humans and AI in the terminal
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kaban-board/cli"><img src="https://img.shields.io/npm/v/@kaban-board/cli?label=npm&color=cb3837" alt="npm version"></a>
  <a href="https://github.com/beshkenadze/homebrew-tap"><img src="https://img.shields.io/badge/homebrew-tap-fbb040" alt="Homebrew"></a>
  <a href="https://github.com/beshkenadze/kaban/blob/main/LICENSE"><img src="https://img.shields.io/github/license/beshkenadze/kaban" alt="License"></a>
  <a href="https://github.com/beshkenadze/kaban"><img src="https://img.shields.io/github/stars/beshkenadze/kaban?style=social" alt="GitHub stars"></a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#mcp-integration">MCP Integration</a> •
  <a href="#claude-code-hook-integration">Hook</a> •
  <a href="#cli-usage">CLI</a> •
  <a href="#tui-usage">TUI</a> •
  <a href="#ai-code-editors">AI Editors</a>
</p>

---

## What is Kaban?

Kaban is a terminal-based Kanban board designed for **AI code agents** and developers. It provides a structured way to manage tasks, track progress, and coordinate between human users and AI agents.

**Why Kaban?**

- **Manage Todos** — Track tasks with a proper Kanban board
- **Assign to Agents** — Assign tasks to Claude, GPT, or any AI agent
- **Single App** — No servers, no cloud. One SQLite file. Works offline
- **TUI + CLI + MCP** — Interactive UI for humans, CLI for scripts, MCP for AI

## Features

| Feature | Description |
|---------|-------------|
| **MCP Server** | AI agents can read, create, and manage tasks autonomously |
| **TodoWrite Hook** | Auto-sync Claude Code todos to Kaban board |
| **Interactive TUI** | Vim-style navigation, keyboard-driven workflow |
| **Powerful CLI** | Scriptable commands for automation |
| **WIP Limits** | Built-in Kanban best practices |
| **Agent Tracking** | See who (human or AI) owns each task |
| **Portable** | Single SQLite file, no server required |

## Installation

### npx / bunx (Zero Install)

```bash
# Try without installing
npx @kaban-board/cli init --name "My Project"
npx @kaban-board/cli tui

# Or with bun
bunx @kaban-board/cli tui
```

### npm (Global Install)

```bash
npm install -g @kaban-board/cli
kaban init --name "My Project"
kaban tui
```

### Homebrew (macOS / Linux)

```bash
brew tap beshkenadze/tap
brew install kaban
kaban tui
```

### From Source

```bash
git clone https://github.com/beshkenadze/kaban
cd kaban && bun install && bun run build
task install
```

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ or [Bun](https://bun.sh/) v1.0+
- [Task](https://taskfile.dev/) (optional, for development)

## Packages

Kaban is a monorepo with three packages:

| Package | Description |
|---------|-------------|
| `@kaban-board/core` | Database logic, services, and schemas |
| `@kaban-board/cli` | CLI commands, TUI launcher, MCP server |
| `@kaban-board/tui` | Interactive Terminal User Interface |

## MCP Integration

Connect your AI coding assistant to Kaban via [Model Context Protocol](https://modelcontextprotocol.io/).

### Claude Desktop Setup

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kaban": {
      "command": "npx",
      "args": ["-y", "@kaban-board/cli", "mcp"],
      "env": {
        "KABAN_PATH": "/path/to/your/project"
      }
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "kaban": {
      "command": "kaban",
      "args": ["mcp"],
      "env": {
        "KABAN_PATH": "/path/to/your/project"
      }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `kaban_init` | Initialize a new board |
| `kaban_add_task` | Add a task |
| `kaban_get_task` | Get task details |
| `kaban_list_tasks` | List tasks with filters |
| `kaban_move_task` | Move task to column |
| `kaban_update_task` | Update task properties |
| `kaban_delete_task` | Delete a task |
| `kaban_complete_task` | Mark task as done |
| `kaban_status` | Get board summary |

### MCP Resources

| Resource | Description |
|----------|-------------|
| `kaban://board/status` | Board status with counts |
| `kaban://board/columns` | Available columns |
| `kaban://tasks/{columnId}` | Tasks in a column |
| `kaban://task/{id}` | Single task details |

## CLI Usage

```bash
kaban <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `kaban init` | Initialize a board |
| `kaban add <title>` | Add a task |
| `kaban list` | List tasks |
| `kaban move <id> [column]` | Move a task |
| `kaban done <id>` | Mark task complete |
| `kaban status` | Show board summary |
| `kaban tui` | Launch interactive UI |
| `kaban mcp` | Start MCP server |
| `kaban hook install` | Install TodoWrite sync hook |
| `kaban hook status` | Check hook status |
| `kaban sync` | Sync TodoWrite input (stdin) |

### Examples

```bash
# Initialize with custom name
kaban init --name "Sprint 1"

# Add task with metadata
kaban add "Fix auth bug" -c todo -a claude -D "OAuth2 flow broken"

# List tasks in a column
kaban list --column in-progress

# Move task to next column
kaban move abc123 --next

# Mark complete
kaban done abc123
```

## Claude Code Hook Integration

> **Optional but recommended** — Automatically sync Claude Code's TodoWrite with your Kaban board. You can still use Kaban without this hook via CLI, TUI, or MCP.

### Installation

```bash
kaban hook install
```

This will:
1. Install the hook binary to `~/.claude/hooks/`
2. Configure Claude Code's `settings.json` with a PostToolUse hook
3. Create a backup of your settings

### Commands

| Command | Description |
|---------|-------------|
| `kaban hook install` | Install the TodoWrite sync hook |
| `kaban hook uninstall` | Remove the hook |
| `kaban hook status` | Check installation status and activity |

### How It Works

```
Claude Code → TodoWrite → Hook → kaban sync → Kaban Board
```

- **pending** todos → **Todo** column
- **in_progress** todos → **In Progress** column  
- **completed** todos → **Done** column
- **cancelled** todos → **Backlog** column

### Logs

Sync activity is logged to `~/.claude/hooks/sync.log`. View recent activity:

```bash
kaban hook status
```

## TUI Usage

Launch the interactive terminal UI:

```bash
kaban tui
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `<` `>` / `h` `l` | Navigate columns |
| `^` `v` / `j` `k` | Navigate tasks |
| `Enter` | View task details |
| `a` | Add new task |
| `e` | Edit task |
| `m` | Move task |
| `u` | Assign user/agent |
| `d` | Delete task |
| `?` | Show help |
| `q` | Quit |

## AI Code Editors

Add Kaban MCP server to your AI coding assistant:

### Claude Code Skill (Recommended)

Install the Kaban workflow skill for TodoWrite sync and session persistence:

```bash
npx add-skill beshkenadze/kaban
# or
bunx add-skill beshkenadze/kaban
```

The skill includes:
- **MCP server** — Auto-configured, no manual setup needed
- **Kaban workflow skill** — Syncs with TodoWrite, resumes tasks across sessions
- **Session hooks** — Auto-checks for in-progress tasks on session start

#### Alternative: Plugin Marketplace

```bash
/plugin marketplace add beshkenadze/kaban
/plugin install kaban-workflow@beshkenadze-kaban
```

### Claude Code / Claude Desktop (Manual MCP)

Add to `.mcp.json` (Claude Code) or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kaban": {
      "command": "npx",
      "args": ["-y", "@kaban-board/cli", "mcp"]
    }
  }
}
```

### OpenCode

Add to `opencode.json`:

```json
{
  "mcp": {
    "kaban": {
      "command": "npx",
      "args": ["-y", "@kaban-board/cli", "mcp"]
    }
  }
}
```

### Cursor / Windsurf / Continue

Add to MCP settings:

```json
{
  "mcpServers": {
    "kaban": {
      "command": "npx",
      "args": ["-y", "@kaban-board/cli", "mcp"]
    }
  }
}
```

### With Global Install

If you installed globally (`npm i -g @kaban-board/cli`), use:

```json
{
  "mcpServers": {
    "kaban": {
      "command": "kaban",
      "args": ["mcp"]
    }
  }
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KABAN_PATH` | Board data directory | Current directory |
| `KABAN_AGENT` | Default agent name | `user` |

### Data Storage

Kaban stores data in `.kaban/` directory:

```
.kaban/
├── board.db      # SQLite database
└── config.json   # Board configuration
```

### Default Columns

| Column | WIP Limit |
|--------|-----------|
| Backlog | — |
| To Do | — |
| In Progress | 3 |
| Review | 2 |
| Done | — (terminal) |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

```bash
# Development
bun install
bun run build
bun run lint
bun run test
```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) for automated releases:

```bash
feat: add new feature      # → Minor version bump
fix: resolve bug           # → Patch version bump  
feat!: breaking change     # → Major version bump
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full details on commit types and the release process.

## License

[MIT](LICENSE)
