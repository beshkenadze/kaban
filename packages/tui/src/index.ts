#!/usr/bin/env bun
import { BoardService, createDb, TaskService } from "@kaban-board/core/bun";
import { createCliRenderer } from "@opentui/core";
import { refreshBoard } from "./components/board.js";
import { showOnboarding } from "./components/modals/index.js";
import { getDataVersion, getDbClient, getKeyInput } from "./lib/db-client.js";
import { handleKeypress } from "./lib/keybindings.js";
import { findKabanRoot, getKabanPaths, initializeProject } from "./lib/project.js";
import type { AppState } from "./lib/types.js";

const POLL_INTERVAL_MS = 500;

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
  const client = getDbClient(db);

  const checkForChanges = async () => {
    if (state.activeModal !== "none") return;

    try {
      const currentVersion = await getDataVersion(client);

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

  getKeyInput(renderer).on("keypress", (key) => {
    handleKeypress(state, key);
  });
}

main().catch((err) => {
  console.error("TUI Error:", err);
  process.exit(1);
});
