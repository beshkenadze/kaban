import type { BoardService, TaskService } from "@kaban/core";
import type { BoxRenderable, CliRenderer, InputRenderable } from "@opentui/core";

export type ModalType = "none" | "addTask" | "help" | "quit";

export interface AppState {
  renderer: CliRenderer;
  taskService: TaskService;
  boardService: BoardService;
  boardName: string;
  columns: { id: string; name: string }[];
  columnPanels: BoxRenderable[];
  currentColumnIndex: number;
  mainContainer: BoxRenderable | null;
  activeModal: ModalType;
  modalOverlay: BoxRenderable | null;
  taskInput: InputRenderable | null;
}
