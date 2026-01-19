import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BoardService,
  type Config,
  createDb,
  DEFAULT_CONFIG,
  initializeSchema,
  TaskService,
} from "@kaban-board/core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Command } from "commander";

function getKabanPaths(basePath?: string) {
  const base = basePath ?? process.cwd();
  const kabanDir = join(base, ".kaban");
  return {
    kabanDir,
    dbPath: join(kabanDir, "board.db"),
    configPath: join(kabanDir, "config.json"),
  };
}

async function createContext(basePath?: string) {
  const { dbPath, configPath } = getKabanPaths(basePath);

  if (!existsSync(dbPath)) {
    throw new Error("No board found. Run 'kaban init' first");
  }

  const db = await createDb(dbPath);
  const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));
  const boardService = new BoardService(db);
  const taskService = new TaskService(db, boardService);

  return { db, config, boardService, taskService };
}

async function startMcpServer(workingDirectory: string) {
  const server = new Server(
    { name: "kaban-mcp", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "kaban_init",
        description: "Initialize a new Kaban board in the specified or current directory",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Board name (default: 'Kaban Board')" },
            path: { type: "string", description: "Directory path (default: KABAN_PATH or cwd)" },
          },
        },
      },
      {
        name: "kaban_add_task",
        description: "Add a new task to the Kaban board",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title (1-200 chars)" },
            description: { type: "string", description: "Task description" },
            columnId: { type: "string", description: "Column ID (default: todo)" },
            agent: { type: "string", description: "Agent name creating the task" },
            dependsOn: {
              type: "array",
              items: { type: "string" },
              description: "Task IDs this depends on",
            },
            files: {
              type: "array",
              items: { type: "string" },
              description: "Associated file paths",
            },
            labels: { type: "array", items: { type: "string" }, description: "Task labels" },
          },
          required: ["title"],
        },
      },
      {
        name: "kaban_get_task",
        description: "Get a task by its ID",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", description: "Task ID (ULID)" } },
          required: ["id"],
        },
      },
      {
        name: "kaban_list_tasks",
        description: "List tasks with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            columnId: { type: "string", description: "Filter by column ID" },
            agent: { type: "string", description: "Filter by agent name" },
            blocked: { type: "boolean", description: "Show only blocked tasks" },
          },
        },
      },
      {
        name: "kaban_move_task",
        description: "Move a task to a different column",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID (ULID)" },
            columnId: { type: "string", description: "Target column ID" },
            force: { type: "boolean", description: "Force move even if WIP limit exceeded" },
          },
          required: ["id", "columnId"],
        },
      },
      {
        name: "kaban_update_task",
        description: "Update a task's properties",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID (ULID)" },
            title: { type: "string", description: "New task title" },
            description: { type: ["string", "null"], description: "New task description" },
            assignedTo: { type: ["string", "null"], description: "Assigned agent name" },
            files: {
              type: "array",
              items: { type: "string" },
              description: "Associated file paths",
            },
            labels: { type: "array", items: { type: "string" }, description: "Task labels" },
            expectedVersion: {
              type: "number",
              description: "Expected version for optimistic locking",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "kaban_delete_task",
        description: "Delete a task",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", description: "Task ID (ULID)" } },
          required: ["id"],
        },
      },
      {
        name: "kaban_complete_task",
        description: "Mark a task as completed (move to terminal column)",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", description: "Task ID (ULID) or partial ID" } },
          required: ["id"],
        },
      },
      {
        name: "kaban_status",
        description: "Get board status summary",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "kaban_init") {
        const { name: boardName = "Kaban Board", path: basePath } = (args ?? {}) as {
          name?: string;
          path?: string;
        };
        const targetPath = basePath ?? workingDirectory;
        const { kabanDir, dbPath, configPath } = getKabanPaths(targetPath);

        if (existsSync(dbPath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Board already exists in this directory" }),
              },
            ],
            isError: true,
          };
        }

        mkdirSync(kabanDir, { recursive: true });

        const config: Config = {
          ...DEFAULT_CONFIG,
          board: { name: boardName },
        };
        writeFileSync(configPath, JSON.stringify(config, null, 2));

        const db = await createDb(dbPath);
        await initializeSchema(db);
        const boardService = new BoardService(db);
        await boardService.initializeBoard(config);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  board: boardName,
                  paths: { database: dbPath, config: configPath },
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const { taskService, boardService } = await createContext(workingDirectory);

      switch (name) {
        case "kaban_add_task": {
          const task = await taskService.addTask(args as Parameters<typeof taskService.addTask>[0]);
          return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
        }
        case "kaban_get_task": {
          const task = await taskService.getTask((args as { id: string }).id);
          if (!task)
            return {
              content: [{ type: "text", text: JSON.stringify({ error: "Task not found" }) }],
            };
          return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
        }
        case "kaban_list_tasks": {
          const tasks = await taskService.listTasks(
            args as Parameters<typeof taskService.listTasks>[0],
          );
          return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
        }
        case "kaban_move_task": {
          const { id, columnId, force } = args as { id: string; columnId: string; force?: boolean };
          const task = await taskService.moveTask(id, columnId, { force });
          return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
        }
        case "kaban_update_task": {
          const { id, expectedVersion, ...updates } = args as {
            id: string;
            expectedVersion?: number;
            [key: string]: unknown;
          };
          const task = await taskService.updateTask(id, updates, expectedVersion);
          return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
        }
        case "kaban_delete_task": {
          await taskService.deleteTask((args as { id: string }).id);
          return { content: [{ type: "text", text: JSON.stringify({ success: true }) }] };
        }
        case "kaban_complete_task": {
          const { id } = args as { id: string };
          const tasks = await taskService.listTasks();
          const task = tasks.find((t) => t.id.startsWith(id));
          if (!task)
            return {
              content: [
                { type: "text", text: JSON.stringify({ error: `Task '${id}' not found` }) },
              ],
            };
          const terminal = await boardService.getTerminalColumn();
          if (!terminal)
            return {
              content: [
                { type: "text", text: JSON.stringify({ error: "No terminal column configured" }) },
              ],
            };
          const completed = await taskService.moveTask(task.id, terminal.id);
          return { content: [{ type: "text", text: JSON.stringify(completed, null, 2) }] };
        }
        case "kaban_status": {
          const board = await boardService.getBoard();
          const columns = await boardService.getColumns();
          const tasks = await taskService.listTasks();
          const columnStats = columns.map((column) => ({
            id: column.id,
            name: column.name,
            count: tasks.filter((t) => t.columnId === column.id).length,
            wipLimit: column.wipLimit,
            isTerminal: column.isTerminal,
          }));
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    board: { name: board?.name ?? "Kaban Board" },
                    columns: columnStats,
                    blockedCount: tasks.filter((t) => t.blockedReason).length,
                    totalTasks: tasks.length,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }
        default:
          return {
            content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: message }) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "kaban://board/status",
        name: "Board Status",
        description: "Current Kaban board status and task summary",
        mimeType: "application/json",
      },
      {
        uri: "kaban://board/columns",
        name: "Board Columns",
        description: "Available columns on the Kaban board",
        mimeType: "application/json",
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      const { taskService, boardService } = await createContext(workingDirectory);

      if (uri === "kaban://board/status") {
        const board = await boardService.getBoard();
        const columns = await boardService.getColumns();
        const tasks = await taskService.listTasks();
        const columnStats = columns.map((column) => ({
          id: column.id,
          name: column.name,
          count: tasks.filter((t) => t.columnId === column.id).length,
          wipLimit: column.wipLimit,
          isTerminal: column.isTerminal,
          tasks: tasks
            .filter((t) => t.columnId === column.id)
            .map((t) => ({
              id: t.id,
              title: t.title,
              createdBy: t.createdBy,
              blocked: !!t.blockedReason,
            })),
        }));
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  board: { name: board?.name ?? "Kaban Board" },
                  columns: columnStats,
                  blockedCount: tasks.filter((t) => t.blockedReason).length,
                  totalTasks: tasks.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (uri === "kaban://board/columns") {
        const columns = await boardService.getColumns();
        return {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(columns, null, 2) }],
        };
      }

      if (uri.startsWith("kaban://tasks/")) {
        const columnId = uri.replace("kaban://tasks/", "");
        const tasks = await taskService.listTasks({ columnId });
        return {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(tasks, null, 2) }],
        };
      }

      if (uri.startsWith("kaban://task/")) {
        const id = uri.replace("kaban://task/", "");
        const task = await taskService.getTask(id);
        if (!task)
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify({ error: "Task not found" }),
              },
            ],
          };
        return {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(task, null, 2) }],
        };
      }

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Resource not found" }),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        contents: [{ uri, mimeType: "application/json", text: JSON.stringify({ error: message }) }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kaban MCP server running on stdio");
}

export const mcpCommand = new Command("mcp")
  .description("Start MCP server for AI agent integration")
  .option("-p, --path <path>", "Working directory for Kaban board")
  .action(async (options) => {
    const workingDirectory = options.path ?? process.env.KABAN_PATH ?? process.cwd();
    await startMcpServer(workingDirectory);
  });
