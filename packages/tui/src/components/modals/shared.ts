import type { AppState } from "../../lib/types.js";

export function closeModal(state: AppState): void {
  if (state.modalOverlay) {
    state.modalOverlay.destroy();
    state.modalOverlay = null;
  }
  state.taskInput = null;
  state.activeModal = "none";
}
