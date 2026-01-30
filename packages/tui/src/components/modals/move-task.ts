import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import { TRUNCATION } from "../../lib/constants.js";
import { withErrorHandling } from "../../lib/error.js";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { getSelectedTaskId } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";
import { closeModal } from "./shared.js";

export async function showMoveTaskModal(
  state: AppState,
  onMoved: () => Promise<void>,
): Promise<void> {
  const { renderer, columns } = state;

  const taskId = getSelectedTaskId(state);
  if (!taskId) {
    return;
  }

  const task = await state.taskService.getTask(taskId);
  if (!task) {
    return;
  }

  const otherColumns = columns.filter((c) => c.id !== task.columnId);
  if (otherColumns.length === 0) {
    return;
  }

  const selectHeight = Math.min(otherColumns.length, 6);
  const dialogHeight = selectHeight + 10;

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "move-task-dialog",
    width: 40,
    height: dialogHeight,
  });

  const titleRow = new BoxRenderable(renderer, {
    id: "move-title-row",
    width: "100%",
    height: 1,
  });
  const title = new TextRenderable(renderer, {
    id: "move-title",
    content: "Move Task",
    fg: COLORS.accent,
  });
  titleRow.add(title);

  const taskRow = new BoxRenderable(renderer, {
    id: "move-task-row",
    width: "100%",
    height: 1,
  });
  const taskText = new TextRenderable(renderer, {
    id: "move-task-text",
    content: task.title.slice(0, TRUNCATION.taskTitleShort),
    fg: COLORS.textMuted,
  });
  taskRow.add(taskText);

  const spacer1 = new BoxRenderable(renderer, { id: "move-spacer1", width: "100%", height: 1 });

  const labelRow = new BoxRenderable(renderer, {
    id: "move-label-row",
    width: "100%",
    height: 1,
  });
  const label = new TextRenderable(renderer, {
    id: "move-label",
    content: "Select column:",
    fg: COLORS.text,
  });
  labelRow.add(label);

  const columnSelect = new SelectRenderable(renderer, {
    id: "column-select",
    width: "100%",
    height: selectHeight,
    backgroundColor: COLORS.panel,
    textColor: COLORS.text,
    showDescription: false,
    options: otherColumns.map((col) => ({
      name: col.name,
      description: "",
      value: col.id,
    })),
    selectedBackgroundColor: COLORS.inputBg,
    selectedTextColor: COLORS.accentBright,
  });

  const spacer2 = new BoxRenderable(renderer, { id: "move-spacer2", width: "100%", height: 1 });

  const hintRow = new BoxRenderable(renderer, {
    id: "move-hint-row",
    width: "100%",
    height: 1,
  });
  const hint = new TextRenderable(renderer, {
    id: "move-hint",
    content: "[Enter] Move  [Esc] Cancel",
    fg: COLORS.textDim,
  });
  hintRow.add(hint);

  dialog.add(titleRow);
  dialog.add(taskRow);
  dialog.add(spacer1);
  dialog.add(labelRow);
  dialog.add(columnSelect);
  dialog.add(spacer2);
  dialog.add(hintRow);
  renderer.root.add(overlay);

  setImmediate(() => columnSelect.focus());

  state.modalOverlay = overlay;
  state.activeModal = "moveTask";

  columnSelect.on(SelectRenderableEvents.ITEM_SELECTED, async () => {
    const selected = columnSelect.getSelectedOption();
    if (selected?.value && typeof selected.value === "string") {
      const columnId = selected.value;
      const result = await withErrorHandling(
        state,
        () => state.taskService.moveTask(taskId, columnId),
        "Failed to move task",
      );
      closeModal(state);
      if (result) {
        await onMoved();
      }
    } else {
      closeModal(state);
    }
  });
}
