import type { Task } from "../../../types.js";
import type { TaskScorer } from "../types.js";

/**
 * Due date scorer - tasks closer to (or past) due date score higher.
 * Tasks without due dates get 0.
 */
export const dueDateScorer: TaskScorer = {
  name: "due-date",
  description: "Score based on due date urgency (closer/overdue = higher)",
  units: "urgency",

  async score(task: Task): Promise<number> {
    if (!task.dueDate) {
      return 0;
    }

    const now = Date.now();
    const dueTime = task.dueDate.getTime();
    const daysUntilDue = (dueTime - now) / (1000 * 60 * 60 * 24);

    if (daysUntilDue <= 0) {
      // Overdue: high urgency, increases with how overdue
      return 1000 + Math.abs(daysUntilDue) * 10;
    }

    if (daysUntilDue <= 1) {
      // Due today or tomorrow
      return 500;
    }

    if (daysUntilDue <= 7) {
      // Due this week
      return 100 + (7 - daysUntilDue) * 10;
    }

    // Further out: lower score
    return Math.max(0, 50 - daysUntilDue);
  },
};
