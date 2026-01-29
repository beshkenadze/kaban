import type { Task } from "../../../types.js";
import type { TaskScorer } from "../types.js";

/**
 * FIFO scorer - oldest tasks first.
 * Score is based on creation time (older = higher).
 */
export const fifoScorer: TaskScorer = {
  name: "fifo",
  description: "First In, First Out - oldest tasks scored higher",
  units: "age",

  async score(task: Task): Promise<number> {
    const ageMs = Date.now() - task.createdAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays;
  },
};
