import { BoxRenderable, TextRenderable } from "@opentui/core";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";

const SHORTCUTS = [
  ["<-/-> h/l", "Switch column"],
  ["up/dn j/k", "Navigate tasks"],
  ["a", "Add new task"],
  ["Enter", "Select task"],
  ["?", "Show/hide help"],
  ["q", "Quit"],
] as const;

export function showHelpModal(state: AppState): void {
  const { renderer } = state;

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "help-dialog",
    width: 45,
    height: 14,
    padding: 2,
  });

  const title = new TextRenderable(renderer, {
    id: "help-title",
    content: "Keyboard Shortcuts",
    fg: COLORS.accent,
  });

  const spacer = new BoxRenderable(renderer, { id: "help-spacer", width: "100%", height: 1 });

  dialog.add(title);
  dialog.add(spacer);

  for (const [key, desc] of SHORTCUTS) {
    const row = new BoxRenderable(renderer, {
      id: `help-row-${key}`,
      width: "100%",
      height: 1,
      flexDirection: "row",
    });
    const keyText = new TextRenderable(renderer, {
      id: `help-key-${key}`,
      content: key.padEnd(12),
      fg: COLORS.accent,
    });
    const descText = new TextRenderable(renderer, {
      id: `help-desc-${key}`,
      content: desc,
      fg: COLORS.text,
    });
    row.add(keyText);
    row.add(descText);
    dialog.add(row);
  }

  const hint = new TextRenderable(renderer, {
    id: "help-hint",
    content: "\n[Esc] or any key to close",
    fg: COLORS.textDim,
  });
  dialog.add(hint);

  renderer.root.add(overlay);

  state.modalOverlay = overlay;
  state.activeModal = "help";
}
