import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BoardService,
  type Config,
  createDb,
  DEFAULT_CONFIG,
  initializeSchema,
} from "@kaban-board/core";

export function findKabanRoot(startDir: string): string | null {
  let dir = startDir;
  while (dir !== "/") {
    if (existsSync(resolve(dir, ".kaban"))) {
      return dir;
    }
    dir = resolve(dir, "..");
  }
  return null;
}

export function getKabanPaths(root: string) {
  const kabanDir = resolve(root, ".kaban");
  return {
    kabanDir,
    dbPath: resolve(kabanDir, "board.db"),
    configPath: resolve(kabanDir, "config.json"),
  };
}

export async function initializeProject(
  root: string,
  boardName: string,
): Promise<{ db: Awaited<ReturnType<typeof createDb>>; boardService: BoardService }> {
  const { kabanDir, dbPath, configPath } = getKabanPaths(root);
  mkdirSync(kabanDir, { recursive: true });

  const config: Config = {
    ...DEFAULT_CONFIG,
    board: { name: boardName },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const db = await createDb(dbPath);
  await initializeSchema(db);
  const boardService = new BoardService(db);
  await boardService.initializeBoard(config);

  return { db, boardService };
}
