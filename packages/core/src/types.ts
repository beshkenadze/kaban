import type { Config } from "./schemas.js";

export type { Board, Column, Config, Task } from "./schemas.js";

export const DEFAULT_CONFIG: Config = {
  board: {
    name: "Kaban Board",
  },
  columns: [
    { id: "backlog", name: "Backlog" },
    { id: "todo", name: "Todo" },
    { id: "in_progress", name: "In Progress", wipLimit: 3 },
    { id: "review", name: "Review", wipLimit: 2 },
    { id: "done", name: "Done", isTerminal: true },
  ],
  defaults: {
    column: "todo",
    agent: "user",
  },
};

export class KabanError extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message);
    this.name = "KabanError";
  }
}

export const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  NOT_FOUND: 2,
  CONFLICT: 3,
  VALIDATION: 4,
} as const;
