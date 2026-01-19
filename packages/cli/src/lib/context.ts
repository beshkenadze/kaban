import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BoardService, type Config, createDb, type DB, TaskService } from "@kaban-board/core";

export interface KabanContext {
  db: DB;
  config: Config;
  boardService: BoardService;
  taskService: TaskService;
}

export async function getContext(): Promise<KabanContext> {
  const kabanDir = join(process.cwd(), ".kaban");
  const dbPath = join(kabanDir, "board.db");
  const configPath = join(kabanDir, "config.json");

  if (!existsSync(dbPath)) {
    console.error("Error: No board found. Run 'kaban init' first");
    process.exit(1);
  }

  const db = await createDb(dbPath);
  const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));
  const boardService = new BoardService(db);
  const taskService = new TaskService(db, boardService);

  return { db, config, boardService, taskService };
}

export function getKabanPaths() {
  const kabanDir = join(process.cwd(), ".kaban");
  return {
    kabanDir,
    dbPath: join(kabanDir, "board.db"),
    configPath: join(kabanDir, "config.json"),
  };
}

export function getAgent(): string {
  return process.env.KABAN_AGENT ?? "user";
}
