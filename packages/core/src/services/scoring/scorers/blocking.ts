import type { Task } from "../../../types.js";
import type { TaskScorer } from "../types.js";

/**
 * Blocking scorer - tasks that block others score higher.
 * Requires external context about blocking relationships.
 */
export function createBlockingScorer(
  getBlockingCount: (taskId: string) => Promise<number>
): TaskScorer {
  return {
    name: "blocking",
    description: "Score based on how many tasks this blocks",
    units: "blocked",

    async score(task: Task): Promise<number> {
      const blockingCount = await getBlockingCount(task.id);
      // Each blocked task adds 50 points
      return blockingCount * 50;
    },
  };
}
