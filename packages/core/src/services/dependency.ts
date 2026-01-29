import type { Task } from "../types.js";

export interface CycleCheckResult {
  hasCycle: boolean;
  cyclePath?: string[];
}

export class DependencyService {
  constructor(private getTask: (id: string) => Promise<Task | null>) {}

  /**
   * Check if adding a dependency would create a cycle.
   * Uses DFS from dependsOnId to see if we can reach taskId.
   *
   * If taskId depends on dependsOnId, we check:
   * "Can we reach taskId by following dependsOnId's dependency chain?"
   * If yes, adding this dependency would create a cycle.
   */
  async wouldCreateCycle(taskId: string, dependsOnId: string): Promise<CycleCheckResult> {
    if (taskId === dependsOnId) {
      return { hasCycle: true, cyclePath: [taskId, taskId] };
    }

    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = async (currentId: string): Promise<boolean> => {
      if (currentId === taskId) {
        path.push(currentId);
        return true;
      }

      if (visited.has(currentId)) {
        return false;
      }

      visited.add(currentId);
      path.push(currentId);

      const task = await this.getTask(currentId);
      if (!task?.dependsOn?.length) {
        path.pop();
        return false;
      }

      for (const depId of task.dependsOn) {
        if (await dfs(depId)) {
          return true;
        }
      }

      path.pop();
      return false;
    };

    const hasCycle = await dfs(dependsOnId);

    if (hasCycle) {
      return { hasCycle: true, cyclePath: [taskId, ...path] };
    }

    return { hasCycle: false };
  }

  formatCyclePath(path: string[], getShortId?: (id: string) => string | number | null): string {
    return path
      .map((id) => {
        const shortId = getShortId?.(id);
        return shortId ? `#${shortId}` : id.slice(0, 8);
      })
      .join(" → ");
  }
}
