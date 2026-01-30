#!/usr/bin/env bun
import { BoardService, createDb, TaskService } from "@kaban-board/core/bun";
import { createCliRenderer } from "@opentui/core";
import type { EventEmitter } from "events";
import { refreshBoard } from "./components/board.js";
import { showOnboarding } from "./components/modals/index.js";
import { handleKeypress } from "./lib/keybindings.js";
import { findKabanRoot, getKabanPaths, initializeProject } from "./lib/project.js";
import type { AppState } from "./lib/types.js";

const POLL_INTERVAL_MS = 500;

// Database client type detection helpers (supports bun:sqlite and libsql)
type BunSqliteClient = {
  query: (sql: string) => { get: () => Record<string, unknown> | null };
};
type LibsqlClient = {
  execute: (sql: string) => Promise<{ rows: unknown[][] }>;
};

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  let projectRoot = findKabanRoot(process.cwd());
  let db: Awaited<ReturnType<typeof createDb>>;
  let boardService: BoardService;
  let taskService: TaskService;

  if (!projectRoot) {
    const boardName = await showOnboarding(renderer);
    projectRoot = process.cwd();

    const result = await initializeProject(projectRoot, boardName);
    db = result.db;
    boardService = result.boardService;
    taskService = new TaskService(db, boardService);
  } else {
    const { dbPath } = getKabanPaths(projectRoot);
    db = await createDb(dbPath);
    boardService = new BoardService(db);
    taskService = new TaskService(db, boardService);
  }

  const board = await boardService.getBoard();
  if (!board) {
    console.error("Error: No board found.");
    renderer.destroy();
    process.exit(1);
  }

  const state: AppState = {
    renderer,
    db,
    taskService,
    boardService,
    boardName: board.name,
    projectRoot,
    columns: [],
    columnPanels: [],
    taskSelects: new Map(),
    currentColumnIndex: 0,
    selectedTask: null,
    mainContainer: null,
    activeModal: "none",
    modalOverlay: null,
    taskInput: null,
    buttonRow: null,
    onModalConfirm: null,
    viewTaskState: null,
    editTaskState: null,
    viewTaskRuntime: null,
    editTaskRuntime: null,
    archiveViewMode: false,
  };

  await refreshBoard(state);

  // Poll for database changes (CLI modifications)
  let lastDataVersion: number | null = null;
  const client = (db as unknown as { $client: unknown }).$client;

  // Detect client type once at startup
  const isBunSqlite = typeof (client as { query?: unknown }).query === "function";

  const checkForChanges = async () => {
    if (state.activeModal !== "none") return; // Don't refresh during modal

    try {
      let currentVersion: number;

      if (isBunSqlite) {
        // bun:sqlite: use .query().get()
        const bunClient = client as BunSqliteClient;
        const row = bunClient.query("PRAGMA data_version").get();
        currentVersion = (row?.data_version as number) ?? 0;
      } else {
        // libsql: use .execute()
        const libsqlClient = client as LibsqlClient;
        const result = await libsqlClient.execute("PRAGMA data_version");
        currentVersion = result.rows[0]?.[0] as number;
      }

      if (lastDataVersion !== null && currentVersion !== lastDataVersion) {
        await refreshBoard(state);
      }
      lastDataVersion = currentVersion;
    } catch {
      // DB might be locked momentarily, ignore
    }
  };

  const pollInterval = setInterval(checkForChanges, POLL_INTERVAL_MS);

  const cleanup = () => clearInterval(pollInterval);
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const keyEmitter = renderer.keyInput as unknown as EventEmitter;
  keyEmitter.on("keypress", (key: { name: string; shift: boolean }) => {
    handleKeypress(state, key);
  });
}

main().catch((err) => {
  console.error("TUI Error:", err);
  process.exit(1);
});
