import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const archiveCommand = new Command("archive")
  .description("Archive completed tasks")
  .option("-c, --column <column>", "Archive tasks from specific column")
  .option("-o, --older-than <days>", "Archive tasks older than N days", parseInt)
  .option("--all-columns", "Archive from all columns (requires --older-than)")
  .option("--dry-run", "Show what would be archived without archiving")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { taskService, boardService } = await getContext();

      // Default to terminal column unless --column or --all-columns is specified
      if (!options.column && !options.allColumns) {
        const terminal = await boardService.getTerminalColumn();
        if (!terminal) {
          if (json) outputError(1, "No terminal column configured and no criteria specified");
          console.error("Error: No terminal column configured and no criteria specified");
          process.exit(1);
        }
        options.column = terminal.id;
      }

      if (options.allColumns && !options.olderThan) {
        if (json) outputError(1, "--all-columns requires --older-than");
        console.error("Error: --all-columns requires --older-than");
        process.exit(1);
      }

      const criteria: { status?: string; olderThan?: Date } = {};

      if (options.column && !options.allColumns) {
        criteria.status = options.column;
      }

      if (options.olderThan) {
        const date = new Date();
        date.setDate(date.getDate() - options.olderThan);
        criteria.olderThan = date;
      }

      if (options.dryRun) {
        const tasks = await taskService.listTasks({
          columnId: criteria.status,
          includeArchived: false,
        });

        const olderThan = criteria.olderThan;
        const filtered = olderThan ? tasks.filter((t) => t.createdAt < olderThan) : tasks;

        if (json) {
          outputSuccess({ dryRun: true, wouldArchive: filtered.length, tasks: filtered });
          return;
        }

        console.log(`Would archive ${filtered.length} task(s):`);
        for (const task of filtered) {
          console.log(`  [${task.id.slice(0, 8)}] ${task.title}`);
        }
        return;
      }

      const result = await taskService.archiveTasks(criteria);

      if (json) {
        outputSuccess(result);
        return;
      }

      console.log(`Archived ${result.archivedCount} task(s)`);
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });

export const restoreCommand = new Command("restore")
  .description("Restore a task from archive")
  .argument("<id>", "Task ID to restore (can be partial)")
  .option("-t, --to <column>", "Restore to specific column")
  .option("-j, --json", "Output as JSON")
  .action(async (id, options) => {
    const json = options.json;
    try {
      const { taskService } = await getContext();

      const archivedTasks = await taskService.listTasks({ includeArchived: true });
      const task = archivedTasks.find((t) => t.id.startsWith(id) && t.archived);

      if (!task) {
        if (json) outputError(2, `Archived task '${id}' not found`);
        console.error(`Error: Archived task '${id}' not found`);
        process.exit(2);
      }

      const restored = await taskService.restoreTask(task.id, options.to);

      if (json) {
        outputSuccess(restored);
        return;
      }

      console.log(
        `Restored [${restored.id.slice(0, 8)}] "${restored.title}" to ${restored.columnId}`,
      );
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });

export const purgeCommand = new Command("purge")
  .description("Permanently delete archived tasks")
  .option("--confirm", "Confirm deletion (required)")
  .option("--dry-run", "Show what would be deleted without deleting")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { taskService } = await getContext();

      if (options.dryRun) {
        const archived = await taskService.listTasks({ includeArchived: true });
        const archivedOnly = archived.filter((t) => t.archived);

        if (json) {
          outputSuccess({ dryRun: true, wouldDelete: archivedOnly.length, tasks: archivedOnly });
          return;
        }

        console.log(`Would permanently delete ${archivedOnly.length} archived task(s):`);
        for (const task of archivedOnly) {
          console.log(`  [${task.id.slice(0, 8)}] ${task.title}`);
        }
        return;
      }

      if (!options.confirm) {
        if (json) outputError(1, "Use --confirm to permanently delete archived tasks");
        console.error("Error: Use --confirm to permanently delete archived tasks");
        process.exit(1);
      }

      const result = await taskService.purgeArchive();

      if (json) {
        outputSuccess(result);
        return;
      }

      console.log(`Permanently deleted ${result.deletedCount} archived task(s)`);
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });

export const resetCommand = new Command("reset")
  .description("Delete ALL tasks (destructive)")
  .option("--confirm", "Confirm deletion (required)")
  .option("--dry-run", "Show what would be deleted without deleting")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { taskService } = await getContext();

      if (options.dryRun) {
        const allTasks = await taskService.listTasks({ includeArchived: true });

        if (json) {
          outputSuccess({ dryRun: true, wouldDelete: allTasks.length, tasks: allTasks });
          return;
        }

        console.log(`Would permanently delete ALL ${allTasks.length} task(s):`);
        for (const task of allTasks) {
          const archived = task.archived ? " [archived]" : "";
          console.log(`  [${task.id.slice(0, 8)}] ${task.title}${archived}`);
        }
        return;
      }

      if (!options.confirm) {
        if (json) outputError(1, "Use --confirm to delete ALL tasks");
        console.error("Error: Use --confirm to delete ALL tasks");
        process.exit(1);
      }

      const result = await taskService.resetBoard();

      if (json) {
        outputSuccess(result);
        return;
      }

      console.log(`Deleted ALL ${result.deletedCount} task(s)`);
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
