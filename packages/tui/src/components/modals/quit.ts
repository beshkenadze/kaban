import { BoxRenderable, TextRenderable } from "@opentui/core";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";

export function showQuitModal(state: AppState): void {
  const { renderer } = state;

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "quit-dialog",
    width: 32,
    height: 8,
    borderColor: COLORS.danger,
  });

  const titleRow = new BoxRenderable(renderer, {
    id: "quit-title-row",
    width: "100%",
    height: 1,
    justifyContent: "center",
  });
  const title = new TextRenderable(renderer, {
    id: "quit-title",
    content: "Quit Kaban?",
    fg: COLORS.danger,
  });
  titleRow.add(title);

  const spacer = new BoxRenderable(renderer, { id: "quit-spacer", width: "100%", height: 2 });

  const hintRow = new BoxRenderable(renderer, {
    id: "quit-hint-row",
    width: "100%",
    height: 1,
    justifyContent: "center",
  });
  const hint = new TextRenderable(renderer, {
    id: "quit-hint",
    content: "[y] Yes  [n/Esc] No",
    fg: COLORS.textMuted,
  });
  hintRow.add(hint);

  dialog.add(titleRow);
  dialog.add(spacer);
  dialog.add(hintRow);
  renderer.root.add(overlay);

  state.modalOverlay = overlay;
  state.activeModal = "quit";
}
