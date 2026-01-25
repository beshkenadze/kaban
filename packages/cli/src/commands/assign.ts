import { KabanError } from "@kaban-board/core";
import { Command } from "commander";
import { getContext } from "../lib/context.js";
import { outputError, outputSuccess } from "../lib/json-output.js";

export const assignCommand = new Command("assign")
  .description("Assign a task to an agent")
  .argument("<id>", "Task ID (can be partial)")
  .argument("[agent]", "Agent to assign (omit with --clear to unassign)")
  .option("-c, --clear", "Unassign the task")
  .option("-j, --json", "Output as JSON")
  .action(async (id, agent, options) => {
    const json = options.json;
    try {
      const { taskService } = await getContext();

      if (options.clear && agent) {
        if (json) outputError(4, "Cannot use --clear with agent argument");
        console.error("Error: Cannot use --clear with agent argument");
        process.exit(4);
      }

      const tasks = await taskService.listTasks();
      const task = tasks.find((t) => t.id.startsWith(id));

      if (!task) {
        if (json) outputError(2, `Task '${id}' not found`);
        console.error(`Error: Task '${id}' not found`);
        process.exit(2);
      }

      const previousAssignee = task.assignedTo;

      if (options.clear) {
        const updated = await taskService.updateTask(task.id, { assignedTo: null });
        if (json) {
          outputSuccess(updated);
          return;
        }
        console.log(`Unassigned [${updated.id.slice(0, 8)}] "${updated.title}"`);
        return;
      }

      if (!agent) {
        if (json) outputError(4, "Specify an agent or use --clear");
        console.error("Error: Specify an agent or use --clear to unassign");
        process.exit(4);
      }

      const updated = await taskService.updateTask(task.id, { assignedTo: agent });

      if (json) {
        outputSuccess(updated);
        return;
      }

      const prevMsg = previousAssignee ? ` (was: ${previousAssignee})` : "";
      console.log(`Assigned [${updated.id.slice(0, 8)}] "${updated.title}" to ${updated.assignedTo}${prevMsg}`);
    } catch (error) {
      if (error instanceof KabanError) {
        if (json) outputError(error.code, error.message);
        console.error(`Error: ${error.message}`);
        process.exit(error.code);
      }
      throw error;
    }
  });
