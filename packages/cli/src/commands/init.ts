import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BoardService, type Config, createDb, DEFAULT_CONFIG, initializeSchema } from "@kaban/core";
import { Command } from "commander";

export const initCommand = new Command("init")
  .description("Initialize a new Kaban board in the current directory")
  .option("-n, --name <name>", "Board name", "Kaban Board")
  .action((options) => {
    const kabanDir = join(process.cwd(), ".kaban");
    const dbPath = join(kabanDir, "board.db");
    const configPath = join(kabanDir, "config.json");

    if (existsSync(dbPath)) {
      console.error("Error: Board already exists in this directory");
      process.exit(1);
    }

    mkdirSync(kabanDir, { recursive: true });

    const config: Config = {
      ...DEFAULT_CONFIG,
      board: { name: options.name },
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const db = createDb(dbPath);
    initializeSchema(db);
    const boardService = new BoardService(db);
    boardService.initializeBoard(config);

    console.log(`Initialized Kaban board: ${options.name}`);
    console.log(`  Database: ${dbPath}`);
    console.log(`  Config: ${configPath}`);
  });
