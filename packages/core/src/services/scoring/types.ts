import type { Task } from "../../types.js";

/**
 * Interface for task scorers.
 * Higher score = more important/urgent.
 */
export interface TaskScorer {
  /** Unique identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** Units for display (e.g., "pri/day", "score") */
  units?: string;

  /**
   * Calculate score for task.
   * Returns Promise to allow async operations (e.g., fetching related tasks).
   */
  score(task: Task): Promise<number>;
}

/**
 * Scored task with score breakdown
 */
export interface ScoredTask {
  task: Task;
  score: number;
  breakdown?: Record<string, number>;
}
