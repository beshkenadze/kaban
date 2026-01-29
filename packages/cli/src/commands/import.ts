import { readFileSync } from "node:fs";
import { KabanError, MarkdownService } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const importCommand = new Command("import")
  .description("Import tasks from markdown file")
  .argument("<file>", "Markdown file to import")
  .option("-d, --dry-run", "Preview import without creating tasks")
  .option("-j, --json", "Output as JSON")
  .action(async (file, options) => {
    const json = options.json;
    try {
      const { taskService, boardService } = await getContext();
      const markdownService = new MarkdownService();

      const markdown = readFileSync(file, "utf-8");
      const parseResult = markdownService.parseMarkdown(markdown);

      if (parseResult.errors.length > 0) {
        if (json) {
          outputError(1, `Parse errors: ${parseResult.errors.join(", ")}`);
        } else {
          console.error("Parse errors:");
          for (const error of parseResult.errors) {
            console.error(`  - ${error}`);
          }
        }
        process.exit(1);
      }

      const columns = await boardService.getColumns();
      const columnMap = new Map(columns.map((c) => [c.name.toLowerCase(), c.id]));

      if (options.dryRun) {
        let taskCount = 0;
        for (const column of parseResult.columns) {
          taskCount += column.tasks.length;
        }
        if (json) {
          outputSuccess({
            dryRun: true,
            wouldCreate: taskCount,
            columns: parseResult.columns.map((c) => ({
              name: c.name,
              tasks: c.tasks.length,
            })),
          });
        } else {
          console.log(`Dry run: would import ${taskCount} tasks`);
          for (const column of parseResult.columns) {
            console.log(`  ${column.name}: ${column.tasks.length} tasks`);
          }
        }
        return;
      }

      const createdTasks = [];
      for (const column of parseResult.columns) {
        const columnId = columnMap.get(column.name.toLowerCase()) ?? "todo";
        for (const task of column.tasks) {
          const created = await taskService.addTask({
            title: task.title,
            description: task.description ?? undefined,
            columnId,
            labels: task.labels,
            assignedTo: task.assignedTo ?? undefined,
            dueDate: task.dueDate?.toISOString(),
          });
          createdTasks.push(created);
        }
      }

      if (json) {
        outputSuccess({ imported: createdTasks.length, tasks: createdTasks });
      } else {
        console.log(`Imported ${createdTasks.length} tasks`);
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
