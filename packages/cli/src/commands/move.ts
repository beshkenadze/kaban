import { KabanError } from "@kaban/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";

export const moveCommand = new Command("move")
  .description("Move a task to a different column")
  .argument("<id>", "Task ID (can be partial)")
  .argument("[column]", "Target column")
  .option("-n, --next", "Move to next column")
  .option("-f, --force", "Force move even if WIP limit exceeded")
  .action((id, column, options) => {
    try {
      const { taskService, boardService } = getContext();

      const tasks = taskService.listTasks();
      const task = tasks.find((t) => t.id.startsWith(id));

      if (!task) {
        console.error(`Error: Task '${id}' not found`);
        process.exit(2);
      }

      let targetColumn = column;

      if (options.next) {
        const columns = boardService.getColumns();
        const currentIdx = columns.findIndex((c) => c.id === task.columnId);
        if (currentIdx < columns.length - 1) {
          targetColumn = columns[currentIdx + 1].id;
        } else {
          console.error("Error: Task is already in the last column");
          process.exit(4);
        }
      }

      if (!targetColumn) {
        console.error("Error: Specify a column or use --next");
        process.exit(4);
      }

      const moved = taskService.moveTask(task.id, targetColumn, {
        force: options.force,
      });

      const col = boardService.getColumn(moved.columnId);
      console.log(`Moved [${moved.id.slice(0, 8)}] to ${col?.name}`);
    } catch (error) {
      if (error instanceof KabanError) {
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
