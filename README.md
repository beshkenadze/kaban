# Kaban

Kaban is a terminal-based Kanban board specifically designed for AI code agents and developers. It provides a structured way to manage tasks, track progress, and coordinate between human users and AI agents in a terminal environment.

Kaban is organized as a monorepo consisting of the following packages:
- **@kaban/core**: Core library containing database logic, services, and schemas.
- **@kaban/cli**: Command-line interface for quick task management.
- **@kaban/tui**: Interactive Terminal User Interface for visual board management.
- **@kaban/mcp**: Model Context Protocol (MCP) server for integration with AI agents like Claude.

## Installation

### Prerequisites
- [Bun](https://bun.sh/) runtime
- [Task](https://taskfile.dev/) (optional, for easy install/update/uninstall)

### Quick Install
```bash
git clone <repo-url>
cd KabanProject
task install
```

### Manual Setup
```bash
bun install
bun run build
```

### Task Commands

| Command | Description |
|:---|:---|
| `task install` | Build and install binaries to /usr/local/bin |
| `task uninstall` | Remove binaries from system |
| `task update` | Rebuild and reinstall binaries |
| `task build` | Build all packages |
| `task build:bin` | Build CLI and TUI binaries |
| `task clean` | Remove build artifacts |
| `task dev:cli` | Run CLI in development mode |
| `task dev:tui` | Run TUI in development mode |

Custom install directory:
```bash
INSTALL_DIR=~/.local/bin task install
```

## CLI Usage

The Kaban CLI allows you to interact with your board directly from the terminal.

### Commands

| Command | Description |
|:---|:---|
| `kaban init` | Initialize a new board in the current directory. |
| `kaban add` | Add a new task to the board. |
| `kaban list` | List tasks with optional filters. |
| `kaban move` | Move a task to a different column. |
| `kaban done` | Mark a task as completed (moves to terminal column). |
| `kaban status` | Show a summary of the board status. |
| `kaban schema` | Output JSON schemas for validation. |

### Command Options

#### `kaban init`
Initialize a board.
- `-n, --name <name>`: Board name (default: "Kaban Board").

Example:
```bash
kaban init --name "My Project Board"
```

#### `kaban add <title>`
Add a new task.
- `-c, --column <column>`: Target column ID.
- `-a, --agent <agent>`: Agent name creating the task.
- `-d, --depends-on <ids>`: Comma-separated task IDs this task depends on.
- `-j, --json`: Output result as JSON.

Example:
```bash
kaban add "Implement login feature" -c todo -a "claude-3-5"
```

#### `kaban list`
List tasks.
- `-c, --column <column>`: Filter by column ID.
- `-a, --agent <agent>`: Filter by agent name.
- `-b, --blocked`: Show only blocked tasks.
- `-j, --json`: Output result as JSON.

Example:
```bash
kaban list --column in-progress
```

#### `kaban move <id> [column]`
Move a task. Supports partial IDs.
- `-n, --next`: Move task to the next column in sequence.
- `-f, --force`: Force move even if WIP limit is exceeded.
- `-j, --json`: Output result as JSON.

Example:
```bash
kaban move a1b2c3d4 -n
```

#### `kaban done <id>`
Mark task as done. Moves the task to the configured terminal column.
- `-j, --json`: Output result as JSON.

Example:
```bash
kaban done a1b2c3d4
```

## TUI Usage

The TUI provides an interactive, visual representation of the Kanban board.

To run the TUI:
```bash
cd packages/tui
bun run dev
```

### Keyboard Shortcuts

| Key | Action |
|:---|:---|
| Arrow keys / `h`, `j`, `k`, `l` | Navigate between columns and tasks |
| `a` | Add a new task |
| `m` | Move selected task to a different column |
| `u` | Assign user/agent to task |
| `d` | Delete selected task |
| `?` | Show help modal |
| `q` | Quit |

## MCP Integration

Kaban includes an MCP server, allowing AI agents to perceive and manage the Kanban board.

### Tools

| Tool | Description |
|:---|:---|
| `kaban_init` | Initialize board (name, path optional). |
| `kaban_add_task` | Add task (title, columnId, agent, dependsOn, etc.). |
| `kaban_get_task` | Get detailed information about a task by ID. |
| `kaban_list_tasks` | List tasks with filters (columnId, agent, blocked). |
| `kaban_move_task` | Move task to a specific column. |
| `kaban_update_task` | Update task properties (title, description, labels, etc.). |
| `kaban_delete_task` | Remove a task from the board. |
| `kaban_complete_task` | Mark task as done (partial ID supported). |
| `kaban_status` | Get board summary and column statistics. |

### Resources

- `kaban://board/status`: Board status with task counts.
- `kaban://board/columns`: List of available columns.
- `kaban://tasks/{columnId}`: List of tasks in a specific column.
- `kaban://task/{id}`: Full details of a single task.

### Configuration for Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kaban": {
      "command": "bun",
      "args": ["run", "/path/to/packages/mcp/dist/index.js"],
      "env": {
        "KABAN_PATH": "/path/to/your/project"
      }
    }
  }
}
```

## Configuration

### Environment Variables
- `KABAN_PATH`: The directory where Kaban should store its data. Defaults to the current working directory.
- `KABAN_AGENT`: The name of the agent to use when creating tasks via CLI. Defaults to `user`.

### Data Storage
Kaban stores its state in a `.kaban` directory within the project root:
- `.kaban/board.db`: SQLite database containing tasks and board state.
- `.kaban/config.json`: Board configuration, including column definitions and WIP limits.

### Default Column Configuration
By default, Kaban initializes with the following columns:
1. **Backlog**
2. **To Do**
3. **In Progress** (WIP limit: 3)
4. **Done** (Terminal column)
