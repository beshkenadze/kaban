import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { boards, columns, type DB } from "../db/index.js";
import type { Board, Column, Config } from "../types.js";

export class BoardService {
  constructor(private db: DB) {}

  initializeBoard(config: Config): Board {
    const now = new Date();
    const boardId = ulid();

    this.db
      .insert(boards)
      .values({
        id: boardId,
        name: config.board.name,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    for (let i = 0; i < config.columns.length; i++) {
      const col = config.columns[i];
      this.db
        .insert(columns)
        .values({
          id: col.id,
          boardId,
          name: col.name,
          position: i,
          wipLimit: col.wipLimit ?? null,
          isTerminal: col.isTerminal ?? false,
        })
        .run();
    }

    return {
      id: boardId,
      name: config.board.name,
      createdAt: now,
      updatedAt: now,
    };
  }

  getBoard(): Board | null {
    const row = this.db.select().from(boards).limit(1).get();
    return row ?? null;
  }

  getColumns(): Column[] {
    return this.db.select().from(columns).orderBy(columns.position).all();
  }

  getColumn(id: string): Column | null {
    const row = this.db.select().from(columns).where(eq(columns.id, id)).get();
    return row ?? null;
  }

  getTerminalColumn(): Column | null {
    const row = this.db.select().from(columns).where(eq(columns.isTerminal, true)).get();
    return row ?? null;
  }

  getTaskCountInColumn(columnId: string): number {
    const result = this.db.select().from(columns).where(eq(columns.id, columnId)).get();
    return result ? 0 : 0;
  }
}
