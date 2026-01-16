import { KabanError } from "@kaban/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";

export const listCommand = new Command("list")
  .description("List tasks")
  .option("-c, --column <column>", "Filter by column")
  .option("-a, --agent <agent>", "Filter by agent")
  .option("-b, --blocked", "Show only blocked tasks")
  .option("-j, --json", "Output as JSON")
  .action((options) => {
    try {
      const { taskService, boardService } = getContext();

      const tasks = taskService.listTasks({
        columnId: options.column,
        agent: options.agent,
        blocked: options.blocked,
      });

      if (options.json) {
        console.log(JSON.stringify(tasks, null, 2));
        return;
      }

      if (tasks.length === 0) {
        console.log("No tasks found");
        return;
      }

      const columns = boardService.getColumns();
      const columnMap = new Map(columns.map((c) => [c.id, c]));

      for (const task of tasks) {
        const column = columnMap.get(task.columnId);
        const blocked = task.blockedReason ? " [blocked]" : "";
        const agent = task.createdBy !== "user" ? ` @${task.createdBy}` : "";

        console.log(`[${task.id.slice(0, 8)}] ${task.title}${agent}${blocked}`);
        console.log(`         ${column?.name ?? task.columnId}`);
      }
    } catch (error) {
      if (error instanceof KabanError) {
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
