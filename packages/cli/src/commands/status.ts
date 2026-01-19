import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const statusCommand = new Command("status")
  .description("Show board status summary")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { taskService, boardService } = await getContext();
      const board = await boardService.getBoard();
      const columns = await boardService.getColumns();
      const tasks = await taskService.listTasks();

      if (json) {
        const columnStats = columns.map((column) => {
          const columnTasks = tasks.filter((t) => t.columnId === column.id);
          return {
            id: column.id,
            name: column.name,
            count: columnTasks.length,
            wipLimit: column.wipLimit,
            isTerminal: column.isTerminal,
          };
        });
        outputSuccess({
          board: { name: board?.name ?? "Kaban Board" },
          columns: columnStats,
          blockedCount: tasks.filter((t) => t.blockedReason).length,
          totalTasks: tasks.length,
        });
        return;
      }

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
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
