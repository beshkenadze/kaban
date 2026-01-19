import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getAgent, getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const addCommand = new Command("add")
  .description("Add a new task")
  .argument("<title>", "Task title")
  .option("-c, --column <column>", "Column to add task to")
  .option("-a, --agent <agent>", "Agent creating the task")
  .option("-D, --description <text>", "Task description")
  .option("-d, --depends-on <ids>", "Comma-separated task IDs this depends on")
  .option("-j, --json", "Output as JSON")
  .action(async (title, options) => {
    const json = options.json;
    try {
      const { taskService, config } = await getContext();
      const agent = options.agent ?? getAgent();
      const columnId = options.column ?? config.defaults.column;
      const dependsOn = options.dependsOn
        ? options.dependsOn.split(",").map((s: string) => s.trim())
        : [];

      const task = await taskService.addTask({
        title,
        description: options.description,
        columnId,
        agent,
        dependsOn,
      });

      if (json) {
        outputSuccess(task);
        return;
      }

      console.log(`Created task [${task.id.slice(0, 8)}] "${task.title}"`);
      console.log(`  Column: ${task.columnId}`);
      console.log(`  Agent: ${task.createdBy}`);
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
