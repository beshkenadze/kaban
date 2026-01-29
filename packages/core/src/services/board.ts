import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { boards, columns } from "../db/schema.js";
import type { DB } from "../db/types.js";
import type { Board, Column, Config } from "../types.js";

export class BoardService {
  constructor(private db: DB) {}

  async initializeBoard(config: Config): Promise<Board> {
    const now = new Date();
    const boardId = ulid();

    await this.db.insert(boards).values({
      id: boardId,
      name: config.board.name,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < config.columns.length; i++) {
      const col = config.columns[i];
      await this.db.insert(columns).values({
        id: col.id,
        boardId,
        name: col.name,
        position: i,
        wipLimit: col.wipLimit ?? null,
        isTerminal: col.isTerminal ?? false,
      });
    }

    return {
      id: boardId,
      name: config.board.name,
      maxBoardTaskId: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getBoard(): Promise<Board | null> {
    const rows = await this.db.select().from(boards).limit(1);
    return rows[0] ?? null;
  }

  async getColumns(): Promise<Column[]> {
    return this.db.select().from(columns).orderBy(columns.position);
  }

  async getColumn(id: string): Promise<Column | null> {
    const rows = await this.db.select().from(columns).where(eq(columns.id, id));
    return rows[0] ?? null;
  }

  async getTerminalColumn(): Promise<Column | null> {
    const rows = await this.db.select().from(columns).where(eq(columns.isTerminal, true));
    return rows[0] ?? null;
  }

  async getTerminalColumns(): Promise<Column[]> {
    return this.db
      .select()
      .from(columns)
      .where(eq(columns.isTerminal, true))
      .orderBy(columns.position);
  }
}
