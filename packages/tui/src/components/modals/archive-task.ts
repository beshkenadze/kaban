import { BoxRenderable, TextRenderable } from "@opentui/core";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { getSelectedTaskId } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";
import { closeModal } from "./shared.js";

export async function showArchiveTaskModal(
  state: AppState,
  onArchived: () => Promise<void>,
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

  if (task.archived) {
    return;
  }

  state.selectedTask = task;

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "archive-task-dialog",
    width: 45,
    height: 10,
    borderColor: COLORS.warning,
  });

  const titleRow = new BoxRenderable(renderer, {
    id: "archive-title-row",
    width: "100%",
    height: 1,
    justifyContent: "center",
  });
  const title = new TextRenderable(renderer, {
    id: "archive-title",
    content: "Archive Task?",
    fg: COLORS.warning,
  });
  titleRow.add(title);

  const spacer1 = new BoxRenderable(renderer, { id: "archive-spacer1", width: "100%", height: 1 });

  const taskRow = new BoxRenderable(renderer, {
    id: "archive-task-row",
    width: "100%",
    height: 1,
  });
  const taskText = new TextRenderable(renderer, {
    id: "archive-task-text",
    content: task.title.slice(0, 40),
    fg: COLORS.text,
  });
  taskRow.add(taskText);

  const infoRow = new BoxRenderable(renderer, {
    id: "archive-info-row",
    width: "100%",
    height: 1,
  });
  const info = new TextRenderable(renderer, {
    id: "archive-info",
    content: "Task will be moved to archive.",
    fg: COLORS.textMuted,
  });
  infoRow.add(info);

  const spacer2 = new BoxRenderable(renderer, { id: "archive-spacer2", width: "100%", height: 2 });

  const hintRow = new BoxRenderable(renderer, {
    id: "archive-hint-row",
    width: "100%",
    height: 1,
    justifyContent: "center",
  });
  const hint = new TextRenderable(renderer, {
    id: "archive-hint",
    content: "[y] Archive  [n/Esc] Cancel",
    fg: COLORS.textMuted,
  });
  hintRow.add(hint);

  dialog.add(titleRow);
  dialog.add(spacer1);
  dialog.add(taskRow);
  dialog.add(infoRow);
  dialog.add(spacer2);
  dialog.add(hintRow);
  renderer.root.add(overlay);

  state.modalOverlay = overlay;
  state.activeModal = "archiveTask";
  state.onModalConfirm = async () => {
    await state.taskService.archiveTasks({ taskIds: [taskId] });
    closeModal(state);
    await onArchived();
  };
}
