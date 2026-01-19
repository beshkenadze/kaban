#!/usr/bin/env bun
import { BoardService, createDb, TaskService } from "@kaban-board/core";
import { createCliRenderer } from "@opentui/core";
import { refreshBoard } from "./components/board.js";
import { showOnboarding } from "./components/modals/index.js";
import { handleKeypress } from "./lib/keybindings.js";
import { findKabanRoot, getKabanPaths, initializeProject } from "./lib/project.js";
import type { AppState } from "./lib/types.js";

const POLL_INTERVAL_MS = 500;

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
    taskService,
    boardService,
    boardName: board.name,
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
  };

  await refreshBoard(state);

  // Poll for database changes (CLI modifications)
  let lastDataVersion: number | null = null;
  const client = (db as unknown as { $client: LibsqlClient }).$client;

  const checkForChanges = async () => {
    if (state.activeModal !== "none") return; // Don't refresh during modal

    try {
      const result = await client.execute("PRAGMA data_version");
      const currentVersion = result.rows[0]?.[0] as number;

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

  renderer.keyInput.on("keypress", (key: { name: string; shift: boolean }) => {
    handleKeypress(state, key);
  });
}

main().catch((err) => {
  console.error("TUI Error:", err);
  process.exit(1);
});
