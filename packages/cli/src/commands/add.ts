import { Command } from "commander";
import { getContext, getAgent } from "../lib/context.js";
import { KabanError } from "@kaban/core";

export const addCommand = new Command("add")
  .description("Add a new task")
  .argument("<title>", "Task title")
  .option("-c, --column <column>", "Column to add task to")
  .option("-a, --agent <agent>", "Agent creating the task")
  .option("-d, --depends-on <ids>", "Comma-separated task IDs this depends on")
  .action((title, options) => {
    try {
      const { taskService, config } = getContext();
      const agent = options.agent ?? getAgent();
      const columnId = options.column ?? config.defaults.column;
      const dependsOn = options.dependsOn
        ? options.dependsOn.split(",").map((s: string) => s.trim())
        : [];

      const task = taskService.addTask({
        title,
        columnId,
        agent,
        dependsOn,
      });

      console.log(`Created task [${task.id.slice(0, 8)}] "${task.title}"`);
      console.log(`  Column: ${task.columnId}`);
      console.log(`  Agent: ${task.createdBy}`);
    } catch (error) {
      if (error instanceof KabanError) {
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
