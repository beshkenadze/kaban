import { describe, expect, test } from "bun:test";
import type { Column, Task } from "../types.js";
import { MarkdownService } from "./markdown.js";

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "01ABC123",
    boardTaskId: 1,
    title: "Test Task",
    description: null,
    dueDate: null,
    labels: [],
    position: 0,
    columnId: "todo",
    archived: false,
    createdBy: "user",
    assignedTo: null,
    parentId: null,
    dependsOn: [],
    files: [],
    blockedReason: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    archivedAt: null,
    updatedBy: null,
    ...overrides,
  };
}

function createColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: "todo",
    name: "Todo",
    position: 0,
    wipLimit: null,
    isTerminal: false,
    ...overrides,
  };
}

describe("MarkdownService", () => {
  const service = new MarkdownService();

  describe("exportBoard", () => {
    test("exports basic board structure", () => {
      const board = { name: "My Project" };
      const columns = [
        createColumn({ id: "todo", name: "To Do", position: 0 }),
        createColumn({ id: "done", name: "Done", position: 1, isTerminal: true }),
      ];
      const tasksByColumn = new Map([
        ["todo", [createTask({ id: "1", title: "First task", columnId: "todo" })]],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("# My Project");
      expect(result).toContain("## To Do");
      expect(result).toContain("## Done");
      expect(result).toContain("- First task");
    });

    test("exports task with due date", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ dueDate: new Date("2024-03-25T00:00:00.000Z") })]],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("@ 2024-03-25");
    });

    test("exports completed due date with checkmark", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        [
          "todo",
          [
            createTask({
              dueDate: new Date("2024-03-25T00:00:00.000Z"),
              completedAt: new Date("2024-03-26T00:00:00.000Z"),
            }),
          ],
        ],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("@ 2024-03-25 ✓");
    });

    test("exports task with description", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ description: "Line 1\nLine 2" })]],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("    > Line 1");
      expect(result).toContain("    > Line 2");
    });

    test("exports task with labels", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ labels: ["bug", "urgent"] })]],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("    # bug, urgent");
    });

    test("exports task with assignee", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([["todo", [createTask({ assignedTo: "alice" })]]]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("    @ assigned: alice");
    });

    test("includes metadata when requested", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([["todo", [createTask({ id: "01ABC123" })]]]);

      const result = service.exportBoard(board, columns, tasksByColumn, {
        includeMetadata: true,
      });

      expect(result).toContain("<!-- id:01ABC123 -->");
    });

    test("excludes archived tasks by default", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        [
          "todo",
          [
            createTask({ title: "Active", archived: false }),
            createTask({ id: "2", title: "Archived", archived: true }),
          ],
        ],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("- Active");
      expect(result).not.toContain("- Archived");
    });

    test("includes archived tasks when requested", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ title: "Archived", archived: true })]],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn, {
        includeArchived: true,
      });

      expect(result).toContain("- Archived");
    });

    test("exports WIP limit as comment", () => {
      const board = { name: "Test" };
      const columns = [createColumn({ wipLimit: 3 })];
      const tasksByColumn = new Map<string, Task[]>();

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("<!-- WIP Limit: 3 -->");
    });

    test("exports terminal column marker", () => {
      const board = { name: "Test" };
      const columns = [createColumn({ isTerminal: true })];
      const tasksByColumn = new Map<string, Task[]>();

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("<!-- Terminal column -->");
    });

    test("handles special characters in titles", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ title: "Task with emoji \u{1F680}" })]],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("Task with emoji \u{1F680}");
    });

    test("escapes HTML comments in titles", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ title: "Task <!-- comment -->" })]],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      expect(result).toContain("Task \\<!-- comment -->");
    });

    test("sorts columns by position", () => {
      const board = { name: "Test" };
      const columns = [
        createColumn({ id: "done", name: "Done", position: 2 }),
        createColumn({ id: "todo", name: "Todo", position: 0 }),
        createColumn({ id: "progress", name: "In Progress", position: 1 }),
      ];
      const tasksByColumn = new Map<string, Task[]>();

      const result = service.exportBoard(board, columns, tasksByColumn);

      const todoIndex = result.indexOf("## Todo");
      const progressIndex = result.indexOf("## In Progress");
      const doneIndex = result.indexOf("## Done");

      expect(todoIndex).toBeLessThan(progressIndex);
      expect(progressIndex).toBeLessThan(doneIndex);
    });

    test("sorts tasks by position", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        [
          "todo",
          [
            createTask({ id: "2", title: "Second", position: 1 }),
            createTask({ id: "1", title: "First", position: 0 }),
            createTask({ id: "3", title: "Third", position: 2 }),
          ],
        ],
      ]);

      const result = service.exportBoard(board, columns, tasksByColumn);

      const firstIndex = result.indexOf("- First");
      const secondIndex = result.indexOf("- Second");
      const thirdIndex = result.indexOf("- Third");

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });
  });

  describe("parseMarkdown", () => {
    test("parses basic board structure", () => {
      const md = `# My Project

## To Do

- First task

## Done

- Completed task
`;

      const result = service.parseMarkdown(md);

      expect(result.boardName).toBe("My Project");
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0].name).toBe("To Do");
      expect(result.columns[0].tasks).toHaveLength(1);
      expect(result.columns[0].tasks[0].title).toBe("First task");
    });

    test("parses task with due date", () => {
      const md = `# Test

## Todo

- Task
    @ 2024-03-25
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].tasks[0].dueDate).toEqual(
        new Date("2024-03-25T00:00:00.000Z"),
      );
    });

    test("parses task with due date and checkmark", () => {
      const md = `# Test

## Todo

- Task
    @ 2024-03-25 ✓
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].tasks[0].dueDate).toEqual(
        new Date("2024-03-25T00:00:00.000Z"),
      );
    });

    test("parses task with description", () => {
      const md = `# Test

## Todo

- Task
    > Line 1
    > Line 2
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].tasks[0].description).toBe("Line 1\nLine 2");
    });

    test("parses task with labels", () => {
      const md = `# Test

## Todo

- Task
    # bug, urgent
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].tasks[0].labels).toEqual(["bug", "urgent"]);
    });

    test("parses task with assignee", () => {
      const md = `# Test

## Todo

- Task
    @ assigned: alice
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].tasks[0].assignedTo).toBe("alice");
    });

    test("extracts ID from metadata comment", () => {
      const md = `# Test

## Todo

- Task <!-- id:01ABC123 -->
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].tasks[0].id).toBe("01ABC123");
      expect(result.columns[0].tasks[0].title).toBe("Task");
    });

    test("handles empty columns", () => {
      const md = `# Test

## Empty Column

## Has Tasks

- A task
`;

      const result = service.parseMarkdown(md);

      expect(result.columns).toHaveLength(2);
      expect(result.columns[0].name).toBe("Empty Column");
      expect(result.columns[0].tasks).toHaveLength(0);
    });

    test("reports invalid date format as error", () => {
      const md = `# Test

## Todo

- Task
    @ not-a-date
`;

      const result = service.parseMarkdown(md);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Invalid date");
    });

    test("parses WIP limit from comment", () => {
      const md = `# Test

## In Progress
<!-- WIP Limit: 3 -->

- Task
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].wipLimit).toBe(3);
    });

    test("parses terminal column marker", () => {
      const md = `# Test

## Done
<!-- Terminal column -->
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].isTerminal).toBe(true);
    });

    test("handles task with all metadata", () => {
      const md = `# Test

## Todo

- Complete task
    @ 2024-06-15
    # feature, v2
    @ assigned: alice
    > Description line 1
    > Description line 2
`;

      const result = service.parseMarkdown(md);
      const task = result.columns[0].tasks[0];

      expect(task.title).toBe("Complete task");
      expect(task.dueDate).toEqual(new Date("2024-06-15T00:00:00.000Z"));
      expect(task.labels).toEqual(["feature", "v2"]);
      expect(task.assignedTo).toBe("alice");
      expect(task.description).toBe("Description line 1\nDescription line 2");
    });

    test("handles special characters in task titles", () => {
      const md = `# Test

## Todo

- Task with "quotes" and <html> and \`code\`
- Task with emoji \u{1F389} and symbols @#$%
- Task with pipe | character
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].tasks[0].title).toBe(
        'Task with "quotes" and <html> and `code`',
      );
      expect(result.columns[0].tasks[1].title).toBe(
        "Task with emoji \u{1F389} and symbols @#$%",
      );
      expect(result.columns[0].tasks[2].title).toBe("Task with pipe | character");
    });

    test("handles tab indentation", () => {
      const md = `# Test

## Todo

- Task
\t> Description with tab indent
`;

      const result = service.parseMarkdown(md);

      expect(result.columns[0].tasks[0].description).toBe("Description with tab indent");
    });

    test("defaults board name if not provided", () => {
      const md = `## Todo

- Task
`;

      const result = service.parseMarkdown(md);

      expect(result.boardName).toBe("Imported Board");
    });
  });

  describe("round-trip", () => {
    test("export then import preserves basic data", () => {
      const board = { name: "Round Trip Test" };
      const columns = [
        createColumn({ id: "backlog", name: "Backlog", position: 0 }),
        createColumn({ id: "todo", name: "To Do", position: 1 }),
      ];
      const tasksByColumn = new Map([
        [
          "backlog",
          [
            createTask({
              id: "1",
              title: "Task with all features",
              description: "Description here",
              dueDate: new Date("2024-06-15T00:00:00.000Z"),
              labels: ["feature", "v2"],
              position: 0,
              columnId: "backlog",
            }),
          ],
        ],
        [
          "todo",
          [
            createTask({
              id: "2",
              title: "Simple task",
              position: 0,
              columnId: "todo",
            }),
          ],
        ],
      ]);

      const exported = service.exportBoard(board, columns, tasksByColumn);
      const imported = service.parseMarkdown(exported);

      expect(imported.boardName).toBe("Round Trip Test");
      expect(imported.columns).toHaveLength(2);
      expect(imported.columns[0].name).toBe("Backlog");
      expect(imported.columns[0].tasks[0].title).toBe("Task with all features");
      expect(imported.columns[0].tasks[0].description).toBe("Description here");
      expect(imported.columns[0].tasks[0].labels).toEqual(["feature", "v2"]);
      expect(imported.columns[1].tasks[0].title).toBe("Simple task");
      expect(imported.errors).toHaveLength(0);
    });

    test("export then import preserves ID with metadata", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ id: "01ABC123XYZ", title: "Task" })]],
      ]);

      const exported = service.exportBoard(board, columns, tasksByColumn, {
        includeMetadata: true,
      });
      const imported = service.parseMarkdown(exported);

      expect(imported.columns[0].tasks[0].id).toBe("01ABC123XYZ");
      expect(imported.columns[0].tasks[0].title).toBe("Task");
    });

    test("export then import preserves assignee", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ assignedTo: "alice" })]],
      ]);

      const exported = service.exportBoard(board, columns, tasksByColumn);
      const imported = service.parseMarkdown(exported);

      expect(imported.columns[0].tasks[0].assignedTo).toBe("alice");
    });

    test("export then import preserves multi-line description", () => {
      const board = { name: "Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        ["todo", [createTask({ description: "Line 1\nLine 2\nLine 3" })]],
      ]);

      const exported = service.exportBoard(board, columns, tasksByColumn);
      const imported = service.parseMarkdown(exported);

      expect(imported.columns[0].tasks[0].description).toBe("Line 1\nLine 2\nLine 3");
    });

    test("export then import preserves WIP limit", () => {
      const board = { name: "Test" };
      const columns = [createColumn({ wipLimit: 5 })];
      const tasksByColumn = new Map<string, Task[]>();

      const exported = service.exportBoard(board, columns, tasksByColumn);
      const imported = service.parseMarkdown(exported);

      expect(imported.columns[0].wipLimit).toBe(5);
    });

    test("export then import preserves terminal flag", () => {
      const board = { name: "Test" };
      const columns = [createColumn({ isTerminal: true })];
      const tasksByColumn = new Map<string, Task[]>();

      const exported = service.exportBoard(board, columns, tasksByColumn);
      const imported = service.parseMarkdown(exported);

      expect(imported.columns[0].isTerminal).toBe(true);
    });

    test("preserves special characters in round-trip", () => {
      const specialTitles = [
        'Task with "double quotes"',
        "Task with 'single quotes'",
        "Task with <html> tags",
        "Task with `backticks`",
        "Task with emoji \u{1F389}\u{1F680}\u{1F4AF}",
        "Task with symbols @user #123 $100",
        "Task with pipe | separator",
        "Task with unicode: \u{00E4}\u{00F6}\u{00FC} \u{03B1}\u{03B2}\u{03B3} \u{4E2D}\u{6587}",
      ];

      const board = { name: "Special Chars Test" };
      const columns = [createColumn()];
      const tasksByColumn = new Map([
        [
          "todo",
          specialTitles.map((title, i) =>
            createTask({ id: String(i), title, position: i }),
          ),
        ],
      ]);

      const exported = service.exportBoard(board, columns, tasksByColumn);
      const imported = service.parseMarkdown(exported);

      const importedTitles = imported.columns[0].tasks.map((t) => t.title).sort();
      expect(importedTitles).toEqual(specialTitles.sort());
    });
  });
});
