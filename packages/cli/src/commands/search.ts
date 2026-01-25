import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const searchCommand = new Command("search")
  .description("Search tasks")
  .argument("<query>", "Search query")
  .option("--archive", "Search in archive only")
  .option("-l, --limit <n>", "Max results", parseInt, 50)
  .option("-j, --json", "Output as JSON")
  .action(async (query, options) => {
    const json = options.json;
    try {
      const { taskService } = await getContext();

      let tasks;
      if (options.archive) {
        const result = await taskService.searchArchive(query, {
          limit: options.limit,
        });
        tasks = result.tasks;
      } else {
        const allTasks = await taskService.listTasks();
        const queryLower = query.toLowerCase();
        tasks = allTasks.filter(
          (t) =>
            t.title.toLowerCase().includes(queryLower) ||
            t.description?.toLowerCase().includes(queryLower),
        );
      }

      if (json) {
        outputSuccess(tasks);
        return;
      }

      if (tasks.length === 0) {
        console.log("No tasks found");
        return;
      }

      for (const task of tasks) {
        const archived = task.archived ? " [archived]" : "";
        console.log(`[${task.id.slice(0, 8)}] ${task.title}${archived}`);
        console.log(`  Column: ${task.columnId} | By: ${task.createdBy}`);
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
