import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AuditService,
  BoardService,
  type Config,
  createDb,
  DEFAULT_CONFIG,
  initializeSchema,
  TaskService,
  LinkService,
  MarkdownService,
  ScoringService,
  fifoScorer,
  priorityScorer,
  dueDateScorer,
  createBlockingScorer,
  type LinkType,
  type TaskLink,
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

export type McpResponse = { content: { type: string; text: string }[]; isError?: boolean };

export const mcpHelpers = {
  getParam(
    args: Record<string, unknown> | undefined,
    primary: string,
    alias: string,
  ): string | undefined {
    if (!args) return undefined;
    const primaryVal = args[primary];
    if (typeof primaryVal === "string" && primaryVal.trim()) return primaryVal;
    const aliasVal = args[alias];
    if (typeof aliasVal === "string" && aliasVal.trim()) return aliasVal;
    return undefined;
  },

  errorResponse(message: string): McpResponse {
    return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
  },

  jsonResponse(data: unknown): McpResponse {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
};

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
  const linkService = new LinkService(db);
  const markdownService = new MarkdownService();
  const scoringService = new ScoringService();
  scoringService.addScorer(priorityScorer);
  scoringService.addScorer(dueDateScorer);
  scoringService.addScorer(createBlockingScorer(async (taskId) => {
    const blocking = await linkService.getBlocking(taskId);
    return blocking.length;
  }));
  scoringService.addScorer(fifoScorer);

  return { db, config, boardService, taskService, linkService, markdownService, scoringService };
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
          properties: {
            id: { type: "string", description: "Task ID (ULID)" },
            taskId: { type: "string", description: "Task ID (ULID) - alias for 'id'" },
          },
        },
      },
      {
        name: "kaban_list_tasks",
        description: "List tasks with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            columnId: { type: "string", description: "Filter by column ID" },
            agent: { type: "string", description: "Filter by creator agent name" },
            assignee: { type: "string", description: "Filter by assigned agent name" },
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
            taskId: { type: "string", description: "Task ID (ULID) - alias for 'id'" },
            columnId: { type: "string", description: "Target column ID" },
            column: { type: "string", description: "Target column ID - alias for 'columnId'" },
            force: { type: "boolean", description: "Force move even if WIP limit exceeded" },
          },
        },
      },
       {
         name: "kaban_update_task",
         description: "Update a task's properties",
         inputSchema: {
           type: "object",
           properties: {
             id: { type: "string", description: "Task ID (ULID)" },
             taskId: { type: "string", description: "Task ID (ULID) - alias for 'id'" },
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
         },
       },
       {
         name: "kaban_assign_task",
         description: "Assign or unassign a task to/from an agent (convenience wrapper for kaban_update_task)",
         inputSchema: {
           type: "object",
           properties: {
             id: { type: "string", description: "Task ID (ULID)" },
             taskId: { type: "string", description: "Task ID - alias for 'id'" },
             assignee: { type: ["string", "null"], description: "Agent name (null to unassign)" },
           },
         },
       },
       {
         name: "kaban_delete_task",
        description: "Delete a task",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID (ULID)" },
            taskId: { type: "string", description: "Task ID (ULID) - alias for 'id'" },
          },
        },
      },
      {
        name: "kaban_complete_task",
        description: "Mark a task as completed (move to terminal column)",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID (ULID) or partial ID" },
            taskId: {
              type: "string",
              description: "Task ID (ULID) or partial ID - alias for 'id'",
            },
          },
        },
      },
      {
        name: "kaban_status",
        description: "Get board status summary",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "kaban_archive_tasks",
        description:
          "Archive completed or stale tasks. By default archives from terminal columns only.",
        inputSchema: {
          type: "object",
          properties: {
            columnId: { type: "string", description: "Archive from this column only" },
            olderThanDays: { type: "number", description: "Archive tasks older than N days" },
            allColumns: { type: "boolean", description: "Archive from ALL columns" },
            dryRun: { type: "boolean", description: "Preview without archiving" },
          },
        },
      },
      {
        name: "kaban_search_archive",
        description: "Search archived tasks using full-text search",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            limit: { type: "number", description: "Max results (default: 50)" },
          },
          required: ["query"],
        },
      },
      {
        name: "kaban_restore_task",
        description: "Restore a task from archive",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task ID to restore" },
            taskId: { type: "string", description: "Task ID - alias for id" },
            columnId: { type: "string", description: "Target column (default: todo)" },
          },
        },
      },
      {
        name: "kaban_purge_archive",
        description: "Permanently delete all archived tasks",
        inputSchema: {
          type: "object",
          properties: {
            confirm: { type: "boolean", description: "Must be true to confirm" },
            dryRun: { type: "boolean", description: "Preview without deleting" },
          },
          required: ["confirm"],
        },
      },
      {
        name: "kaban_reset_board",
        description: "Delete ALL tasks (active and archived)",
        inputSchema: {
          type: "object",
          properties: {
            confirm: { type: "boolean", description: "Must be true to confirm" },
            dryRun: { type: "boolean", description: "Preview without deleting" },
          },
          required: ["confirm"],
        },
      },
      {
        name: "kaban_archive_stats",
        description: "Get archive statistics",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "kaban_add_dependency",
        description: "Add a dependency to a task (task cannot start until dependency is done)",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task that depends on another" },
            id: { type: "string", description: "Task ID - alias for taskId" },
            dependsOnId: { type: "string", description: "Task that must be completed first" },
          },
          required: ["dependsOnId"],
        },
      },
      {
        name: "kaban_remove_dependency",
        description: "Remove a dependency from a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            id: { type: "string", description: "Task ID - alias" },
            dependsOnId: { type: "string", description: "Dependency to remove" },
          },
          required: ["dependsOnId"],
        },
      },
      {
        name: "kaban_check_dependencies",
        description: "Check if task dependencies are resolved",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            id: { type: "string", description: "Task ID - alias" },
          },
        },
      },
      {
        name: "kaban_add_task_checked",
        description: "Add task with duplicate detection. Rejects if very similar task exists.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Task description" },
            columnId: { type: "string", description: "Target column (default: todo)" },
            createdBy: { type: "string", description: "Creator: user, claude, etc." },
            agent: { type: "string", description: "Creator (deprecated, use createdBy)" },
            assignedTo: { type: "string", description: "Assignee" },
            dependsOn: { type: "array", items: { type: "string" }, description: "Dependency IDs" },
            force: { type: "boolean", description: "Create even if similar exists" },
          },
          required: ["title"],
        },
      },
      {
        name: "kaban_add_link",
        description: "Create a link between two tasks",
        inputSchema: {
          type: "object",
          properties: {
            sourceId: { type: "string", description: "Source task ID" },
            targetId: { type: "string", description: "Target task ID" },
            type: {
              type: "string",
              enum: ["relates_to", "blocks", "duplicates", "parent_of"],
              description: "Link type (default: relates_to)",
            },
            metadata: { type: "object", description: "Optional metadata for the link" },
          },
          required: ["sourceId", "targetId"],
        },
      },
      {
        name: "kaban_remove_link",
        description: "Remove a link between two tasks",
        inputSchema: {
          type: "object",
          properties: {
            sourceId: { type: "string", description: "Source task ID" },
            targetId: { type: "string", description: "Target task ID" },
            type: {
              type: "string",
              enum: ["relates_to", "blocks", "duplicates", "parent_of"],
              description: "Link type to remove (removes all types if not specified)",
            },
          },
          required: ["sourceId", "targetId"],
        },
      },
      {
        name: "kaban_get_links",
        description: "Get links for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            id: { type: "string", description: "Task ID - alias for taskId" },
            direction: {
              type: "string",
              enum: ["outgoing", "incoming", "both"],
              description: "Link direction to return (default: both)",
            },
            type: {
              type: "string",
              enum: ["relates_to", "blocks", "duplicates", "parent_of"],
              description: "Filter by link type",
            },
          },
        },
      },
      {
        name: "kaban_get_next_task",
        description: "Get the highest-priority task to work on next (considering dependencies, due dates, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            columnId: { type: "string", description: "Filter by column (default: todo)" },
          },
        },
      },
      {
        name: "kaban_score_tasks",
        description: "Get all tasks with their priority scores",
        inputSchema: {
          type: "object",
          properties: {
            columnId: { type: "string", description: "Filter by column" },
            limit: { type: "number", description: "Max tasks to return (default: 10)" },
          },
        },
      },
      {
        name: "kaban_export_markdown",
        description: "Export the board to markdown format",
        inputSchema: {
          type: "object",
          properties: {
            includeArchived: { type: "boolean", description: "Include archived tasks (default: false)" },
            includeMetadata: { type: "boolean", description: "Include task metadata (default: true)" },
          },
        },
      },
      {
        name: "kaban_import_markdown",
        description: "Import tasks from markdown format (creates new tasks, does not modify existing)",
        inputSchema: {
          type: "object",
          properties: {
            markdown: { type: "string", description: "Markdown content to import" },
            dryRun: { type: "boolean", description: "Preview import without creating tasks" },
          },
          required: ["markdown"],
        },
      },
      {
        name: "kaban_get_audit_history",
        description: "Get audit log history with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            objectType: {
              type: "string",
              enum: ["task", "column", "board"],
              description: "Filter by object type",
            },
            objectId: { type: "string", description: "Filter by object ID" },
            eventType: {
              type: "string",
              enum: ["CREATE", "UPDATE", "DELETE"],
              description: "Filter by event type",
            },
            actor: { type: "string", description: "Filter by actor name" },
            limit: { type: "number", description: "Max entries (default: 50, max: 1000)" },
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
    ],
  }));

  const { getParam, errorResponse, jsonResponse } = mcpHelpers;

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
          return errorResponse("Board already exists in this directory");
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

        return jsonResponse({
          success: true,
          board: boardName,
          paths: { database: dbPath, config: configPath },
        });
      }

      const { taskService, boardService, linkService, markdownService, scoringService } =
        await createContext(workingDirectory);

      const taskArgs = args as Record<string, unknown> | undefined;
      const taskId = getParam(taskArgs, "id", "taskId");

      switch (name) {
        case "kaban_add_task": {
          const addArgs = args as Record<string, unknown> | undefined;
          const title = addArgs?.title;
          if (typeof title !== "string" || !title.trim()) {
            return errorResponse("Title required (non-empty string)");
          }
          const task = await taskService.addTask(args as Parameters<typeof taskService.addTask>[0]);
          return jsonResponse(task);
        }
        case "kaban_get_task": {
          if (!taskId) return errorResponse("Task ID required (use 'id' or 'taskId')");
          const task = await taskService.getTask(taskId);
          if (!task) return errorResponse("Task not found");
          return jsonResponse(task);
        }
        case "kaban_list_tasks": {
          const tasks = await taskService.listTasks(
            args as Parameters<typeof taskService.listTasks>[0],
          );
          return jsonResponse(tasks);
        }
        case "kaban_move_task": {
          if (!taskId) return errorResponse("Task ID required (use 'id' or 'taskId')");
          const targetColumn = getParam(taskArgs, "columnId", "column");
          if (!targetColumn)
            return errorResponse("Column ID required (use 'columnId' or 'column')");
          const { force } = (args ?? {}) as { force?: boolean };
          const task = await taskService.moveTask(taskId, targetColumn, { force });
          return jsonResponse(task);
        }
         case "kaban_update_task": {
           if (!taskId) return errorResponse("Task ID required (use 'id' or 'taskId')");
           const {
             taskId: _t,
             id: _i,
             expectedVersion,
             ...updates
           } = (args ?? {}) as {
             id?: string;
             taskId?: string;
             expectedVersion?: number;
             [key: string]: unknown;
           };
           const task = await taskService.updateTask(taskId, updates, expectedVersion);
           return jsonResponse(task);
         }
         case "kaban_assign_task": {
           const id = getParam(taskArgs, "id", "taskId");
           if (!id) return errorResponse("Task ID required (use 'id' or 'taskId')");
           const { assignee } = (args ?? {}) as { assignee?: string | null };
           const task = await taskService.updateTask(id, { assignedTo: assignee ?? null });
           return jsonResponse(task);
         }
         case "kaban_delete_task": {
          if (!taskId) return errorResponse("Task ID required (use 'id' or 'taskId')");
          await taskService.deleteTask(taskId);
          return jsonResponse({ success: true });
        }
        case "kaban_complete_task": {
          if (!taskId) return errorResponse("Task ID required (use 'id' or 'taskId')");
          const tasks = await taskService.listTasks();
          const task = tasks.find((t) => t.id.startsWith(taskId));
          if (!task) return errorResponse(`Task '${taskId}' not found`);
          const terminal = await boardService.getTerminalColumn();
          if (!terminal) return errorResponse("No terminal column configured");
          const completed = await taskService.moveTask(task.id, terminal.id);
          return jsonResponse(completed);
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
          return jsonResponse({
            board: { name: board?.name ?? "Kaban Board" },
            columns: columnStats,
            blockedCount: tasks.filter((t) => t.blockedReason).length,
            totalTasks: tasks.length,
          });
        }
        case "kaban_archive_tasks": {
          const { columnId, olderThanDays, allColumns, dryRun } = (args ?? {}) as {
            columnId?: string;
            olderThanDays?: number;
            allColumns?: boolean;
            dryRun?: boolean;
          };

          const columns = await boardService.getColumns();
          const terminalColumns = columns.filter((c) => c.isTerminal);

          let targetColumnIds: string[] = [];
          if (columnId) {
            targetColumnIds = [columnId];
          } else if (allColumns) {
            targetColumnIds = columns.map((c) => c.id);
          } else {
            targetColumnIds = terminalColumns.map((c) => c.id);
          }

          if (targetColumnIds.length === 0) {
            return jsonResponse({
              archivedCount: 0,
              taskIds: [],
              message: "No columns to archive from",
            });
          }

          const allTasks = await taskService.listTasks();
          let tasksToArchive = allTasks.filter(
            (t) => !t.archived && targetColumnIds.includes(t.columnId),
          );

          if (olderThanDays !== undefined) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - olderThanDays);
            tasksToArchive = tasksToArchive.filter((t) => t.createdAt < cutoff);
          }

          if (tasksToArchive.length === 0) {
            return jsonResponse({
              archivedCount: 0,
              taskIds: [],
              message: "No matching tasks to archive",
            });
          }

          if (dryRun) {
            return jsonResponse({
              dryRun: true,
              wouldArchive: tasksToArchive.length,
              taskIds: tasksToArchive.map((t) => t.id),
              tasks: tasksToArchive.map((t) => ({
                id: t.id,
                title: t.title,
                columnId: t.columnId,
              })),
            });
          }

          const result = await taskService.archiveTasks({
            taskIds: tasksToArchive.map((t) => t.id),
          });
          return jsonResponse(result);
        }
        case "kaban_search_archive": {
          const { query, limit } = (args ?? {}) as { query?: string; limit?: number };
          if (!query) return errorResponse("Query required");
          const result = await taskService.searchArchive(query, { limit });
          return jsonResponse(result);
        }
        case "kaban_restore_task": {
          const id = getParam(taskArgs, "id", "taskId");
          if (!id) return errorResponse("Task ID required");
          const { columnId } = (args ?? {}) as { columnId?: string };
          const task = await taskService.restoreTask(id, columnId);
          return jsonResponse(task);
        }
        case "kaban_purge_archive": {
          const { confirm, dryRun } = (args ?? {}) as { confirm?: boolean; dryRun?: boolean };
          if (!confirm) {
            return errorResponse("Must set confirm: true to purge archive");
          }
          if (dryRun) {
            const result = await taskService.searchArchive("", { limit: 1000 });
            return jsonResponse({
              dryRun: true,
              wouldDelete: result.total,
            });
          }
          const result = await taskService.purgeArchive();
          return jsonResponse(result);
        }
        case "kaban_reset_board": {
          const { confirm, dryRun } = (args ?? {}) as { confirm?: boolean; dryRun?: boolean };
          if (!confirm) {
            return errorResponse("Must set confirm: true to reset board");
          }
          if (dryRun) {
            const allTasks = await taskService.listTasks();
            const archivedResult = await taskService.searchArchive("", { limit: 1000 });
            return jsonResponse({
              dryRun: true,
              wouldDelete: allTasks.length + archivedResult.total,
              activeTasks: allTasks.length,
              archivedTasks: archivedResult.total,
            });
          }
          const result = await taskService.resetBoard();
          return jsonResponse(result);
        }
        case "kaban_archive_stats": {
          const archivedResult = await taskService.searchArchive("", { limit: 1 });
          const allTasks = await taskService.listTasks();
          const columns = await boardService.getColumns();
          const terminalColumns = columns.filter((c) => c.isTerminal);
          const completedCount = allTasks.filter((t) =>
            terminalColumns.some((c) => c.id === t.columnId),
          ).length;

          return jsonResponse({
            archivedCount: archivedResult.total,
            activeTasks: allTasks.length,
            completedNotArchived: completedCount,
          });
        }
        case "kaban_add_dependency": {
          const id = getParam(taskArgs, "taskId", "id");
          if (!id) return errorResponse("Task ID required");
          const { dependsOnId } = (args ?? {}) as { dependsOnId?: string };
          if (!dependsOnId) return errorResponse("dependsOnId required");
          const task = await taskService.addDependency(id, dependsOnId);
          return jsonResponse(task);
        }
        case "kaban_remove_dependency": {
          const id = getParam(taskArgs, "taskId", "id");
          if (!id) return errorResponse("Task ID required");
          const { dependsOnId } = (args ?? {}) as { dependsOnId?: string };
          if (!dependsOnId) return errorResponse("dependsOnId required");
          const task = await taskService.removeDependency(id, dependsOnId);
          return jsonResponse(task);
        }
        case "kaban_check_dependencies": {
          const id = getParam(taskArgs, "taskId", "id");
          if (!id) return errorResponse("Task ID required");
          const result = await taskService.validateDependencies(id);
          return jsonResponse(result);
        }
        case "kaban_add_task_checked": {
          const addCheckedArgs = args as Record<string, unknown> | undefined;
          const title = addCheckedArgs?.title;
          if (typeof title !== "string" || !title.trim()) {
            return errorResponse("Title required");
          }
          const { force, ...taskInput } = addCheckedArgs as {
            force?: boolean;
            [key: string]: unknown;
          };
          const result = await taskService.addTaskChecked(
            taskInput as Parameters<typeof taskService.addTask>[0],
            { force },
          );
          return jsonResponse(result);
        }
        case "kaban_add_link": {
          const { sourceId, targetId, type } = (args ?? {}) as {
            sourceId?: string;
            targetId?: string;
            type?: string;
          };
          if (!sourceId) return errorResponse("sourceId required");
          if (!targetId) return errorResponse("targetId required");
          const linkType = (type ?? "related") as LinkType;
          const link = await linkService.addLink(sourceId, targetId, linkType);
          return jsonResponse(link);
        }
        case "kaban_remove_link": {
          const { sourceId, targetId, type } = (args ?? {}) as {
            sourceId?: string;
            targetId?: string;
            type?: string;
          };
          if (!sourceId) return errorResponse("sourceId required");
          if (!targetId) return errorResponse("targetId required");
          if (!type) return errorResponse("type required");
          await linkService.removeLink(sourceId, targetId, type as LinkType);
          return jsonResponse({ success: true });
        }
        case "kaban_get_links": {
          const id = getParam(taskArgs, "taskId", "id");
          if (!id) return errorResponse("Task ID required");
          const { direction } = (args ?? {}) as {
            direction?: "outgoing" | "incoming" | "both";
          };
          let links: TaskLink[];
          if (direction === "outgoing") {
            links = await linkService.getLinksFrom(id);
          } else if (direction === "incoming") {
            links = await linkService.getLinksTo(id);
          } else {
            links = await linkService.getAllLinks(id);
          }
          return jsonResponse(links);
        }
        case "kaban_get_next_task": {
          const { columnId } = (args ?? {}) as { columnId?: string };
          const allTasks = await taskService.listTasks({ columnId: columnId ?? "todo" });
          const unblockedTasks = allTasks.filter((t) => !t.blockedReason && t.dependsOn.length === 0);
          if (unblockedTasks.length === 0) {
            return jsonResponse({ message: "No actionable tasks found", task: null });
          }
          const ranked = await scoringService.rankTasks(unblockedTasks);
          return jsonResponse(ranked[0]);
        }
        case "kaban_score_tasks": {
          const { columnId, limit } = (args ?? {}) as { columnId?: string; limit?: number };
          const allTasks = await taskService.listTasks(columnId ? { columnId } : undefined);
          const ranked = await scoringService.rankTasks(allTasks);
          return jsonResponse(ranked.slice(0, limit ?? 10));
        }
        case "kaban_export_markdown": {
          const { includeArchived, includeMetadata } = (args ?? {}) as {
            includeArchived?: boolean;
            includeMetadata?: boolean;
          };
          const board = await boardService.getBoard();
          const columns = await boardService.getColumns();
          const allTasks = await taskService.listTasks({ includeArchived });
          const tasksByColumn = new Map<string, typeof allTasks>();
          for (const task of allTasks) {
            const existing = tasksByColumn.get(task.columnId) ?? [];
            existing.push(task);
            tasksByColumn.set(task.columnId, existing);
          }
          const markdown = markdownService.exportBoard(
            { name: board?.name ?? "Kaban Board" },
            columns,
            tasksByColumn,
            { includeArchived, includeMetadata: includeMetadata ?? true },
          );
          return jsonResponse({ markdown });
        }
        case "kaban_import_markdown": {
          const { markdown, dryRun } = (args ?? {}) as { markdown?: string; dryRun?: boolean };
          if (!markdown) return errorResponse("markdown content required");
          const parseResult = markdownService.parseMarkdown(markdown);
          if (parseResult.errors.length > 0) {
            return jsonResponse({ success: false, errors: parseResult.errors, parsed: parseResult });
          }
          if (dryRun) {
            return jsonResponse({ dryRun: true, parsed: parseResult });
          }
          const createdTasks = [];
          for (const column of parseResult.columns) {
            for (const task of column.tasks) {
              const created = await taskService.addTask({
                title: task.title,
                description: task.description ?? undefined,
                columnId: column.name.toLowerCase().replace(/\s+/g, "_"),
                labels: task.labels,
                assignedTo: task.assignedTo ?? undefined,
                dueDate: task.dueDate?.toISOString(),
              });
              createdTasks.push(created);
            }
          }
          return jsonResponse({ success: true, tasksCreated: createdTasks.length, tasks: createdTasks });
        }
        case "kaban_get_audit_history": {
          const { objectType, objectId, eventType, actor, limit } = (args ?? {}) as {
            objectType?: "task" | "column" | "board";
            objectId?: string;
            eventType?: "CREATE" | "UPDATE" | "DELETE";
            actor?: string;
            limit?: number;
          };
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
        default:
          return errorResponse(`Unknown tool: ${name}`);
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
