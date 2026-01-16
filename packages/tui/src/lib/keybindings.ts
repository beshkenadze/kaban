import { refreshBoard } from "../components/board.js";
import {
  closeModal,
  showAddTaskModal,
  showHelpModal,
  showQuitModal,
} from "../components/modals/index.js";
import type { AppState, ModalType } from "./types.js";

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

const modalBindings: Record<ModalType, KeyBindings> = {
  none: {
    q: showQuitModal,
    escape: showQuitModal,
    left: navigateLeft,
    h: navigateLeft,
    right: navigateRight,
    l: navigateRight,
    a: (state) => showAddTaskModal(state, () => refreshBoard(state)),
    "?": showHelpModal,
  },
  addTask: {
    escape: closeModal,
  },
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
