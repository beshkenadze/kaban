import {
  BoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import { createButtonRow } from "../../lib/button-row.js";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { createModalOverlay } from "../overlay.js";
import { closeModal } from "./shared.js";

export function showAddTaskModal(state: AppState, onTaskCreated: () => Promise<void>): void {
  const { renderer, columns, currentColumnIndex } = state;
  const column = columns[currentColumnIndex];

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "add-task-dialog",
    width: 52,
    height: 11,
  });

  const titleRow = new BoxRenderable(renderer, {
    id: "title-row",
    width: "100%",
    height: 1,
  });
  const title = new TextRenderable(renderer, {
    id: "dialog-title",
    content: `Add task to "${column.name}"`,
    fg: COLORS.accent,
  });
  titleRow.add(title);

  const spacer1 = new BoxRenderable(renderer, { id: "dialog-spacer1", width: "100%", height: 1 });

  const labelRow = new BoxRenderable(renderer, {
    id: "label-row",
    width: "100%",
    height: 1,
  });
  const label = new TextRenderable(renderer, {
    id: "dialog-label",
    content: "Task title:",
    fg: COLORS.text,
  });
  labelRow.add(label);

  const input = new InputRenderable(renderer, {
    id: "task-title-input",
    width: 46,
    height: 1,
    placeholder: "Enter task title...",
    textColor: COLORS.text,
    placeholderColor: COLORS.textDim,
    backgroundColor: COLORS.inputBg,
    focusedBackgroundColor: COLORS.inputBg,
    cursorColor: COLORS.cursor,
  });

  const spacer2 = new BoxRenderable(renderer, { id: "dialog-spacer2", width: "100%", height: 1 });

  const doCreate = async () => {
    const taskTitle = input.value.trim();
    if (taskTitle) {
      await state.taskService.addTask({ title: taskTitle, columnId: column.id });
    }
    closeModal(state);
    await onTaskCreated();
  };

  const doCancel = () => {
    closeModal(state);
  };

  const buttonRow = createButtonRow(renderer, "add-task", [
    { label: "Create", action: doCreate, color: COLORS.success },
    { label: "Cancel", action: doCancel },
  ]);

  dialog.add(titleRow);
  dialog.add(spacer1);
  dialog.add(labelRow);
  dialog.add(input);
  dialog.add(spacer2);
  dialog.add(buttonRow.container);
  renderer.root.add(overlay);

  setImmediate(() => input.focus());

  state.modalOverlay = overlay;
  state.taskInput = input;
  state.buttonRow = buttonRow;
  state.activeModal = "addTask";

  input.on(InputRenderableEvents.ENTER, doCreate);
}
