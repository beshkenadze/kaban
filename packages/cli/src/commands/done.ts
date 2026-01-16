import { KabanError } from "@kaban/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";

export const doneCommand = new Command("done")
  .description("Mark a task as done")
  .argument("<id>", "Task ID (can be partial)")
  .action((id) => {
    try {
      const { taskService, boardService } = getContext();

      const tasks = taskService.listTasks();
      const task = tasks.find((t) => t.id.startsWith(id));

      if (!task) {
        console.error(`Error: Task '${id}' not found`);
        process.exit(2);
      }

      const terminal = boardService.getTerminalColumn();
      if (!terminal) {
        console.error("Error: No terminal column configured");
        process.exit(1);
      }

      const moved = taskService.moveTask(task.id, terminal.id);
      console.log(`Completed [${moved.id.slice(0, 8)}] "${moved.title}"`);
    } catch (error) {
      if (error instanceof KabanError) {
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
