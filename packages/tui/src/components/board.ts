import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import { COLORS } from "../lib/theme.js";
import type { AppState } from "../lib/types.js";
import { truncate } from "../lib/utils.js";

export async function refreshBoard(state: AppState): Promise<void> {
  const { renderer, taskService, boardService } = state;

  if (state.mainContainer) {
    state.mainContainer.destroy();
  }

  state.columns = await boardService.getColumns();
  const tasks = await taskService.listTasks();

  const mainContainer = new BoxRenderable(renderer, {
    id: "main",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    backgroundColor: COLORS.bg,
  });
  state.mainContainer = mainContainer;

  const header = new BoxRenderable(renderer, {
    id: "header",
    width: "100%",
    height: 3,
    backgroundColor: COLORS.panel,
    border: true,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  });

  const headerText = new TextRenderable(renderer, {
    id: "header-text",
    content: `${state.boardName}`,
    fg: COLORS.accent,
  });
  header.add(headerText);
  mainContainer.add(header);

  const columnsContainer = new BoxRenderable(renderer, {
    id: "columns-container",
    flexDirection: "row",
    width: "100%",
    flexGrow: 1,
    gap: 1,
    padding: 1,
  });

  state.columnPanels = [];

  for (let i = 0; i < state.columns.length; i++) {
    const column = state.columns[i];
    const columnTasks = tasks.filter((t) => t.columnId === column.id);
    const isSelected = i === state.currentColumnIndex;

    const columnPanel = new BoxRenderable(renderer, {
      id: `column-${column.id}`,
      flexGrow: 1,
      flexDirection: "column",
      border: true,
      borderStyle: isSelected ? "double" : "single",
      borderColor: isSelected ? COLORS.borderActive : COLORS.border,
      backgroundColor: COLORS.panel,
      title: `${column.name} (${columnTasks.length})`,
      titleAlignment: "center",
      padding: 1,
    });

    if (columnTasks.length > 0) {
      const taskSelect = new SelectRenderable(renderer, {
        id: `tasks-${column.id}`,
        width: "100%",
        height: Math.min(columnTasks.length + 2, 20),
        backgroundColor: COLORS.panel,
        textColor: COLORS.text,
        options: columnTasks.map((task) => ({
          name: truncate(task.title, 30),
          description: task.createdBy,
          value: task.id,
        })),
        selectedBackgroundColor: COLORS.bg,
        selectedTextColor: COLORS.accent,
        descriptionColor: COLORS.textMuted,
      });

      taskSelect.on(SelectRenderableEvents.ITEM_SELECTED, () => {});

      if (isSelected) {
        taskSelect.focus();
      }

      columnPanel.add(taskSelect);
    } else {
      const emptyText = new TextRenderable(renderer, {
        id: `empty-${column.id}`,
        content: "(empty)",
        fg: COLORS.textDim,
      });
      columnPanel.add(emptyText);
    }

    state.columnPanels.push(columnPanel);
    columnsContainer.add(columnPanel);
  }

  mainContainer.add(columnsContainer);

  const footer = new BoxRenderable(renderer, {
    id: "footer",
    width: "100%",
    height: 3,
    backgroundColor: COLORS.panel,
    border: true,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  });

  const footerText = new TextRenderable(renderer, {
    id: "footer-text",
    content: "<-> Column  up/dn Task  [a]dd  [?] Help  [q]uit",
    fg: COLORS.textMuted,
  });
  footer.add(footerText);
  mainContainer.add(footer);

  renderer.root.add(mainContainer);
}
