import { AuditService, type AuditEntry } from "@kaban-board/core/bun";
import { BoxRenderable, TextRenderable } from "@opentui/core";
import { COLORS } from "../../lib/theme.js";
import type { AppState } from "../../lib/types.js";
import { getSelectedTaskId } from "../../lib/types.js";
import { createSectionDivider, truncate } from "../../lib/utils.js";
import { createModalOverlay } from "../overlay.js";
import { blurCurrentColumnSelect } from "./shared.js";

const DIALOG_WIDTH = 65;
const MAX_ENTRIES = 15;

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEntry(entry: AuditEntry): string {
  const time = formatTimestamp(entry.timestamp);
  const actor = entry.actor ? `@${entry.actor}` : "";

  if (entry.eventType === "CREATE") {
    return `${time}  CREATED ${actor}`;
  }

  if (entry.eventType === "DELETE") {
    return `${time}  DELETED ${actor}`;
  }

  const field = entry.fieldName ?? "?";
  const oldVal = entry.oldValue === null ? "null" : truncate(entry.oldValue, 15);
  const newVal = entry.newValue === null ? "null" : truncate(entry.newValue, 15);
  return `${time}  ${field}: ${oldVal} -> ${newVal} ${actor}`;
}

export async function showTaskHistoryModal(state: AppState): Promise<void> {
  const { renderer, db, taskService } = state;

  const taskId = getSelectedTaskId(state);
  if (!taskId) return;

  const task = await taskService.getTask(taskId);
  if (!task) return;

  blurCurrentColumnSelect(state);

  const auditService = new AuditService(db);
  const entries = await auditService.getTaskHistory(task.id, MAX_ENTRIES);

  const dialogHeight = Math.min(entries.length + 8, 20);

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "history-dialog",
    width: DIALOG_WIDTH,
    height: dialogHeight,
  });

  const headerDivider = createSectionDivider(renderer, {
    label: "Task History",
    width: DIALOG_WIDTH - 4,
    id: "history-header",
  });

  const titleRow = new BoxRenderable(renderer, {
    id: "history-title-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
  });
  const taskTitle = new TextRenderable(renderer, {
    id: "history-task-title",
    content: `[${task.id.slice(0, 8)}] "${truncate(task.title, 40)}"`,
    fg: COLORS.accent,
  });
  titleRow.add(taskTitle);

  const spacer = new BoxRenderable(renderer, {
    id: "history-spacer",
    width: "100%",
    height: 1,
  });

  dialog.add(headerDivider);
  dialog.add(titleRow);
  dialog.add(spacer);

  if (entries.length === 0) {
    const emptyRow = new BoxRenderable(renderer, {
      id: "history-empty",
      width: "100%",
      height: 1,
    });
    const emptyText = new TextRenderable(renderer, {
      id: "history-empty-text",
      content: "  No history found",
      fg: COLORS.textMuted,
    });
    emptyRow.add(emptyText);
    dialog.add(emptyRow);
  } else {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const row = new BoxRenderable(renderer, {
        id: `history-entry-${i}`,
        width: "100%",
        height: 1,
      });

      let color = COLORS.textMuted;
      if (entry.eventType === "CREATE") color = COLORS.success;
      else if (entry.eventType === "DELETE") color = COLORS.danger;
      else color = COLORS.text;

      const text = new TextRenderable(renderer, {
        id: `history-entry-text-${i}`,
        content: `  ${formatEntry(entry)}`,
        fg: color,
      });
      row.add(text);
      dialog.add(row);
    }
  }

  const footerSpacer = new BoxRenderable(renderer, {
    id: "history-footer-spacer",
    width: "100%",
    height: 1,
  });

  const hintRow = new BoxRenderable(renderer, {
    id: "history-hint-row",
    width: "100%",
    height: 1,
    justifyContent: "center",
  });
  const hintText = new TextRenderable(renderer, {
    id: "history-hint-text",
    content: "[Esc] close",
    fg: COLORS.textDim,
  });
  hintRow.add(hintText);

  dialog.add(footerSpacer);
  dialog.add(hintRow);

  renderer.root.add(overlay);
  state.modalOverlay = overlay;
  state.activeModal = "taskHistory";
}
