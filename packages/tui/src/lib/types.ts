import type { BoardService, Task, TaskService } from "@kaban/core";
import type { BoxRenderable, CliRenderer, InputRenderable, SelectRenderable } from "@opentui/core";
import type { ButtonRowState } from "./button-row.js";

export type ModalType =
  | "none"
  | "addTask"
  | "moveTask"
  | "assignTask"
  | "deleteTask"
  | "help"
  | "quit";

export interface AppState {
  renderer: CliRenderer;
  taskService: TaskService;
  boardService: BoardService;
  boardName: string;
  columns: { id: string; name: string }[];
  columnPanels: BoxRenderable[];
  taskSelects: Map<string, SelectRenderable>;
  currentColumnIndex: number;
  selectedTask: Task | null;
  mainContainer: BoxRenderable | null;
  activeModal: ModalType;
  modalOverlay: BoxRenderable | null;
  taskInput: InputRenderable | null;
  buttonRow: ButtonRowState | null;
}

export function getSelectedTaskId(state: AppState): string | null {
  const column = state.columns[state.currentColumnIndex];
  if (!column) return null;

  const select = state.taskSelects.get(column.id);
  if (!select) return null;

  const selected = select.getSelectedOption();
  return (selected?.value as string) ?? null;
}
