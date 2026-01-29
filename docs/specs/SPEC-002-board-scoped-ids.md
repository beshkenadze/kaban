# SPEC-002: Board-Scoped Task IDs

**Status**: Draft  
**Priority**: P1 (High)  
**Complexity**: Low  
**Estimated effort**: 0.5 day  
**Source**: Cainban

---

## 1. Overview

Display short, human-readable task IDs in board context instead of global ULIDs.

### Problem
```
# Current (ULID - 26 characters):
Task 01JJXYZ123ABC456DEF789GHI created

# Takes many tokens in AI context
# Hard for humans to remember/type
```

### Solution
```
# After:
Task #12 created (board: Project Alpha)

# When referencing:
kaban task show 12          # By board_task_id
kaban task show 01JJX...    # By ULID (still works)
```

### Goals
- Short IDs for display and input
- Fewer tokens in AI context
- Backward compatibility with ULID
- Uniqueness within board scope
- **IDs are never reused** (deleted task #5 doesn't free up #5)

### Non-Goals
- Changing primary key (stays ULID)
- Changing storage format

---

## 2. Database Schema

### Modify `tasks` table

```sql
ALTER TABLE tasks ADD COLUMN board_task_id INTEGER;

-- Create unique index per board (via column's board_id)
-- Note: This is enforced at application level since board_id is indirect
```

### Drizzle Schema Update

```typescript
// packages/core/src/db/schema.ts

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  boardTaskId: integer("board_task_id"),  // NEW
  title: text("title").notNull(),
  // ... rest of fields
});
```

---

## 3. ID Generation

### Atomic Auto-increment per Board

**Critical:** Use atomic operation to prevent race conditions in concurrent environments.

```typescript
// packages/core/src/services/task.ts

/**
 * Atomically get next board task ID using INSERT with subquery.
 * This prevents race conditions when multiple processes create tasks simultaneously.
 */
async function createTaskWithBoardId(
  db: Database,
  boardId: string,
  taskData: Omit<TaskInsert, 'id' | 'boardTaskId'>
): Promise<Task> {
  const taskId = ulid();
  
  // Atomic INSERT with computed boardTaskId
  // The subquery runs within the INSERT, preventing race conditions
  const result = await db.run(sql`
    INSERT INTO tasks (id, board_task_id, title, column_id, description, labels, created_by, created_at)
    VALUES (
      ${taskId},
      (
        SELECT COALESCE(MAX(t.board_task_id), 0) + 1
        FROM tasks t
        INNER JOIN columns c ON t.column_id = c.id
        WHERE c.board_id = ${boardId}
      ),
      ${taskData.title},
      ${taskData.columnId},
      ${taskData.description ?? null},
      ${JSON.stringify(taskData.labels ?? [])},
      ${taskData.createdBy ?? null},
      ${Math.floor(Date.now() / 1000)}
    )
  `);
  
  // Fetch the created task
  return db.select().from(tasks).where(eq(tasks.id, taskId)).get();
}

// Alternative: Transaction with retry on conflict
async function createTaskWithRetry(
  db: Database,
  boardId: string,
  taskData: Omit<TaskInsert, 'id' | 'boardTaskId'>,
  maxRetries = 3
): Promise<Task> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        // Get next ID within transaction
        const result = await tx
          .select({ maxId: sql<number>`COALESCE(MAX(t.board_task_id), 0)` })
          .from(tasks)
          .innerJoin(columns, eq(tasks.columnId, columns.id))
          .where(eq(columns.boardId, boardId))
          .get();
        
        const nextId = (result?.maxId ?? 0) + 1;
        
        const task = {
          id: ulid(),
          boardTaskId: nextId,
          ...taskData,
        };
        
        await tx.insert(tasks).values(task);
        return task;
      });
    } catch (error) {
      // Retry on unique constraint violation
      if (error.code === 'SQLITE_CONSTRAINT' && attempt < maxRetries - 1) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('Failed to create task after max retries');
}
```

### TaskService Integration

```typescript
// packages/core/src/services/task.ts

export class TaskService {
  async addTask(input: AddTaskInput): Promise<Task> {
    const column = await this.getColumn(input.columnId ?? this.getDefaultColumnId());
    const boardId = column.boardId;
    
    return createTaskWithBoardId(this.db, boardId, {
      title: input.title,
      columnId: column.id,
      description: input.description,
      labels: input.labels ?? [],
      createdBy: input.createdBy,
    });
  }
}
```

---

## 4. Task Resolution

### Resolve by Short ID or ULID

```typescript
// packages/core/src/services/task.ts

export interface TaskResolver {
  /**
   * Resolve task by short ID (board-scoped) or ULID
   * @param idOrShortId - "#12", "12", or full ULID
   * @param boardId - Required if using short ID
   */
  resolveTask(idOrShortId: string, boardId?: string): Promise<Task | null>;
}

async resolveTask(idOrShortId: string, boardId?: string): Promise<Task | null> {
  // Clean input
  const cleanId = idOrShortId.replace(/^#/, '').trim();
  
  // Try as short ID (number)
  if (/^\d+$/.test(cleanId)) {
    const shortId = parseInt(cleanId, 10);
    
    if (boardId) {
      return this.getTaskByBoardTaskId(boardId, shortId);
    }
    
    // If no boardId, try current/default board
    const defaultBoardId = await this.getDefaultBoardId();
    if (defaultBoardId) {
      return this.getTaskByBoardTaskId(defaultBoardId, shortId);
    }
    
    return null;
  }
  
  // Try as ULID (26 chars, alphanumeric)
  if (/^[0-9A-Z]{26}$/i.test(cleanId)) {
    return this.getTask(cleanId);
  }
  
  // Try as partial ULID (prefix match)
  if (cleanId.length >= 4 && /^[0-9A-Z]+$/i.test(cleanId)) {
    return this.getTaskByIdPrefix(cleanId);
  }
  
  return null;
}

async getTaskByBoardTaskId(boardId: string, boardTaskId: number): Promise<Task | null> {
  const result = await this.db
    .select()
    .from(tasks)
    .innerJoin(columns, eq(tasks.columnId, columns.id))
    .where(
      and(
        eq(columns.boardId, boardId),
        eq(tasks.boardTaskId, boardTaskId)
      )
    )
    .limit(1);
  
  return result[0]?.tasks ?? null;
}

async getTaskByIdPrefix(prefix: string): Promise<Task | null> {
  const result = await this.db
    .select()
    .from(tasks)
    .where(sql`${tasks.id} LIKE ${prefix + '%'}`)
    .limit(2);  // Get 2 to detect ambiguity
  
  if (result.length === 0) return null;
  if (result.length > 1) {
    throw new Error(`Ambiguous task ID prefix: ${prefix}. Multiple matches found.`);
  }
  
  return result[0];
}
```

---

## 5. Display Format

### CLI Output

```typescript
// Before
console.log(`Task ${task.id} created`);
// Output: Task 01JJXYZ123ABC456DEF789GHI created

// After
console.log(`Task #${task.boardTaskId} created`);
// Output: Task #12 created
```

### Task List Format

```
# kaban task list

  #   Title                    Column      Labels
────────────────────────────────────────────────────
  1   Fix authentication       todo        bug
  2   Implement dark mode      in-progress feature
  3   Update documentation     done        docs
```

### MCP Tool Response

```typescript
// Before
{
  id: "01JJXYZ123ABC456DEF789GHI",
  title: "Fix bug"
}

// After
{
  id: "01JJXYZ123ABC456DEF789GHI",
  shortId: 12,
  displayId: "#12",
  title: "Fix bug"
}
```

---

## 6. CLI Changes

### Accept Both ID Formats

```bash
# By short ID (preferred)
kaban task show 12
kaban task move 12 done
kaban task update 12 --title "New title"

# By ULID (still works)
kaban task show 01JJXYZ123ABC456DEF789GHI

# With hash prefix (optional)
kaban task show #12

# By partial ULID (at least 4 chars)
kaban task show 01JJX
```

### Implementation

```typescript
// packages/cli/src/utils/resolve-task.ts

export async function resolveTaskArg(
  taskService: TaskService,
  idArg: string,
  boardId?: string
): Promise<Task> {
  const task = await taskService.resolveTask(idArg, boardId);
  
  if (!task) {
    throw new Error(`Task not found: ${idArg}`);
  }
  
  return task;
}
```

---

## 7. Migration

```sql
-- drizzle/0005_board_scoped_ids.sql

-- Add column
ALTER TABLE tasks ADD COLUMN board_task_id INTEGER;

-- Backfill existing tasks with sequential IDs per board
-- Uses window function to assign IDs in creation order
WITH ranked AS (
  SELECT 
    t.id,
    ROW_NUMBER() OVER (
      PARTITION BY c.board_id 
      ORDER BY t.created_at, t.id
    ) as rn
  FROM tasks t
  JOIN columns c ON t.column_id = c.id
)
UPDATE tasks 
SET board_task_id = (SELECT rn FROM ranked WHERE ranked.id = tasks.id);
```

---

## 8. Type Updates

```typescript
// packages/core/src/schemas.ts

export const TaskSchema = z.object({
  id: z.string(),
  boardTaskId: z.number().int().positive(),  // NEW
  title: z.string(),
  // ... rest
});

export type Task = z.infer<typeof TaskSchema>;

// Helper for display
export function formatTaskId(task: Task): string {
  return `#${task.boardTaskId}`;
}

export function formatTaskIdLong(task: Task): string {
  return `#${task.boardTaskId} (${task.id})`;
}

export function formatTaskIdVerbose(task: Task): string {
  return `#${task.boardTaskId} [${task.id.slice(0, 8)}...]`;
}
```

---

## 9. Testing

```typescript
describe('Board-scoped IDs', () => {
  describe('ID generation', () => {
    it('auto-increments boardTaskId per board', async () => {
      const task1 = await taskService.addTask({ title: 'First' });
      const task2 = await taskService.addTask({ title: 'Second' });
      
      expect(task1.boardTaskId).toBe(1);
      expect(task2.boardTaskId).toBe(2);
    });

    it('separate ID sequences per board', async () => {
      // Board A
      const taskA1 = await taskService.addTask({ title: 'A1', columnId: boardAColumn });
      const taskA2 = await taskService.addTask({ title: 'A2', columnId: boardAColumn });
      
      // Board B
      const taskB1 = await taskService.addTask({ title: 'B1', columnId: boardBColumn });
      
      expect(taskA1.boardTaskId).toBe(1);
      expect(taskA2.boardTaskId).toBe(2);
      expect(taskB1.boardTaskId).toBe(1);  // Resets for new board
    });

    it('IDs are never reused after deletion', async () => {
      const task1 = await taskService.addTask({ title: 'Task 1' });  // #1
      const task2 = await taskService.addTask({ title: 'Task 2' });  // #2
      const task3 = await taskService.addTask({ title: 'Task 3' });  // #3
      
      // Delete task #2
      await taskService.deleteTask(task2.id);
      
      // Create new task - should be #4, NOT #2
      const task4 = await taskService.addTask({ title: 'Task 4' });
      
      expect(task4.boardTaskId).toBe(4);
    });

    it('handles concurrent task creation without ID collision', async () => {
      const results = await Promise.all([
        taskService.addTask({ title: 'Concurrent 1' }),
        taskService.addTask({ title: 'Concurrent 2' }),
        taskService.addTask({ title: 'Concurrent 3' }),
        taskService.addTask({ title: 'Concurrent 4' }),
        taskService.addTask({ title: 'Concurrent 5' }),
      ]);
      
      const ids = results.map(t => t.boardTaskId);
      const uniqueIds = new Set(ids);
      
      // All IDs should be unique
      expect(uniqueIds.size).toBe(5);
      
      // IDs should be sequential (1-5)
      expect(ids.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('ID resolution', () => {
    it('resolves task by short ID', async () => {
      const created = await taskService.addTask({ title: 'Test' });
      const resolved = await taskService.resolveTask('1', boardId);
      
      expect(resolved?.id).toBe(created.id);
    });

    it('resolves task by ULID', async () => {
      const created = await taskService.addTask({ title: 'Test' });
      const resolved = await taskService.resolveTask(created.id);
      
      expect(resolved?.boardTaskId).toBe(created.boardTaskId);
    });

    it('handles #prefix in short ID', async () => {
      const created = await taskService.addTask({ title: 'Test' });
      const resolved = await taskService.resolveTask('#1', boardId);
      
      expect(resolved?.id).toBe(created.id);
    });

    it('resolves task by partial ULID', async () => {
      const created = await taskService.addTask({ title: 'Test' });
      const prefix = created.id.slice(0, 8);
      const resolved = await taskService.resolveTask(prefix);
      
      expect(resolved?.id).toBe(created.id);
    });

    it('throws on ambiguous partial ULID', async () => {
      // Create tasks with similar ULIDs (unlikely but possible)
      const task1 = await taskService.addTask({ title: 'Task 1' });
      
      // Mock a scenario where prefix matches multiple
      // In practice, test this with controlled ULIDs
      await expect(
        taskService.resolveTask('01')  // Too short, likely ambiguous
      ).rejects.toThrow(/ambiguous/i);
    });

    it('returns null for non-existent short ID', async () => {
      const resolved = await taskService.resolveTask('999', boardId);
      expect(resolved).toBeNull();
    });
  });
});
```

---

## 10. Acceptance Criteria

- [ ] New tasks automatically get `boardTaskId`
- [ ] IDs increment within board scope
- [ ] **IDs are never reused** (deletion doesn't free IDs)
- [ ] Concurrent task creation doesn't cause ID collisions
- [ ] CLI accepts both short ID and ULID
- [ ] CLI accepts partial ULID (4+ chars)
- [ ] MCP tools return `shortId` and `displayId`
- [ ] Migration populates IDs for existing tasks
- [ ] Tests cover all resolution scenarios
- [ ] Tests cover concurrency scenarios
