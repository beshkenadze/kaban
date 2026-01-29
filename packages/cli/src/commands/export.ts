import { writeFileSync } from "node:fs";
import { KabanError, MarkdownService } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const exportCommand = new Command("export")
  .description("Export board to markdown format")
  .option("-o, --output <file>", "Output file path (default: stdout)")
  .option("-a, --archived", "Include archived tasks")
  .option("--no-metadata", "Exclude task metadata (IDs)")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { taskService, boardService } = await getContext();
      const markdownService = new MarkdownService();

      const board = await boardService.getBoard();
      const columns = await boardService.getColumns();
      const allTasks = await taskService.listTasks({ includeArchived: options.archived });

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
        { includeArchived: options.archived, includeMetadata: options.metadata !== false },
      );

      if (options.output) {
        writeFileSync(options.output, markdown);
        if (json) {
          outputSuccess({ file: options.output, tasks: allTasks.length });
        } else {
          console.log(`Exported ${allTasks.length} tasks to ${options.output}`);
        }
      } else {
        if (json) {
          outputSuccess({ markdown, tasks: allTasks.length });
        } else {
          console.log(markdown);
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
