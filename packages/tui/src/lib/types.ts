import type { BoardService, Task, TaskService } from "@kaban-board/core/bun";
import type {
  BoxRenderable,
  CliRenderer,
  InputRenderable,
  SelectRenderable,
  TextRenderable,
} from "@opentui/core";
import type { ButtonRowState } from "./button-row.js";

export type ModalType =
  | "none"
  | "addTask"
  | "moveTask"
  | "assignTask"
  | "deleteTask"
  | "archiveTask"
  | "restoreTask"
  | "viewTask"
  | "editTask"
  | "help"
  | "quit";

export interface ViewTaskState {
  descriptionScrollOffset: number;
  showCopiedFeedback: boolean;
}

export interface EditTaskState {
  title: string;
  description: string;
  focusedField: "title" | "description" | "buttons";
}

export interface ViewTaskActions {
  onMove: () => Promise<void>;
  onAssign: () => Promise<void>;
  onDelete: () => Promise<void>;
  onEdit: () => Promise<void>;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
}

export interface ViewTaskRuntime {
  updateDescriptionContent: (offset: number) => void;
  totalDescLines: number;
  actions: ViewTaskActions;
  idValue: TextRenderable;
  copyHint: TextRenderable;
  taskId: string;
  copyTimeoutId: ReturnType<typeof setTimeout> | null;
}

export interface EditTaskRuntime {
  titleInput: InputRenderable;
  descInput: InputRenderable;
  doSave: () => Promise<void>;
  doCancel: () => void;
}

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
  onModalConfirm: (() => void | Promise<void>) | null;
  viewTaskState: ViewTaskState | null;
  editTaskState: EditTaskState | null;
  viewTaskRuntime: ViewTaskRuntime | null;
  editTaskRuntime: EditTaskRuntime | null;
  archiveViewMode: boolean;
}

export function getSelectedTaskId(state: AppState): string | null {
  const column = state.columns[state.currentColumnIndex];
  if (!column) return null;

  const select = state.taskSelects.get(column.id);
  if (!select) return null;

  const selected = select.getSelectedOption();
  const value = selected?.value;
  return typeof value === "string" ? value : null;
}
