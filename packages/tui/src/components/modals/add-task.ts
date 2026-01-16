import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";
import { closeModal } from "./shared.js";

export function showAddTaskModal(state: AppState, onTaskCreated: () => Promise<void>): void {
  const { renderer, columns, currentColumnIndex } = state;
  const column = columns[currentColumnIndex];

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "add-task-dialog",
    width: 50,
    height: 9,
  });

  const title = new TextRenderable(renderer, {
    id: "dialog-title",
    content: `Add task to "${column.name}"`,
    fg: COLORS.accent,
  });

  const spacer1 = new BoxRenderable(renderer, { id: "dialog-spacer1", width: "100%", height: 1 });

  const input = new InputRenderable(renderer, {
    id: "task-title-input",
    width: 46,
    height: 1,
    placeholder: "Task title...",
    textColor: COLORS.text,
    placeholderColor: COLORS.textDim,
    backgroundColor: COLORS.bg,
    focusedBackgroundColor: COLORS.bg,
    cursorColor: COLORS.accent,
  });

  const spacer2 = new BoxRenderable(renderer, { id: "dialog-spacer2", width: "100%", height: 1 });

  const hint = new TextRenderable(renderer, {
    id: "dialog-hint",
    content: "[Enter] Create  [Esc] Cancel",
    fg: COLORS.textDim,
  });

  dialog.add(title);
  dialog.add(spacer1);
  dialog.add(input);
  dialog.add(spacer2);
  dialog.add(hint);
  renderer.root.add(overlay);

  input.focus();

  state.modalOverlay = overlay;
  state.taskInput = input;
  state.activeModal = "addTask";

  input.on(InputRenderableEvents.ENTER, async () => {
    const taskTitle = input.value.trim();
    if (taskTitle) {
      await state.taskService.addTask({ title: taskTitle, columnId: column.id });
    }
    closeModal(state);
    await onTaskCreated();
  });
}
