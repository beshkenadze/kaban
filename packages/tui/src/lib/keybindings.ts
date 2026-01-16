import { refreshBoard } from "../components/board.js";
import {
  closeModal,
  showAddTaskModal,
  showAssignTaskModal,
  showDeleteTaskModal,
  showHelpModal,
  showMoveTaskModal,
  showQuitModal,
} from "../components/modals/index.js";
import type { AppState, ModalType } from "./types.js";
import { getSelectedTaskId } from "./types.js";

type KeyHandler = (state: AppState) => void | Promise<void>;
type KeyBindings = Record<string, KeyHandler>;

const WILDCARD = "*";

const navigateLeft: KeyHandler = async (state) => {
  state.currentColumnIndex = Math.max(0, state.currentColumnIndex - 1);
  await refreshBoard(state);
};

const navigateRight: KeyHandler = async (state) => {
  state.currentColumnIndex = Math.min(state.columns.length - 1, state.currentColumnIndex + 1);
  await refreshBoard(state);
};

const quit: KeyHandler = (state) => {
  state.renderer.destroy();
  process.exit(0);
};

const openMoveModal: KeyHandler = async (state) => {
  const taskId = getSelectedTaskId(state);
  if (taskId) {
    await showMoveTaskModal(state, () => refreshBoard(state));
  }
};

const openAssignModal: KeyHandler = async (state) => {
  const taskId = getSelectedTaskId(state);
  if (taskId) {
    await showAssignTaskModal(state, () => refreshBoard(state));
  }
};

const openDeleteModal: KeyHandler = async (state) => {
  const taskId = getSelectedTaskId(state);
  if (taskId) {
    await showDeleteTaskModal(state, () => refreshBoard(state));
  }
};

const buttonSelectPrev: KeyHandler = (state) => {
  state.buttonRow?.selectPrev();
};

const buttonSelectNext: KeyHandler = (state) => {
  state.buttonRow?.selectNext();
};

const buttonTrigger: KeyHandler = (state) => {
  if (state.taskInput && state.taskInput.focused) return;
  state.buttonRow?.triggerSelected();
};

const focusButtons: KeyHandler = (state) => {
  state.taskInput?.blur();
  state.buttonRow?.render();
};

const modalBindings: Record<ModalType, KeyBindings> = {
  none: {
    q: showQuitModal,
    escape: showQuitModal,
    left: navigateLeft,
    h: navigateLeft,
    right: navigateRight,
    l: navigateRight,
    a: (state) => showAddTaskModal(state, () => refreshBoard(state)),
    m: openMoveModal,
    u: openAssignModal,
    d: openDeleteModal,
    "?": showHelpModal,
  },
  addTask: {
    escape: closeModal,
    left: buttonSelectPrev,
    right: buttonSelectNext,
    tab: focusButtons,
    down: focusButtons,
    return: buttonTrigger,
  },
  moveTask: {
    escape: closeModal,
  },
  assignTask: {
    escape: closeModal,
    left: buttonSelectPrev,
    right: buttonSelectNext,
    tab: focusButtons,
    down: focusButtons,
    return: buttonTrigger,
  },
  deleteTask: {},
  help: {
    [WILDCARD]: closeModal,
  },
  quit: {
    y: quit,
    n: closeModal,
    escape: closeModal,
  },
};

export function handleKeypress(
  state: AppState,
  key: { name: string; shift: boolean },
): void | Promise<void> {
  const bindings = modalBindings[state.activeModal];
  const handler = bindings[key.name] ?? bindings[WILDCARD];
  return handler?.(state);
}
