#!/usr/bin/env bun
import { BoardService, createDb, TaskService } from "@kaban/core";
import { createCliRenderer } from "@opentui/core";
import { refreshBoard } from "./components/board.js";
import { showOnboarding } from "./components/modals/index.js";
import { handleKeypress } from "./lib/keybindings.js";
import { findKabanRoot, getKabanPaths, initializeProject } from "./lib/project.js";
import type { AppState } from "./lib/types.js";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
  });

  let projectRoot = findKabanRoot(process.cwd());
  let db: ReturnType<typeof createDb>;
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
    db = createDb(`file:${dbPath}`);
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
    currentColumnIndex: 0,
    mainContainer: null,
    activeModal: "none",
    modalOverlay: null,
    taskInput: null,
  };

  await refreshBoard(state);

  renderer.keyInput.on("keypress", (key: { name: string; shift: boolean }) => {
    handleKeypress(state, key);
  });
}

main().catch((err) => {
  console.error("TUI Error:", err);
  process.exit(1);
});
