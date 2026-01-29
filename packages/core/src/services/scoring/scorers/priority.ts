import type { Task } from "../../../types.js";
import type { TaskScorer } from "../types.js";

const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 1000,
  urgent: 500,
  high: 100,
  medium: 50,
  low: 10,
  p0: 1000,
  p1: 500,
  p2: 100,
  p3: 50,
  p4: 10,
};

/**
 * Priority scorer based on labels.
 * Recognizes labels like "critical", "urgent", "high", "p0", etc.
 */
export const priorityScorer: TaskScorer = {
  name: "priority",
  description: "Score based on priority labels (critical, urgent, high, p0-p4)",
  units: "priority",

  async score(task: Task): Promise<number> {
    let maxPriority = 0;

    for (const label of task.labels) {
      const weight = PRIORITY_WEIGHTS[label.toLowerCase()];
      if (weight && weight > maxPriority) {
        maxPriority = weight;
      }
    }

    return maxPriority;
  },
};
