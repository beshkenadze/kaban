import type { Task } from "../../types.js";
import type { ScoredTask, TaskScorer } from "./types.js";

export * from "./types.js";
export { fifoScorer } from "./scorers/fifo.js";
export { priorityScorer } from "./scorers/priority.js";
export { dueDateScorer } from "./scorers/due-date.js";
export { createBlockingScorer } from "./scorers/blocking.js";

export class ScoringService {
  private scorers: TaskScorer[] = [];

  addScorer(scorer: TaskScorer): void {
    this.scorers.push(scorer);
  }

  removeScorer(name: string): void {
    this.scorers = this.scorers.filter((s) => s.name !== name);
  }

  getScorers(): TaskScorer[] {
    return [...this.scorers];
  }

  async scoreTask(task: Task): Promise<ScoredTask> {
    const breakdown: Record<string, number> = {};
    let totalScore = 0;

    for (const scorer of this.scorers) {
      const score = await scorer.score(task);
      breakdown[scorer.name] = score;
      totalScore += score;
    }

    return {
      task,
      score: totalScore,
      breakdown,
    };
  }

  async rankTasks(tasks: Task[]): Promise<ScoredTask[]> {
    const scored = await Promise.all(tasks.map((task) => this.scoreTask(task)));
    return scored.sort((a, b) => b.score - a.score);
  }
}

export function createDefaultScoringService(): ScoringService {
  return new ScoringService();
}
