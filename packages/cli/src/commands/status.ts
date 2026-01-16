import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { KabanError } from "@kaban/core";

export const statusCommand = new Command("status")
  .description("Show board status summary")
  .action(() => {
    try {
      const { taskService, boardService } = getContext();
      const board = boardService.getBoard();
      const columns = boardService.getColumns();
      const tasks = taskService.listTasks();

      console.log(`\n  ${board?.name ?? "Kaban Board"}\n`);

      for (const column of columns) {
        const columnTasks = tasks.filter((t) => t.columnId === column.id);
        const count = columnTasks.length;
        const limit = column.wipLimit ? `/${column.wipLimit}` : "";
        const terminal = column.isTerminal ? " [done]" : "";

        console.log(`  ${column.name}: ${count}${limit}${terminal}`);
      }

      const blocked = tasks.filter((t) => t.blockedReason).length;
      if (blocked > 0) {
        console.log(`\n  ${blocked} blocked task(s)`);
      }

      console.log();
    } catch (error) {
      if (error instanceof KabanError) {
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
