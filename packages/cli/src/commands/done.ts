import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const doneCommand = new Command("done")
  .description("Mark a task as done")
  .argument("<id>", "Task ID (can be partial)")
  .option("-j, --json", "Output as JSON")
  .action(async (id, options) => {
    const json = options.json;
    try {
      const { taskService, boardService } = await getContext();

      const tasks = await taskService.listTasks();
      const task = tasks.find((t) => t.id.startsWith(id));

      if (!task) {
        if (json) outputError(2, `Task '${id}' not found`);
        console.error(`Error: Task '${id}' not found`);
        process.exit(2);
      }

      const terminal = await boardService.getTerminalColumn();
      if (!terminal) {
        if (json) outputError(1, "No terminal column configured");
        console.error("Error: No terminal column configured");
        process.exit(1);
      }

      const moved = await taskService.moveTask(task.id, terminal.id);

      if (json) {
        outputSuccess(moved);
        return;
      }

      console.log(`Completed [${moved.id.slice(0, 8)}] "${moved.title}"`);
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
