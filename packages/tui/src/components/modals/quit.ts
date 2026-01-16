import { BoxRenderable, TextRenderable } from "@opentui/core";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";

export function showQuitModal(state: AppState): void {
  const { renderer } = state;

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "quit-dialog",
    width: 30,
    height: 7,
    borderColor: COLORS.danger,
    justifyContent: "center",
    alignItems: "center",
  });

  const title = new TextRenderable(renderer, {
    id: "quit-title",
    content: "Quit Kaban?",
    fg: COLORS.danger,
  });

  const spacer = new BoxRenderable(renderer, { id: "quit-spacer", width: "100%", height: 1 });

  const hint = new TextRenderable(renderer, {
    id: "quit-hint",
    content: "[y] Yes  [n/Esc] No",
    fg: COLORS.textMuted,
  });

  dialog.add(title);
  dialog.add(spacer);
  dialog.add(hint);
  renderer.root.add(overlay);

  state.modalOverlay = overlay;
  state.activeModal = "quit";
}
