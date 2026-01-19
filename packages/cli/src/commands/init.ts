import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import {
  BoardService,
  type Config,
  createDb,
  DEFAULT_CONFIG,
  initializeSchema,
} from "@kaban-board/core";
import { Command } from "commander";
import { getKabanPaths } from "../lib/context.js";

export const initCommand = new Command("init")
  .description("Initialize a new Kaban board in the current directory")
  .option("-n, --name <name>", "Board name", "Kaban Board")
  .action(async (options) => {
    const { kabanDir, dbPath, configPath } = getKabanPaths();

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

    const db = await createDb(dbPath);
    await initializeSchema(db);
    const boardService = new BoardService(db);
    await boardService.initializeBoard(config);

    console.log(`Initialized Kaban board: ${options.name}`);
    console.log(`  Database: ${dbPath}`);
    console.log(`  Config: ${configPath}`);
  });
