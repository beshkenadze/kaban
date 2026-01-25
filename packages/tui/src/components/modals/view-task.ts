import { BoxRenderable, TextRenderable } from "@opentui/core";
import { COLORS, getStatusColor } from "../../lib/theme.js";
import type { AppState, ViewTaskActions } from "../../lib/types.js";
import { getSelectedTaskId } from "../../lib/types.js";
import {
  createSectionDivider,
  formatRelativeTime,
  truncate,
  truncateMiddle,
} from "../../lib/utils.js";
import { createModalOverlay } from "../overlay.js";
import { blurCurrentColumnSelect } from "./shared.js";

const DIALOG_WIDTH = 60;
const DESC_VISIBLE_LINES = 4;
const LABEL_WIDTH = 12;

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function padLabel(label: string): string {
  return label.padEnd(LABEL_WIDTH);
}

export type { ViewTaskActions };

export async function showViewTaskModal(
  state: AppState,
  actions: ViewTaskActions,
  taskIdOverride?: string,
): Promise<void> {
  const { renderer, columns } = state;

  const taskId = taskIdOverride ?? getSelectedTaskId(state);
  if (!taskId) {
    return;
  }

  const task = await state.taskService.getTask(taskId);
  if (!task) {
    return;
  }

  blurCurrentColumnSelect(state);

  const column = columns.find((c) => c.id === task.columnId);
  const columnName = column?.name ?? task.columnId;
  const statusColor = getStatusColor(task.columnId);

  const hasDescription = task.description && task.description.trim().length > 0;
  const allDescLines = hasDescription ? (task.description?.split("\n") ?? []) : [];
  const totalDescLines = allDescLines.length;

  state.viewTaskState = {
    descriptionScrollOffset: 0,
    showCopiedFeedback: false,
  };

  const dialogHeight = 24;

  const { overlay, dialog } = createModalOverlay(renderer, {
    id: "view-task-dialog",
    width: DIALOG_WIDTH,
    height: dialogHeight,
  });

  const headerDivider = createSectionDivider(renderer, {
    label: "Task Details",
    width: DIALOG_WIDTH - 4,
    id: "view-header",
  });

  const spacerHeader = new BoxRenderable(renderer, {
    id: "view-spacer-header",
    width: "100%",
    height: 1,
  });

  const titleRow = new BoxRenderable(renderer, {
    id: "view-title-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  });
  const taskTitle = new TextRenderable(renderer, {
    id: "view-task-title",
    content: truncate(task.title, DIALOG_WIDTH - 14),
    fg: COLORS.text,
  });
  const editHint = new TextRenderable(renderer, {
    id: "view-edit-hint",
    content: "[e]dit",
    fg: COLORS.textDim,
  });
  titleRow.add(taskTitle);
  titleRow.add(editHint);

  const idRow = new BoxRenderable(renderer, {
    id: "view-id-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  });
  const idValue = new TextRenderable(renderer, {
    id: "view-id-value",
    content: truncateMiddle(task.id, DIALOG_WIDTH - 14),
    fg: COLORS.textDim,
  });
  const copyHint = new TextRenderable(renderer, {
    id: "view-copy-hint",
    content: "[c]opy",
    fg: COLORS.textDim,
  });
  idRow.add(idValue);
  idRow.add(copyHint);

  const statusDivider = createSectionDivider(renderer, {
    label: "Status",
    width: DIALOG_WIDTH - 4,
    id: "view-status",
  });

  const columnRow = new BoxRenderable(renderer, {
    id: "view-column-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
  });
  const columnLabel = new TextRenderable(renderer, {
    id: "view-column-label",
    content: padLabel("Column"),
    fg: COLORS.textMuted,
  });
  const columnBullet = new TextRenderable(renderer, {
    id: "view-column-bullet",
    content: "● ",
    fg: statusColor,
  });
  const columnValue = new TextRenderable(renderer, {
    id: "view-column-value",
    content: columnName,
    fg: COLORS.text,
  });
  columnRow.add(columnLabel);
  columnRow.add(columnBullet);
  columnRow.add(columnValue);

  const assigneeRow = new BoxRenderable(renderer, {
    id: "view-assignee-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
  });
  const assigneeLabel = new TextRenderable(renderer, {
    id: "view-assignee-label",
    content: padLabel("Assignee"),
    fg: COLORS.textMuted,
  });
  const assigneeValue = new TextRenderable(renderer, {
    id: "view-assignee-value",
    content: task.assignedTo ?? "— unassigned",
    fg: task.assignedTo ? COLORS.success : COLORS.textDim,
  });
  assigneeRow.add(assigneeLabel);
  assigneeRow.add(assigneeValue);

  const creatorRow = new BoxRenderable(renderer, {
    id: "view-creator-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
  });
  const creatorLabel = new TextRenderable(renderer, {
    id: "view-creator-label",
    content: padLabel("Creator"),
    fg: COLORS.textMuted,
  });
  const creatorValue = new TextRenderable(renderer, {
    id: "view-creator-value",
    content: task.createdBy,
    fg: COLORS.text,
  });
  creatorRow.add(creatorLabel);
  creatorRow.add(creatorValue);

  const labelsRow = new BoxRenderable(renderer, {
    id: "view-labels-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
  });
  const labelsLabel = new TextRenderable(renderer, {
    id: "view-labels-label",
    content: padLabel("Labels"),
    fg: COLORS.textMuted,
  });
  const labelsValue = new TextRenderable(renderer, {
    id: "view-labels-value",
    content: "— none",
    fg: COLORS.textDim,
  });
  labelsRow.add(labelsLabel);
  labelsRow.add(labelsValue);

  const timelineDivider = createSectionDivider(renderer, {
    label: "Timeline",
    width: DIALOG_WIDTH - 4,
    id: "view-timeline",
  });

  const createdRow = new BoxRenderable(renderer, {
    id: "view-created-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
  });
  const createdLabel = new TextRenderable(renderer, {
    id: "view-created-label",
    content: padLabel("Created"),
    fg: COLORS.textMuted,
  });
  const createdValue = new TextRenderable(renderer, {
    id: "view-created-value",
    content: formatDate(task.createdAt),
    fg: COLORS.textDim,
  });
  createdRow.add(createdLabel);
  createdRow.add(createdValue);

  const updatedRow = new BoxRenderable(renderer, {
    id: "view-updated-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  });
  const updatedLeft = new BoxRenderable(renderer, {
    id: "view-updated-left",
    height: 1,
    flexDirection: "row",
  });
  const updatedLabel = new TextRenderable(renderer, {
    id: "view-updated-label",
    content: padLabel("Updated"),
    fg: COLORS.textMuted,
  });
  const updatedValue = new TextRenderable(renderer, {
    id: "view-updated-value",
    content: formatDate(task.updatedAt),
    fg: COLORS.textDim,
  });
  updatedLeft.add(updatedLabel);
  updatedLeft.add(updatedValue);

  const relativeTime = new TextRenderable(renderer, {
    id: "view-relative-time",
    content: `(${formatRelativeTime(task.updatedAt)})`,
    fg: COLORS.textDim,
  });
  updatedRow.add(updatedLeft);
  updatedRow.add(relativeTime);

  const descDivider = createSectionDivider(renderer, {
    label: "Description",
    width: DIALOG_WIDTH - 4,
    id: "view-desc",
  });

  const descContainer = new BoxRenderable(renderer, {
    id: "view-desc-container",
    width: "100%",
    height: DESC_VISIBLE_LINES,
    flexDirection: "column",
  });

  const descLineRenderables: TextRenderable[] = [];

  for (let i = 0; i < DESC_VISIBLE_LINES; i++) {
    const line = new TextRenderable(renderer, {
      id: `view-desc-line-${i}`,
      content: " ",
      fg: COLORS.text,
    });
    descLineRenderables.push(line);
    descContainer.add(line);
  }

  function updateDescriptionContent(scrollOffset: number): void {
    if (!hasDescription) {
      descLineRenderables[0].content = "— no description";
      descLineRenderables[0].fg = COLORS.textDim;
      for (let i = 1; i < DESC_VISIBLE_LINES; i++) {
        descLineRenderables[i].content = " ";
      }
      return;
    }

    const visibleLines = allDescLines.slice(scrollOffset, scrollOffset + DESC_VISIBLE_LINES);
    const hasMore = scrollOffset + DESC_VISIBLE_LINES < totalDescLines;
    const hasLess = scrollOffset > 0;

    for (let i = 0; i < DESC_VISIBLE_LINES; i++) {
      const lineContent = visibleLines[i] ?? "";
      const isLastLine = i === DESC_VISIBLE_LINES - 1;

      let displayContent = truncate(lineContent, DIALOG_WIDTH - 12);

      if (isLastLine && hasMore) {
        const remaining = totalDescLines - scrollOffset - DESC_VISIBLE_LINES;
        displayContent = `${truncate(lineContent, DIALOG_WIDTH - 18)} ▼ ${remaining}+`;
      }
      if (i === 0 && hasLess) {
        displayContent = `▲ ${scrollOffset}+ ${truncate(lineContent, DIALOG_WIDTH - 18)}`;
      }

      descLineRenderables[i].content = displayContent || " ";
      descLineRenderables[i].fg =
        (i === 0 && hasLess) || (isLastLine && hasMore) ? COLORS.textDim : COLORS.text;
    }
  }

  updateDescriptionContent(0);

  const footerDivider = new BoxRenderable(renderer, {
    id: "view-footer-divider",
    width: "100%",
    height: 1,
  });
  const footerLine = new TextRenderable(renderer, {
    id: "view-footer-line",
    content: "─".repeat(DIALOG_WIDTH - 4),
    fg: COLORS.border,
  });
  footerDivider.add(footerLine);

  const actionsRow = new BoxRenderable(renderer, {
    id: "view-actions-row",
    width: "100%",
    height: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  });

  const actionsLeft = new BoxRenderable(renderer, {
    id: "view-actions-left",
    height: 1,
    flexDirection: "row",
    gap: 2,
  });

  const moveAction = new TextRenderable(renderer, {
    id: "view-action-move",
    content: "[m] Move",
    fg: COLORS.textMuted,
  });
  const assignAction = new TextRenderable(renderer, {
    id: "view-action-assign",
    content: "[u] Assign",
    fg: COLORS.textMuted,
  });
  const editAction = new TextRenderable(renderer, {
    id: "view-action-edit",
    content: "[e] Edit",
    fg: COLORS.textMuted,
  });
  const deleteAction = new TextRenderable(renderer, {
    id: "view-action-delete",
    content: "[d] Delete",
    fg: COLORS.danger,
  });
  const archiveRestoreAction = new TextRenderable(renderer, {
    id: "view-action-archive-restore",
    content: task.archived ? "[r] Restore" : "[x] Archive",
    fg: task.archived ? COLORS.success : COLORS.warning,
  });

  actionsLeft.add(moveAction);
  actionsLeft.add(assignAction);
  actionsLeft.add(editAction);
  actionsLeft.add(archiveRestoreAction);
  actionsLeft.add(deleteAction);

  const escAction = new TextRenderable(renderer, {
    id: "view-action-esc",
    content: "[Esc]",
    fg: COLORS.textDim,
  });

  actionsRow.add(actionsLeft);
  actionsRow.add(escAction);

  dialog.add(headerDivider);
  dialog.add(spacerHeader);
  dialog.add(titleRow);
  dialog.add(idRow);
  dialog.add(statusDivider);
  dialog.add(columnRow);
  dialog.add(assigneeRow);
  dialog.add(creatorRow);
  dialog.add(labelsRow);
  dialog.add(timelineDivider);
  dialog.add(createdRow);
  dialog.add(updatedRow);
  dialog.add(descDivider);
  dialog.add(descContainer);
  dialog.add(footerDivider);
  dialog.add(actionsRow);

  renderer.root.add(overlay);

  state.modalOverlay = overlay;
  state.activeModal = "viewTask";
  state.selectedTask = task;

  state.viewTaskRuntime = {
    updateDescriptionContent,
    totalDescLines,
    actions,
    idValue,
    copyHint,
    taskId: task.id,
    copyTimeoutId: null,
  };
}

export function scrollViewTaskDescription(state: AppState, direction: "up" | "down"): void {
  if (!state.viewTaskState || !state.viewTaskRuntime) return;

  const { totalDescLines, updateDescriptionContent } = state.viewTaskRuntime;
  const maxOffset = Math.max(0, totalDescLines - DESC_VISIBLE_LINES);

  if (direction === "down") {
    state.viewTaskState.descriptionScrollOffset = Math.min(
      state.viewTaskState.descriptionScrollOffset + 1,
      maxOffset,
    );
  } else {
    state.viewTaskState.descriptionScrollOffset = Math.max(
      state.viewTaskState.descriptionScrollOffset - 1,
      0,
    );
  }

  updateDescriptionContent(state.viewTaskState.descriptionScrollOffset);
}

export async function copyTaskId(state: AppState): Promise<void> {
  if (!state.viewTaskState || !state.viewTaskRuntime) return;

  const { taskId, idValue, copyHint } = state.viewTaskRuntime;

  if (state.viewTaskRuntime.copyTimeoutId) {
    clearTimeout(state.viewTaskRuntime.copyTimeoutId);
    state.viewTaskRuntime.copyTimeoutId = null;
  }

  try {
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);

    if (process.platform === "darwin") {
      await execAsync(`echo -n "${taskId}" | pbcopy`);
    } else if (process.platform === "linux") {
      await execAsync(`echo -n "${taskId}" | xclip -selection clipboard`);
    }

    const originalContent = idValue.content.toString();
    idValue.content = "Copied!";
    idValue.fg = COLORS.success;
    copyHint.content = "✓";
    copyHint.fg = COLORS.success;

    state.viewTaskRuntime.copyTimeoutId = setTimeout(() => {
      if (state.viewTaskRuntime) {
        idValue.content = originalContent;
        idValue.fg = COLORS.textDim;
        copyHint.content = "[c]opy";
        copyHint.fg = COLORS.textDim;
        state.viewTaskRuntime.copyTimeoutId = null;
      }
    }, 1000);
  } catch {
    idValue.content = "Failed!";
    idValue.fg = COLORS.danger;
    copyHint.content = "✗";
    copyHint.fg = COLORS.danger;

    state.viewTaskRuntime.copyTimeoutId = setTimeout(() => {
      if (state.viewTaskRuntime) {
        idValue.content = truncateMiddle(taskId, DIALOG_WIDTH - 14);
        idValue.fg = COLORS.textDim;
        copyHint.content = "[c]opy";
        copyHint.fg = COLORS.textDim;
        state.viewTaskRuntime.copyTimeoutId = null;
      }
    }, 1000);
  }
}

export function getViewTaskActions(state: AppState): ViewTaskActions | null {
  return state.viewTaskRuntime?.actions ?? null;
}
