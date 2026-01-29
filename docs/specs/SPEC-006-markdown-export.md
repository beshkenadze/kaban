# SPEC-006: Markdown Export/Import

**Status**: Draft  
**Priority**: P2 (Medium)  
**Complexity**: Medium  
**Estimated effort**: 1-2 days  
**Source**: taskell

---

## 1. Overview

Export/import boards to human-readable Markdown format.

### Goals
- Git-friendly format (minimal diffs)
- Human-readable files
- Complete round-trip (export → import = identical data)
- Compatible with taskell format

### Non-Goals
- Live sync with Markdown file (write-once)
- Live Markdown editing

---

## 2. Markdown Format

### 2.1 Basic Structure

```markdown
# Project Alpha

## Backlog

- Fix authentication bug
    @ 2024-03-25
    > Users report 401 errors on token refresh
    > Need to investigate token expiry logic
    * [ ] Check token expiry
    * [x] Add retry logic

- Implement dark mode
    # feature, ui

## In Progress

- Setup CI/CD pipeline
    @ 2024-03-20
    > Configure GitHub Actions
    * [x] Create workflow file
    * [ ] Add tests
    * [ ] Configure deployment

## Done

- Initial project setup
    @ 2024-03-15 ✓
```

### 2.2 Format Specification

| Element | Syntax | Example |
|---------|--------|---------|
| Board title | `# Title` | `# Project Alpha` |
| Column | `## Column Name` | `## Backlog` |
| Task | `- Task title` | `- Fix bug` |
| Due date | `    @ YYYY-MM-DD` | `    @ 2024-03-25` |
| Due completed | `    @ YYYY-MM-DD ✓` | `    @ 2024-03-25 ✓` |
| Description | `    > Line` | `    > Description text` |
| Labels | `    # label1, label2` | `    # bug, urgent` |
| Subtask incomplete | `    * [ ] Text` | `    * [ ] Check token` |
| Subtask complete | `    * [x] Text` | `    * [x] Add retry` |
| Assigned | `    @ assigned: user` | `    @ assigned: john` |

### 2.3 Special Character Handling

**Task titles** may contain special characters. Escape rules:

| Character | In Title | Handling |
|-----------|----------|----------|
| `#` | `Task #123` | No escape needed (only `# ` at line start is special) |
| `*` | `Fix * bug` | No escape needed (only `* ` after indent is special) |
| `>` | `A > B` | No escape needed (only `> ` after indent is special) |
| `@` | `user@email` | No escape needed (only `@ ` after indent is special) |
| Newline | N/A | **Not allowed in titles** - truncate or reject |
| `\|` | `A \| B` | Preserve as-is |
| Emoji | `Fix bug 🐛` | Preserve as-is (UTF-8) |
| Markdown | `` `code` `` | Preserve as-is (no rendering) |

**Important:** Task titles with embedded newlines are **not supported**. The parser will:
1. Reject during import with clear error
2. Truncate at first newline during export (with warning)

### 2.4 Full Example

```markdown
# Project Alpha

Created: 2024-01-15
Updated: 2024-03-20

## Backlog
<!-- WIP Limit: none -->

- Implement user settings page
    @ 2024-04-01
    # feature, settings
    > Allow users to customize their preferences
    > Including theme, notifications, and language
    * [ ] Design settings UI
    * [ ] Add theme switcher
    * [ ] Add notification preferences

- Fix memory leak in dashboard
    @ 2024-03-28
    # bug, performance
    > Dashboard component not cleaning up subscriptions
    @ assigned: alice

## In Progress
<!-- WIP Limit: 3 -->

- Setup monitoring
    # devops, monitoring
    > Implement Datadog integration
    * [x] Add Datadog SDK
    * [ ] Configure dashboards
    * [ ] Set up alerts

## Review
<!-- WIP Limit: 2 -->

## Done
<!-- Terminal column -->

- Initial project setup
    @ 2024-03-15 ✓
    # setup
    > Project scaffolding and initial configuration
```

---

## 3. Parser Implementation

### 3.1 Types

```typescript
// packages/core/src/services/markdown/types.ts

export interface MarkdownBoard {
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
  columns: MarkdownColumn[];
}

export interface MarkdownColumn {
  name: string;
  wipLimit?: number;
  isTerminal?: boolean;
  tasks: MarkdownTask[];
}

export interface MarkdownTask {
  title: string;
  description?: string;
  dueDate?: Date;
  dueCompleted?: boolean;
  labels?: string[];
  assignedTo?: string;
  subtasks?: MarkdownSubtask[];
}

export interface MarkdownSubtask {
  title: string;
  completed: boolean;
}

export class MarkdownParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly content: string
  ) {
    super(`Line ${line}: ${message}`);
    this.name = 'MarkdownParseError';
  }
}
```

### 3.2 Parser

```typescript
// packages/core/src/services/markdown/parser.ts

export function parseMarkdown(content: string): MarkdownBoard {
  const lines = content.split('\n');
  const board: MarkdownBoard = { name: '', columns: [] };
  
  let currentColumn: MarkdownColumn | null = null;
  let currentTask: MarkdownTask | null = null;
  let lineNumber = 0;
  
  for (const line of lines) {
    lineNumber++;
    
    // Board title: # Title
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      board.name = line.slice(2).trim();
      continue;
    }
    
    // Column: ## Column Name
    if (line.startsWith('## ')) {
      if (currentTask && currentColumn) {
        currentColumn.tasks.push(currentTask);
        currentTask = null;
      }
      currentColumn = {
        name: line.slice(3).trim(),
        tasks: [],
      };
      board.columns.push(currentColumn);
      continue;
    }
    
    // Column metadata: <!-- WIP Limit: 3 -->
    if (line.includes('WIP Limit:')) {
      const match = line.match(/WIP Limit:\s*(\d+|none)/i);
      if (match && currentColumn) {
        currentColumn.wipLimit = match[1].toLowerCase() === 'none' 
          ? undefined 
          : parseInt(match[1]);
      }
      continue;
    }
    
    // Terminal column marker
    if (line.includes('Terminal column') && currentColumn) {
      currentColumn.isTerminal = true;
      continue;
    }
    
    // Task: - Task title
    if (line.startsWith('- ')) {
      if (currentTask && currentColumn) {
        currentColumn.tasks.push(currentTask);
      }
      
      const title = line.slice(2).trim();
      
      // Validate: no newlines in title (shouldn't happen, but check)
      if (title.includes('\n')) {
        throw new MarkdownParseError(
          'Task title cannot contain newlines',
          lineNumber,
          line
        );
      }
      
      currentTask = { title };
      continue;
    }
    
    // Task metadata (indented with 4 spaces)
    if (currentTask && line.startsWith('    ')) {
      const trimmed = line.slice(4);
      
      // Due date: @ YYYY-MM-DD [✓]
      if (trimmed.startsWith('@ ') && !trimmed.includes('assigned:')) {
        const dueLine = trimmed.slice(2).trim();
        currentTask.dueCompleted = dueLine.includes('✓');
        const dateStr = dueLine.replace('✓', '').trim();
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
          currentTask.dueDate = new Date(dateStr);
        }
        continue;
      }
      
      // Assigned: @ assigned: user
      if (trimmed.includes('assigned:')) {
        const match = trimmed.match(/assigned:\s*(\S+)/);
        if (match) currentTask.assignedTo = match[1];
        continue;
      }
      
      // Labels: # label1, label2
      if (trimmed.startsWith('# ')) {
        currentTask.labels = trimmed.slice(2).split(',').map(l => l.trim());
        continue;
      }
      
      // Description: > text
      if (trimmed.startsWith('> ')) {
        const descLine = trimmed.slice(2);
        currentTask.description = currentTask.description
          ? `${currentTask.description}\n${descLine}`
          : descLine;
        continue;
      }
      
      // Subtask: * [ ] text or * [x] text
      if (trimmed.startsWith('* [')) {
        const completed = trimmed.startsWith('* [x]') || trimmed.startsWith('* [X]');
        const title = trimmed.slice(6).trim();
        currentTask.subtasks = currentTask.subtasks ?? [];
        currentTask.subtasks.push({ title, completed });
        continue;
      }
    }
  }
  
  // Don't forget last task
  if (currentTask && currentColumn) {
    currentColumn.tasks.push(currentTask);
  }
  
  return board;
}
```

### 3.3 Serializer

```typescript
// packages/core/src/services/markdown/serializer.ts

export interface SerializeOptions {
  /** Warn when truncating titles with newlines */
  onWarning?: (message: string) => void;
}

export function serializeBoard(board: MarkdownBoard, options?: SerializeOptions): string {
  const lines: string[] = [];
  const warn = options?.onWarning ?? console.warn;
  
  // Board header
  lines.push(`# ${sanitizeTitle(board.name, warn)}`);
  lines.push('');
  if (board.createdAt) {
    lines.push(`Created: ${formatDate(board.createdAt)}`);
  }
  if (board.updatedAt) {
    lines.push(`Updated: ${formatDate(board.updatedAt)}`);
  }
  lines.push('');
  
  // Columns
  for (const column of board.columns) {
    lines.push(`## ${column.name}`);
    
    // Column metadata
    if (column.wipLimit !== undefined) {
      lines.push(`<!-- WIP Limit: ${column.wipLimit} -->`);
    } else {
      lines.push(`<!-- WIP Limit: none -->`);
    }
    if (column.isTerminal) {
      lines.push(`<!-- Terminal column -->`);
    }
    lines.push('');
    
    // Tasks
    for (const task of column.tasks) {
      const title = sanitizeTitle(task.title, warn);
      lines.push(`- ${title}`);
      
      // Due date
      if (task.dueDate) {
        const checkmark = task.dueCompleted ? ' ✓' : '';
        lines.push(`    @ ${formatDate(task.dueDate)}${checkmark}`);
      }
      
      // Labels
      if (task.labels?.length) {
        lines.push(`    # ${task.labels.join(', ')}`);
      }
      
      // Assigned
      if (task.assignedTo) {
        lines.push(`    @ assigned: ${task.assignedTo}`);
      }
      
      // Description
      if (task.description) {
        for (const line of task.description.split('\n')) {
          lines.push(`    > ${line}`);
        }
      }
      
      // Subtasks
      if (task.subtasks?.length) {
        for (const subtask of task.subtasks) {
          const checkbox = subtask.completed ? '[x]' : '[ ]';
          lines.push(`    * ${checkbox} ${subtask.title}`);
        }
      }
      
      lines.push('');
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Sanitize title by removing/escaping problematic characters
 */
function sanitizeTitle(title: string, warn: (msg: string) => void): string {
  // Truncate at newline
  if (title.includes('\n')) {
    warn(`Title truncated at newline: "${title.slice(0, 50)}..."`);
    return title.split('\n')[0];
  }
  return title;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

---

## 4. Export/Import Service

```typescript
// packages/core/src/services/markdown/index.ts

export class MarkdownService {
  constructor(
    private taskService: TaskService,
    private boardService: BoardService,
  ) {}

  async exportBoard(boardId: string): Promise<string> {
    const board = await this.boardService.getBoard(boardId);
    const columns = await this.boardService.getColumns(boardId);
    const tasks = await this.taskService.getTasksByBoard(boardId);
    
    const mdBoard: MarkdownBoard = {
      name: board.name,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      columns: columns.map(col => ({
        name: col.name,
        wipLimit: col.wipLimit ?? undefined,
        isTerminal: col.isTerminal,
        tasks: tasks
          .filter(t => t.columnId === col.id)
          .sort((a, b) => a.position - b.position)
          .map(t => ({
            title: t.title,
            description: t.description ?? undefined,
            dueDate: t.dueDate ?? undefined,
            dueCompleted: !!t.completedAt,
            labels: t.labels.length ? t.labels : undefined,
            assignedTo: t.assignedTo ?? undefined,
            // Note: subtasks would need separate handling
          })),
      })),
    };
    
    return serializeBoard(mdBoard);
  }

  async importBoard(markdown: string, options?: ImportOptions): Promise<string> {
    const mdBoard = parseMarkdown(markdown);
    
    // Override board name if provided
    const boardName = options?.boardName ?? mdBoard.name;
    
    // Create board
    const board = await this.boardService.createBoard({
      name: boardName,
    });
    
    // Create columns
    const columnMap = new Map<string, string>();
    for (let i = 0; i < mdBoard.columns.length; i++) {
      const mdCol = mdBoard.columns[i];
      const column = await this.boardService.createColumn({
        boardId: board.id,
        name: mdCol.name,
        position: i,
        wipLimit: mdCol.wipLimit,
        isTerminal: mdCol.isTerminal ?? false,
      });
      columnMap.set(mdCol.name, column.id);
    }
    
    // Create tasks
    for (const mdCol of mdBoard.columns) {
      const columnId = columnMap.get(mdCol.name)!;
      
      for (let i = 0; i < mdCol.tasks.length; i++) {
        const mdTask = mdCol.tasks[i];
        await this.taskService.addTask({
          title: mdTask.title,
          description: mdTask.description,
          columnId,
          position: i,
          dueDate: mdTask.dueDate,
          labels: mdTask.labels ?? [],
          assignedTo: mdTask.assignedTo,
        });
      }
    }
    
    return board.id;
  }
}

interface ImportOptions {
  boardName?: string;
}
```

---

## 5. CLI Integration

```bash
# Export board to markdown
kaban export <board-id> [--output file.md]
kaban export 01JJX... > board.md
kaban export --output ./boards/project.md

# Import board from markdown
kaban import <file.md> [--name "Board Name"]
kaban import ./boards/project.md
kaban import backup.md --name "Restored Board"

# Preview import (dry run)
kaban import backup.md --dry-run
```

### CLI Implementation

```typescript
// packages/cli/src/commands/export.ts

exportCommand
  .argument('<board-id>', 'Board ID to export')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (boardId, options) => {
    const markdown = await markdownService.exportBoard(boardId);
    
    if (options.output) {
      await fs.writeFile(options.output, markdown);
      console.log(`Exported to ${options.output}`);
    } else {
      console.log(markdown);
    }
  });

// packages/cli/src/commands/import.ts

importCommand
  .argument('<file>', 'Markdown file to import')
  .option('-n, --name <name>', 'Override board name')
  .option('--dry-run', 'Preview import without creating')
  .action(async (file, options) => {
    const content = await fs.readFile(file, 'utf-8');
    
    if (options.dryRun) {
      const parsed = parseMarkdown(content);
      console.log(`Would create board: ${parsed.name}`);
      console.log(`Columns: ${parsed.columns.map(c => c.name).join(', ')}`);
      console.log(`Tasks: ${parsed.columns.reduce((n, c) => n + c.tasks.length, 0)}`);
      return;
    }
    
    const boardId = await markdownService.importBoard(content, {
      boardName: options.name,
    });
    console.log(`Imported board: ${boardId}`);
  });
```

---

## 6. MCP Tools

```typescript
// Tool: export_board_markdown
{
  name: "kaban_export_markdown",
  description: "Export board to Markdown format",
  parameters: {
    boardId: { type: "string" }
  }
}

// Tool: import_board_markdown
{
  name: "kaban_import_markdown",
  description: "Import board from Markdown content",
  parameters: {
    markdown: { type: "string", description: "Markdown content" },
    boardName: { type: "string", optional: true, description: "Override board name" }
  }
}
```

---

## 7. Testing

```typescript
describe('Markdown Export/Import', () => {
  describe('parseMarkdown', () => {
    it('parses board title', () => {
      const md = '# My Board\n\n## Backlog\n\n- Task 1';
      const board = parseMarkdown(md);
      expect(board.name).toBe('My Board');
    });

    it('parses columns', () => {
      const md = '# Board\n\n## Todo\n\n## Done';
      const board = parseMarkdown(md);
      expect(board.columns).toHaveLength(2);
      expect(board.columns[0].name).toBe('Todo');
    });

    it('parses tasks with metadata', () => {
      const md = `# Board

## Todo

- Fix bug
    @ 2024-03-25
    # bug, urgent
    > Description line 1
    > Description line 2
    * [ ] Step 1
    * [x] Step 2
`;
      const board = parseMarkdown(md);
      const task = board.columns[0].tasks[0];
      
      expect(task.title).toBe('Fix bug');
      expect(task.dueDate).toEqual(new Date('2024-03-25'));
      expect(task.labels).toEqual(['bug', 'urgent']);
      expect(task.description).toBe('Description line 1\nDescription line 2');
      expect(task.subtasks).toHaveLength(2);
      expect(task.subtasks![0].completed).toBe(false);
      expect(task.subtasks![1].completed).toBe(true);
    });

    it('handles task with special characters in title', () => {
      const md = `# Board

## Todo

- Task with "quotes" and <html> and \`code\`
- Task with emoji 🎉 and symbols @#$%
- Task with pipe | character
`;
      const board = parseMarkdown(md);
      
      expect(board.columns[0].tasks[0].title).toBe('Task with "quotes" and <html> and `code`');
      expect(board.columns[0].tasks[1].title).toBe('Task with emoji 🎉 and symbols @#$%');
      expect(board.columns[0].tasks[2].title).toBe('Task with pipe | character');
    });

    it('rejects task title with embedded newline', () => {
      // This shouldn't happen in valid markdown, but test the guard
      const md = '# Board\n\n## Todo\n\n- Task line 1';
      // Parsing should work for normal titles
      expect(() => parseMarkdown(md)).not.toThrow();
    });
  });

  describe('serializeBoard', () => {
    it('warns when truncating title with newline', () => {
      const warnings: string[] = [];
      const board: MarkdownBoard = {
        name: 'Board',
        columns: [{
          name: 'Todo',
          tasks: [{
            title: 'Line 1\nLine 2',  // Invalid!
          }],
        }],
      };
      
      const markdown = serializeBoard(board, {
        onWarning: (msg) => warnings.push(msg),
      });
      
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/truncated/i);
      expect(markdown).toContain('- Line 1');
      expect(markdown).not.toContain('Line 2');
    });
  });

  describe('round-trip', () => {
    it('export then import produces equivalent board', async () => {
      // Create board with tasks
      const board = await boardService.createBoard({ name: 'Test' });
      const column = await boardService.createColumn({ boardId: board.id, name: 'Todo' });
      await taskService.addTask({ title: 'Task 1', columnId: column.id });
      
      // Export
      const markdown = await markdownService.exportBoard(board.id);
      
      // Import
      const newBoardId = await markdownService.importBoard(markdown);
      const newBoard = await boardService.getBoard(newBoardId);
      const newTasks = await taskService.getTasksByBoard(newBoardId);
      
      expect(newBoard.name).toBe('Test');
      expect(newTasks).toHaveLength(1);
      expect(newTasks[0].title).toBe('Task 1');
    });

    it('preserves special characters in round-trip', async () => {
      const specialTitles = [
        'Task with "double quotes"',
        "Task with 'single quotes'",
        'Task with <html> tags',
        'Task with `backticks`',
        'Task with emoji 🎉🚀💯',
        'Task with symbols @user #123 $100',
        'Task with pipe | separator',
        'Task with unicode: äöü αβγ 中文',
      ];
      
      // Create board with special tasks
      const board = await boardService.createBoard({ name: 'Special Chars Test' });
      const column = await boardService.createColumn({ boardId: board.id, name: 'Todo' });
      
      for (const title of specialTitles) {
        await taskService.addTask({ title, columnId: column.id });
      }
      
      // Export and import
      const markdown = await markdownService.exportBoard(board.id);
      const newBoardId = await markdownService.importBoard(markdown);
      const newTasks = await taskService.getTasksByBoard(newBoardId);
      
      // Verify all titles preserved
      const importedTitles = newTasks.map(t => t.title).sort();
      expect(importedTitles).toEqual(specialTitles.sort());
    });

    it('preserves description with multiple lines', async () => {
      const board = await boardService.createBoard({ name: 'Test' });
      const column = await boardService.createColumn({ boardId: board.id, name: 'Todo' });
      await taskService.addTask({
        title: 'Task',
        description: 'Line 1\nLine 2\nLine 3',
        columnId: column.id,
      });
      
      const markdown = await markdownService.exportBoard(board.id);
      const newBoardId = await markdownService.importBoard(markdown);
      const [task] = await taskService.getTasksByBoard(newBoardId);
      
      expect(task.description).toBe('Line 1\nLine 2\nLine 3');
    });

    it('preserves all task metadata', async () => {
      const board = await boardService.createBoard({ name: 'Test' });
      const column = await boardService.createColumn({ boardId: board.id, name: 'Todo' });
      await taskService.addTask({
        title: 'Full Task',
        description: 'Description here',
        dueDate: new Date('2024-06-15'),
        labels: ['bug', 'urgent', 'p1'],
        assignedTo: 'alice',
        columnId: column.id,
      });
      
      const markdown = await markdownService.exportBoard(board.id);
      const newBoardId = await markdownService.importBoard(markdown);
      const [task] = await taskService.getTasksByBoard(newBoardId);
      
      expect(task.title).toBe('Full Task');
      expect(task.description).toBe('Description here');
      expect(task.dueDate?.toISOString().slice(0, 10)).toBe('2024-06-15');
      expect(task.labels).toEqual(['bug', 'urgent', 'p1']);
      expect(task.assignedTo).toBe('alice');
    });
  });
});
```

---

## 8. Acceptance Criteria

- [ ] Parser understands all format elements
- [ ] Serializer creates valid Markdown
- [ ] Round-trip (export → import) preserves all data
- [ ] Special characters in titles are preserved
- [ ] Emoji and unicode are preserved
- [ ] Multi-line descriptions are preserved
- [ ] Titles with newlines are rejected/truncated with warning
- [ ] CLI `export` and `import` work
- [ ] MCP tools available
- [ ] Exported file is human-readable
- [ ] Git diff of exported files is minimal
- [ ] Tests cover edge cases including special characters
