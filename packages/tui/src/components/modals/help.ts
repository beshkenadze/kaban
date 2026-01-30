import { BoxRenderable, TextRenderable } from "@opentui/core";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";

const SHORTCUTS = [
  ["<-/-> h/l", "Switch column"],
  ["up/dn j/k", "Navigate tasks"],
  ["Enter", "View task details"],
  ["a", "Add new task"],
  ["m", "Move task (change status)"],
  ["u", "Assign user to task"],
  ["d", "Delete task"],
  ["C", "Complete task (move to done)"],
  ["H", "View task history"],
  ["x", "Archive task"],
  ["r", "Restore task (archive view)"],
  ["/", "Search archive (archive view)"],
  ["P", "Purge archive (archive view)"],
  ["Tab", "Toggle archive view"],
  ["?", "Show/hide help"],
  ["q", "Quit"],
] as const;

export function showHelpModal(state: AppState): void {
  const { renderer } = state;

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "help-dialog",
    width: 45,
    height: 24,
    padding: 2,
  });

  const titleRow = new BoxRenderable(renderer, {
    id: "help-title-row",
    width: "100%",
    height: 1,
  });
  const title = new TextRenderable(renderer, {
    id: "help-title",
    content: "Keyboard Shortcuts",
    fg: COLORS.accent,
  });
  titleRow.add(title);

  const spacer = new BoxRenderable(renderer, { id: "help-spacer", width: "100%", height: 1 });

  dialog.add(titleRow);
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
      fg: COLORS.accentBright,
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

  const hintSpacer = new BoxRenderable(renderer, {
    id: "help-hint-spacer",
    width: "100%",
    height: 1,
  });
  const hintRow = new BoxRenderable(renderer, {
    id: "help-hint-row",
    width: "100%",
    height: 1,
  });
  const hint = new TextRenderable(renderer, {
    id: "help-hint",
    content: "[Esc] or any key to close",
    fg: COLORS.textDim,
  });
  hintRow.add(hint);
  dialog.add(hintSpacer);
  dialog.add(hintRow);

  renderer.root.add(overlay);

  state.modalOverlay = overlay;
  state.activeModal = "help";
}
