import { BoxRenderable, TextRenderable } from "@opentui/core";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { getSelectedTaskId } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";
import { closeModal } from "./shared.js";

export async function showDeleteTaskModal(
  state: AppState,
  onDeleted: () => Promise<void>,
): Promise<void> {
  const { renderer } = state;

  const taskId = getSelectedTaskId(state);
  if (!taskId) {
    return;
  }

  const task = await state.taskService.getTask(taskId);
  if (!task) {
    return;
  }

  state.selectedTask = task;

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "delete-task-dialog",
    width: 45,
    height: 10,
    borderColor: COLORS.danger,
  });

  const titleRow = new BoxRenderable(renderer, {
    id: "delete-title-row",
    width: "100%",
    height: 1,
    justifyContent: "center",
  });
  const title = new TextRenderable(renderer, {
    id: "delete-title",
    content: "Delete Task?",
    fg: COLORS.danger,
  });
  titleRow.add(title);

  const spacer1 = new BoxRenderable(renderer, { id: "delete-spacer1", width: "100%", height: 1 });

  const taskRow = new BoxRenderable(renderer, {
    id: "delete-task-row",
    width: "100%",
    height: 1,
  });
  const taskText = new TextRenderable(renderer, {
    id: "delete-task-text",
    content: task.title.slice(0, 40),
    fg: COLORS.text,
  });
  taskRow.add(taskText);

  const warningRow = new BoxRenderable(renderer, {
    id: "delete-warning-row",
    width: "100%",
    height: 1,
  });
  const warning = new TextRenderable(renderer, {
    id: "delete-warning",
    content: "This action cannot be undone.",
    fg: COLORS.warning,
  });
  warningRow.add(warning);

  const spacer2 = new BoxRenderable(renderer, { id: "delete-spacer2", width: "100%", height: 2 });

  const hintRow = new BoxRenderable(renderer, {
    id: "delete-hint-row",
    width: "100%",
    height: 1,
    justifyContent: "center",
  });
  const hint = new TextRenderable(renderer, {
    id: "delete-hint",
    content: "[y] Delete  [n/Esc] Cancel",
    fg: COLORS.textMuted,
  });
  hintRow.add(hint);

  dialog.add(titleRow);
  dialog.add(spacer1);
  dialog.add(taskRow);
  dialog.add(warningRow);
  dialog.add(spacer2);
  dialog.add(hintRow);
  renderer.root.add(overlay);

  state.modalOverlay = overlay;
  state.activeModal = "deleteTask";

  const keyHandler = async (key: { name: string }) => {
    if (key.name === "y") {
      renderer.keyInput.off("keypress", keyHandler);
      await state.taskService.deleteTask(taskId);
      state.selectedTask = null;
      closeModal(state);
      await onDeleted();
    } else if (key.name === "n" || key.name === "escape") {
      renderer.keyInput.off("keypress", keyHandler);
      state.selectedTask = null;
      closeModal(state);
    }
  };

  renderer.keyInput.on("keypress", keyHandler);
}
