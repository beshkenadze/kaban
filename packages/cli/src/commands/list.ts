import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

type SortField = "name" | "date" | "updated";

function sortTasks(
  tasks: Awaited<ReturnType<typeof import("@kaban-board/core").TaskService.prototype.listTasks>>,
  sortBy: SortField,
  reverse: boolean,
) {
  const sorted = [...tasks].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.title.localeCompare(b.title);
      case "date":
        return a.createdAt.getTime() - b.createdAt.getTime();
      case "updated":
        return a.updatedAt.getTime() - b.updatedAt.getTime();
      default:
        return 0;
    }
  });
  return reverse ? sorted.reverse() : sorted;
}

export const listCommand = new Command("list")
  .description("List tasks")
  .option("-c, --column <column>", "Filter by column")
  .option("-a, --agent <agent>", "Filter by creator agent")
  .option("-u, --assignee <assignee>", "Filter by assigned agent")
  .option("-b, --blocked", "Show only blocked tasks")
  .option("-s, --sort <field>", "Sort by: name, date, updated")
  .option("-r, --reverse", "Reverse sort order")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { taskService, boardService } = await getContext();

      let tasks = await taskService.listTasks({
        columnId: options.column,
        agent: options.agent,
        assignee: options.assignee,
        blocked: options.blocked,
      });

      if (options.sort) {
        const validSorts: SortField[] = ["name", "date", "updated"];
        if (!validSorts.includes(options.sort)) {
          console.error(`Invalid sort field: ${options.sort}. Use: ${validSorts.join(", ")}`);
          process.exit(1);
        }
        tasks = sortTasks(tasks, options.sort as SortField, options.reverse ?? false);
      }

      if (json) {
        outputSuccess(tasks);
        return;
      }

      if (tasks.length === 0) {
        console.log("No tasks found");
        return;
      }

      const columns = await boardService.getColumns();
      const columnMap = new Map(columns.map((c) => [c.id, c]));

      for (const task of tasks) {
        const column = columnMap.get(task.columnId);
        const blocked = task.blockedReason ? " [blocked]" : "";
        const agent = task.createdBy !== "user" ? ` @${task.createdBy}` : "";
        const assignee = task.assignedTo ? ` → ${task.assignedTo}` : "";

        console.log(`[${task.id.slice(0, 8)}] ${task.title}${agent}${assignee}${blocked}`);
        console.log(`         ${column?.name ?? task.columnId}`);
        if (task.description) {
          const truncated =
            task.description.length > 60 ? `${task.description.slice(0, 60)}...` : task.description;
          console.log(`         ${truncated}`);
        }
      }
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
