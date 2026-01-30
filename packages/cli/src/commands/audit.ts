import { AuditService, KabanError, type AuditEntry } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

function parseRelativeDate(input: string): Date {
  const match = input.match(/^(\d+)([dwmh])$/);
  if (!match) {
    return new Date(input);
  }

  const [, numStr, unit] = match;
  const num = parseInt(numStr, 10);
  const now = new Date();

  switch (unit) {
    case "h":
      return new Date(now.getTime() - num * 60 * 60 * 1000);
    case "d":
      return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
    case "w":
      return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
    case "m":
      return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(input);
  }
}

function formatEntry(entry: AuditEntry): string {
  const time = entry.timestamp.toISOString().slice(0, 19).replace("T", " ");
  const actor = entry.actor ? `@${entry.actor}` : "";
  const field = entry.fieldName ? `.${entry.fieldName}` : "";

  let change = "";
  if (entry.eventType === "UPDATE") {
    change = `${entry.oldValue ?? "null"} -> ${entry.newValue ?? "null"}`;
  } else if (entry.eventType === "CREATE") {
    change = entry.newValue ?? "";
  } else {
    change = entry.oldValue ?? "";
  }

  return `  ${time} ${entry.eventType.padEnd(6)} ${entry.objectType}${field}\n    ${entry.objectId.slice(0, 8)} ${actor} ${change}`;
}

export const auditCommand = new Command("audit").description("View audit log history");

auditCommand
  .command("list")
  .description("List recent audit entries")
  .option("-l, --limit <n>", "Max entries", "50")
  .option("-a, --actor <name>", "Filter by actor")
  .option("-t, --type <type>", "Filter by object type (task|column|board)")
  .option("-e, --event <type>", "Filter by event type (CREATE|UPDATE|DELETE)")
  .option("--since <date>", "Filter from date (ISO 8601 or relative: 1d, 1w, 30d)")
  .option("--until <date>", "Filter to date (ISO 8601 or relative: 1d, 1w, 30d)")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { db } = await getContext();
      const auditService = new AuditService(db);

      const result = await auditService.getHistory({
        limit: parseInt(options.limit, 10),
        actor: options.actor,
        objectType: options.type,
        eventType: options.event,
        since: options.since ? parseRelativeDate(options.since) : undefined,
        until: options.until ? parseRelativeDate(options.until) : undefined,
      });

      if (json) {
        outputSuccess(result);
        return;
      }

      console.log(`\n  Audit Log (${result.entries.length} of ${result.total})\n`);
      for (const entry of result.entries) {
        console.log(formatEntry(entry));
      }
      if (result.hasMore) console.log(`\n  ... more entries available`);
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

auditCommand
  .command("task <id>")
  .description("View history for a specific task")
  .option("-l, --limit <n>", "Max entries", "50")
  .option("-j, --json", "Output as JSON")
  .action(async (id, options) => {
    const json = options.json;
    try {
      const { db, taskService } = await getContext();
      const task = await taskService.resolveTask(id);
      if (!task) {
        if (json) outputError(2, `Task '${id}' not found`);
        console.error(`Error: Task '${id}' not found`);
        process.exit(2);
      }

      const auditService = new AuditService(db);
      const entries = await auditService.getTaskHistory(task.id, parseInt(options.limit, 10));

      if (json) {
        outputSuccess({ task: { id: task.id, title: task.title }, entries });
        return;
      }

      console.log(`\n  History for [${task.id.slice(0, 8)}] "${task.title}"\n`);
      for (const entry of entries) {
        const time = entry.timestamp.toISOString().slice(0, 19).replace("T", " ");
        const actor = entry.actor ? `@${entry.actor}` : "";

        if (entry.eventType === "CREATE") {
          console.log(`  ${time} CREATED ${actor}`);
        } else if (entry.eventType === "DELETE") {
          console.log(`  ${time} DELETED ${actor}`);
        } else {
          const field = entry.fieldName ?? "?";
          console.log(
            `  ${time} ${field}: ${entry.oldValue ?? "null"} -> ${entry.newValue ?? "null"} ${actor}`
          );
        }
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

auditCommand
  .command("stats")
  .description("Show audit statistics")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const json = options.json;
    try {
      const { db } = await getContext();
      const auditService = new AuditService(db);
      const stats = await auditService.getStats();

      if (json) {
        outputSuccess(stats);
        return;
      }

      console.log("\n  Audit Statistics\n");
      console.log(`  Total entries: ${stats.totalEntries}`);
      console.log("\n  By Event Type:");
      for (const [type, count] of Object.entries(stats.byEventType)) {
        console.log(`    ${type}: ${count}`);
      }
      console.log("\n  By Object Type:");
      for (const [type, count] of Object.entries(stats.byObjectType)) {
        console.log(`    ${type}: ${count}`);
      }
      if (stats.recentActors.length > 0) {
        console.log("\n  Recent Actors:");
        for (const actor of stats.recentActors) {
          console.log(`    ${actor}`);
        }
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

auditCommand
  .command("actor <name>")
  .description("View changes by a specific actor")
  .option("-l, --limit <n>", "Max entries", "50")
  .option("-j, --json", "Output as JSON")
  .action(async (name, options) => {
    const json = options.json;
    try {
      const { db } = await getContext();
      const auditService = new AuditService(db);
      const entries = await auditService.getChangesByActor(name, parseInt(options.limit, 10));

      if (json) {
        outputSuccess({ actor: name, entries, count: entries.length });
        return;
      }

      console.log(`\n  Changes by @${name} (${entries.length} entries)\n`);
      for (const entry of entries) {
        console.log(formatEntry(entry));
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
