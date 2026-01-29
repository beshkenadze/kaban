import type { Column, Task } from "../types.js";

export interface ExportOptions {
  includeArchived?: boolean;
  includeMetadata?: boolean;
}

export interface ParsedTask {
  title: string;
  id?: string;
  description: string | null;
  dueDate: Date | null;
  labels: string[];
  assignedTo?: string;
}

export interface ParsedColumn {
  name: string;
  wipLimit?: number;
  isTerminal?: boolean;
  tasks: ParsedTask[];
}

export interface ParseResult {
  boardName: string;
  columns: ParsedColumn[];
  errors: string[];
}

export class MarkdownService {
  /**
   * Export board to Markdown format (Taskell-compatible)
   */
  exportBoard(
    board: { name: string },
    columns: Column[],
    tasksByColumn: Map<string, Task[]>,
    options?: ExportOptions,
  ): string {
    const lines: string[] = [];

    lines.push(`# ${escapeMarkdown(board.name)}`);
    lines.push("");

    const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

    for (const column of sortedColumns) {
      lines.push(`## ${escapeMarkdown(column.name)}`);

      if (column.wipLimit !== null) {
        lines.push(`<!-- WIP Limit: ${column.wipLimit} -->`);
      }
      if (column.isTerminal) {
        lines.push(`<!-- Terminal column -->`);
      }

      lines.push("");

      const tasks = tasksByColumn.get(column.id) || [];
      const sortedTasks = [...tasks].sort((a, b) => a.position - b.position);

      for (const task of sortedTasks) {
        if (!options?.includeArchived && task.archived) continue;

        if (options?.includeMetadata) {
          lines.push(`- ${escapeMarkdown(task.title)} <!-- id:${task.id} -->`);
        } else {
          lines.push(`- ${escapeMarkdown(task.title)}`);
        }

        if (task.dueDate) {
          const checkmark = task.completedAt ? " ✓" : "";
          lines.push(`    @ ${formatDate(task.dueDate)}${checkmark}`);
        }

        if (task.labels && task.labels.length > 0) {
          lines.push(`    # ${task.labels.join(", ")}`);
        }

        if (task.assignedTo) {
          lines.push(`    @ assigned: ${task.assignedTo}`);
        }

        if (task.description) {
          const descLines = task.description.split("\n");
          for (const line of descLines) {
            lines.push(`    > ${escapeMarkdown(line)}`);
          }
        }

        lines.push("");
      }
    }

    return lines.join("\n").trimEnd() + "\n";
  }

  /**
   * Parse Markdown into board structure
   */
  parseMarkdown(content: string): ParseResult {
    const lines = content.split("\n");
    const errors: string[] = [];
    let boardName = "Imported Board";
    const columns: ParsedColumn[] = [];
    let currentColumn: ParsedColumn | null = null;
    let currentTask: ParsedTask | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (line.startsWith("# ") && !line.startsWith("## ")) {
        boardName = unescapeMarkdown(line.slice(2).trim());
        continue;
      }

      if (line.startsWith("## ")) {
        if (currentTask && currentColumn) {
          currentColumn.tasks.push(currentTask);
          currentTask = null;
        }
        if (currentColumn) {
          columns.push(currentColumn);
        }
        currentColumn = {
          name: unescapeMarkdown(line.slice(3).trim()),
          tasks: [],
        };
        continue;
      }

      if (line.includes("WIP Limit:") && currentColumn) {
        const match = line.match(/WIP Limit:\s*(\d+|none)/i);
        if (match) {
          currentColumn.wipLimit =
            match[1].toLowerCase() === "none" ? undefined : parseInt(match[1], 10);
        }
        continue;
      }

      if (line.includes("Terminal column") && currentColumn) {
        currentColumn.isTerminal = true;
        continue;
      }

      if (line.startsWith("- ")) {
        if (currentTask && currentColumn) {
          currentColumn.tasks.push(currentTask);
        }

        let title = line.slice(2);
        let id: string | undefined;

        const idMatch = title.match(/<!--\s*id:([^\s]+)\s*-->/);
        if (idMatch) {
          id = idMatch[1];
          title = title.replace(idMatch[0], "").trim();
        }

        currentTask = {
          title: unescapeMarkdown(title),
          id,
          description: null,
          dueDate: null,
          labels: [],
        };
        continue;
      }

      const indentMatch = line.match(/^(\s{4}|\t)/);
      if (indentMatch && currentTask) {
        const content = line.slice(indentMatch[0].length);

        if (content.startsWith("@ ") && !content.includes("assigned:")) {
          const dueLine = content.slice(2).trim();
          const dateStr = dueLine.replace("✓", "").trim();
          const parsed = parseISODate(dateStr);
          if (parsed) {
            currentTask.dueDate = parsed;
          } else {
            errors.push(`Line ${lineNum}: Invalid date format "${dateStr}"`);
          }
          continue;
        }

        if (content.includes("assigned:")) {
          const match = content.match(/assigned:\s*(\S+)/);
          if (match) {
            currentTask.assignedTo = match[1];
          }
          continue;
        }

        if (content.startsWith("# ")) {
          const labelStr = content.slice(2).trim();
          currentTask.labels = labelStr
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean);
          continue;
        }

        if (content.startsWith("> ")) {
          const descLine = unescapeMarkdown(content.slice(2));
          if (currentTask.description === null) {
            currentTask.description = descLine;
          } else {
            currentTask.description += "\n" + descLine;
          }
          continue;
        }
      }
    }

    if (currentTask && currentColumn) {
      currentColumn.tasks.push(currentTask);
    }
    if (currentColumn) {
      columns.push(currentColumn);
    }

    return { boardName, columns, errors };
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, " ").replace(/<!--/g, "\\<!--");
}

function unescapeMarkdown(text: string): string {
  return text.replace(/\\<!--/g, "<!--").replace(/\\\\/g, "\\");
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseISODate(str: string): Date | null {
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(str + "T00:00:00.000Z");
  if (isNaN(date.getTime())) return null;
  return date;
}
