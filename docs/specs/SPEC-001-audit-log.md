# SPEC-001: Audit Log via SQLite Triggers

**Status**: Draft  
**Priority**: P1 (High)  
**Complexity**: Low  
**Estimated effort**: 0.5-1 day  
**Source**: kanban-tui

---

## 1. Overview

Automatic logging of all database changes via SQLite triggers. Zero application code overhead - triggers operate at the database level.

### Goals
- Complete change history for tasks, columns, boards
- Zero overhead in application code
- Support for rollback/audit capabilities
- AI-agent friendly (understand "what changed")
- Track WHO made changes (user, agent, system)

### Non-Goals
- UI for viewing history (Phase 2)
- Rollback functionality (Phase 2)

---

## 2. Database Schema

### 2.1 New Table: `audits`

```sql
CREATE TABLE audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATE', 'UPDATE', 'DELETE')),
  object_type TEXT NOT NULL CHECK (object_type IN ('task', 'column', 'board')),
  object_id TEXT NOT NULL,
  field_name TEXT,           -- NULL for CREATE/DELETE, field name for UPDATE
  old_value TEXT,            -- NULL for CREATE
  new_value TEXT,            -- NULL for DELETE
  actor TEXT                 -- Who made the change (user, agent name, system)
);

CREATE INDEX idx_audits_object ON audits(object_type, object_id);
CREATE INDEX idx_audits_timestamp ON audits(timestamp);
```

### 2.2 Actor Tracking Column

To capture WHO made changes, add `updated_by` column to tracked tables:

```sql
-- Add to tasks table
ALTER TABLE tasks ADD COLUMN updated_by TEXT;

-- Add to columns table  
ALTER TABLE columns ADD COLUMN updated_by TEXT;

-- Add to boards table
ALTER TABLE boards ADD COLUMN updated_by TEXT;
```

**Convention:** Application code MUST set `updated_by` before any UPDATE/DELETE operation:
```typescript
// Before updating
await db.update(tasks)
  .set({ title: 'New Title', updatedBy: 'claude' })
  .where(eq(tasks.id, taskId));
```

### 2.3 Drizzle Schema

```typescript
// packages/core/src/db/schema.ts

export const audits = sqliteTable("audits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  eventType: text("event_type", { enum: ["CREATE", "UPDATE", "DELETE"] }).notNull(),
  objectType: text("object_type", { enum: ["task", "column", "board"] }).notNull(),
  objectId: text("object_id").notNull(),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  actor: text("actor"),
});

// Add to existing tables
export const tasks = sqliteTable("tasks", {
  // ... existing fields
  updatedBy: text("updated_by"),  // NEW: for audit actor tracking
});
```

---

## 3. SQLite Triggers

### 3.1 Task Triggers

**Note:** Use explicit NULL comparison for cross-driver compatibility (bun:sqlite + libsql).

```sql
-- CREATE
CREATE TRIGGER audit_task_insert
AFTER INSERT ON tasks
FOR EACH ROW
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, actor, new_value)
  VALUES ('CREATE', 'task', NEW.id, NEW.created_by, NEW.title);
END;

-- DELETE
CREATE TRIGGER audit_task_delete
AFTER DELETE ON tasks
FOR EACH ROW
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, actor, old_value)
  VALUES ('DELETE', 'task', OLD.id, OLD.updated_by, OLD.title);
END;

-- UPDATE (per-field tracking with explicit NULL handling)
CREATE TRIGGER audit_task_update
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
  -- Title changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'title', OLD.title, NEW.title, NEW.updated_by
  WHERE (OLD.title IS NULL AND NEW.title IS NOT NULL)
     OR (OLD.title IS NOT NULL AND NEW.title IS NULL)
     OR (OLD.title <> NEW.title);
  
  -- Description changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'description', OLD.description, NEW.description, NEW.updated_by
  WHERE (OLD.description IS NULL AND NEW.description IS NOT NULL)
     OR (OLD.description IS NOT NULL AND NEW.description IS NULL)
     OR (OLD.description <> NEW.description);
  
  -- Column changed (task moved)
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'column_id', OLD.column_id, NEW.column_id, NEW.updated_by
  WHERE (OLD.column_id IS NULL AND NEW.column_id IS NOT NULL)
     OR (OLD.column_id IS NOT NULL AND NEW.column_id IS NULL)
     OR (OLD.column_id <> NEW.column_id);
  
  -- Assigned to changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'assigned_to', OLD.assigned_to, NEW.assigned_to, NEW.updated_by
  WHERE (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL)
     OR (OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL)
     OR (OLD.assigned_to <> NEW.assigned_to);
  
  -- Archived status changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'archived', OLD.archived, NEW.archived, NEW.updated_by
  WHERE (OLD.archived IS NULL AND NEW.archived IS NOT NULL)
     OR (OLD.archived IS NOT NULL AND NEW.archived IS NULL)
     OR (OLD.archived <> NEW.archived);
  
  -- Labels changed
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'task', OLD.id, 'labels', OLD.labels, NEW.labels, NEW.updated_by
  WHERE (OLD.labels IS NULL AND NEW.labels IS NOT NULL)
     OR (OLD.labels IS NOT NULL AND NEW.labels IS NULL)
     OR (OLD.labels <> NEW.labels);
END;
```

### 3.2 Column Triggers

```sql
CREATE TRIGGER audit_column_insert
AFTER INSERT ON columns
FOR EACH ROW
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, new_value)
  VALUES ('CREATE', 'column', NEW.id, NEW.name);
END;

CREATE TRIGGER audit_column_delete
AFTER DELETE ON columns
FOR EACH ROW
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, actor, old_value)
  VALUES ('DELETE', 'column', OLD.id, OLD.updated_by, OLD.name);
END;

CREATE TRIGGER audit_column_update
AFTER UPDATE ON columns
FOR EACH ROW
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'column', OLD.id, 'name', OLD.name, NEW.name, NEW.updated_by
  WHERE (OLD.name IS NULL AND NEW.name IS NOT NULL)
     OR (OLD.name IS NOT NULL AND NEW.name IS NULL)
     OR (OLD.name <> NEW.name);
  
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'column', OLD.id, 'position', OLD.position, NEW.position, NEW.updated_by
  WHERE (OLD.position IS NULL AND NEW.position IS NOT NULL)
     OR (OLD.position IS NOT NULL AND NEW.position IS NULL)
     OR (OLD.position <> NEW.position);
  
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'column', OLD.id, 'wip_limit', OLD.wip_limit, NEW.wip_limit, NEW.updated_by
  WHERE (OLD.wip_limit IS NULL AND NEW.wip_limit IS NOT NULL)
     OR (OLD.wip_limit IS NOT NULL AND NEW.wip_limit IS NULL)
     OR (OLD.wip_limit <> NEW.wip_limit);
END;
```

### 3.3 Board Triggers

```sql
CREATE TRIGGER audit_board_insert
AFTER INSERT ON boards
FOR EACH ROW
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, new_value)
  VALUES ('CREATE', 'board', NEW.id, NEW.name);
END;

CREATE TRIGGER audit_board_delete
AFTER DELETE ON boards
FOR EACH ROW
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, actor, old_value)
  VALUES ('DELETE', 'board', OLD.id, OLD.updated_by, OLD.name);
END;

CREATE TRIGGER audit_board_update
AFTER UPDATE ON boards
FOR EACH ROW
BEGIN
  INSERT INTO audits (event_type, object_type, object_id, field_name, old_value, new_value, actor)
  SELECT 'UPDATE', 'board', OLD.id, 'name', OLD.name, NEW.name, NEW.updated_by
  WHERE (OLD.name IS NULL AND NEW.name IS NOT NULL)
     OR (OLD.name IS NOT NULL AND NEW.name IS NULL)
     OR (OLD.name <> NEW.name);
END;
```

---

## 4. Migration

```sql
-- drizzle/0004_audit_log.sql

-- Add updated_by columns for actor tracking
ALTER TABLE tasks ADD COLUMN updated_by TEXT;
ALTER TABLE columns ADD COLUMN updated_by TEXT;
ALTER TABLE boards ADD COLUMN updated_by TEXT;

-- Create audits table
CREATE TABLE audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATE', 'UPDATE', 'DELETE')),
  object_type TEXT NOT NULL CHECK (object_type IN ('task', 'column', 'board')),
  object_id TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  actor TEXT
);

CREATE INDEX idx_audits_object ON audits(object_type, object_id);
CREATE INDEX idx_audits_timestamp ON audits(timestamp);

-- Create all triggers (copy from section 3)
-- ... task triggers
-- ... column triggers  
-- ... board triggers
```

---

## 5. Query API

### 5.1 AuditService

```typescript
// packages/core/src/services/audit.ts

export interface AuditEntry {
  id: number;
  timestamp: Date;
  eventType: 'CREATE' | 'UPDATE' | 'DELETE';
  objectType: 'task' | 'column' | 'board';
  objectId: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: string | null;
}

export interface AuditFilter {
  objectType?: 'task' | 'column' | 'board';
  objectId?: string;
  eventType?: 'CREATE' | 'UPDATE' | 'DELETE';
  actor?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

export class AuditService {
  constructor(private db: Database) {}

  async getHistory(filter: AuditFilter): Promise<AuditEntry[]> {
    let query = this.db.select().from(audits);
    
    if (filter.objectType) {
      query = query.where(eq(audits.objectType, filter.objectType));
    }
    if (filter.objectId) {
      query = query.where(eq(audits.objectId, filter.objectId));
    }
    if (filter.eventType) {
      query = query.where(eq(audits.eventType, filter.eventType));
    }
    if (filter.actor) {
      query = query.where(eq(audits.actor, filter.actor));
    }
    if (filter.since) {
      query = query.where(gte(audits.timestamp, filter.since));
    }
    if (filter.until) {
      query = query.where(lte(audits.timestamp, filter.until));
    }
    
    return query
      .orderBy(desc(audits.timestamp))
      .limit(filter.limit ?? 100);
  }

  async getTaskHistory(taskId: string): Promise<AuditEntry[]> {
    return this.getHistory({ objectType: 'task', objectId: taskId });
  }

  async getRecentChanges(limit = 50): Promise<AuditEntry[]> {
    return this.getHistory({ limit });
  }

  async getChangesByActor(actor: string, limit = 50): Promise<AuditEntry[]> {
    return this.getHistory({ actor, limit });
  }
}
```

### 5.2 CLI Commands

```bash
# View recent changes
kaban audit list [--limit 50] [--type task|column|board] [--actor <name>]

# View task history
kaban audit task <task-id>

# View changes since timestamp
kaban audit list --since "2024-01-01"

# View changes by specific actor
kaban audit list --actor claude
```

### 5.3 MCP Tools

```typescript
// Tool: get_audit_history
{
  name: "kaban_get_audit_history",
  description: "Get audit history of changes",
  parameters: {
    objectType: { type: "string", enum: ["task", "column", "board"], optional: true },
    objectId: { type: "string", optional: true },
    actor: { type: "string", optional: true, description: "Filter by who made the change" },
    limit: { type: "number", optional: true, default: 50 }
  }
}

// Tool: get_task_history
{
  name: "kaban_get_task_history",
  description: "Get change history for a specific task",
  parameters: {
    taskId: { type: "string", required: true }
  }
}
```

---

## 6. Implementation Plan

### Phase 1 (This spec)
- [ ] Add `updated_by` columns to tasks, columns, boards
- [ ] Create `audits` table schema
- [ ] Create migration with all triggers
- [ ] Add `AuditService` with basic queries
- [ ] Add CLI `audit` command
- [ ] Add MCP tools

### Phase 2 (Future)
- [ ] TUI view for audit history
- [ ] Rollback functionality
- [ ] Audit retention/cleanup policy
- [ ] Export audit log

---

## 7. Testing

```typescript
describe('AuditService', () => {
  it('logs task creation with actor', async () => {
    await taskService.addTask({ title: 'Test', createdBy: 'user' });
    const history = await auditService.getRecentChanges(1);
    
    expect(history[0].eventType).toBe('CREATE');
    expect(history[0].objectType).toBe('task');
    expect(history[0].actor).toBe('user');
  });

  it('logs task field updates with actor', async () => {
    const task = await taskService.addTask({ title: 'Original' });
    await taskService.updateTask(task.id, { title: 'Updated', updatedBy: 'claude' });
    
    const history = await auditService.getTaskHistory(task.id);
    const updateEntry = history.find(e => e.eventType === 'UPDATE');
    
    expect(updateEntry?.fieldName).toBe('title');
    expect(updateEntry?.oldValue).toBe('Original');
    expect(updateEntry?.newValue).toBe('Updated');
    expect(updateEntry?.actor).toBe('claude');
  });

  it('logs task movement', async () => {
    const task = await taskService.addTask({ title: 'Test', columnId: 'todo' });
    await taskService.moveTask(task.id, 'in-progress', { updatedBy: 'user' });
    
    const history = await auditService.getTaskHistory(task.id);
    const moveEntry = history.find(e => e.fieldName === 'column_id');
    
    expect(moveEntry?.oldValue).toBe('todo');
    expect(moveEntry?.newValue).toBe('in-progress');
  });

  it('handles concurrent modifications correctly', async () => {
    const task = await taskService.addTask({ title: 'Test' });
    
    // Simulate concurrent updates
    await Promise.all([
      taskService.updateTask(task.id, { title: 'Update A', updatedBy: 'agent-1' }),
      taskService.updateTask(task.id, { title: 'Update B', updatedBy: 'agent-2' }),
    ]);
    
    const history = await auditService.getTaskHistory(task.id);
    const updates = history.filter(e => e.eventType === 'UPDATE');
    
    // Both updates should be logged with correct actors
    expect(updates).toHaveLength(2);
    expect(updates.map(u => u.actor).sort()).toEqual(['agent-1', 'agent-2']);
  });

  it('handles NULL to value transitions', async () => {
    const task = await taskService.addTask({ title: 'Test', description: null });
    await taskService.updateTask(task.id, { description: 'Added description' });
    
    const history = await auditService.getTaskHistory(task.id);
    const descUpdate = history.find(e => e.fieldName === 'description');
    
    expect(descUpdate?.oldValue).toBeNull();
    expect(descUpdate?.newValue).toBe('Added description');
  });

  it('handles value to NULL transitions', async () => {
    const task = await taskService.addTask({ title: 'Test', description: 'Has description' });
    await taskService.updateTask(task.id, { description: null });
    
    const history = await auditService.getTaskHistory(task.id);
    const descUpdate = history.find(e => e.fieldName === 'description');
    
    expect(descUpdate?.oldValue).toBe('Has description');
    expect(descUpdate?.newValue).toBeNull();
  });

  it('filters history by actor', async () => {
    await taskService.addTask({ title: 'Task 1', createdBy: 'user' });
    await taskService.addTask({ title: 'Task 2', createdBy: 'claude' });
    await taskService.addTask({ title: 'Task 3', createdBy: 'user' });
    
    const userHistory = await auditService.getChangesByActor('user');
    expect(userHistory).toHaveLength(2);
    expect(userHistory.every(e => e.actor === 'user')).toBe(true);
  });
});
```

---

## 8. Acceptance Criteria

- [ ] All CREATE/UPDATE/DELETE operations are logged automatically
- [ ] Logging works without changes to service code (except setting `updatedBy`)
- [ ] Actor is correctly captured for all operations
- [ ] Can query history by object
- [ ] Can query history by actor
- [ ] Can query general history with filters
- [ ] CLI `audit` command works
- [ ] MCP tools are available
- [ ] Triggers work identically on bun:sqlite and libsql
- [ ] NULL transitions are handled correctly
- [ ] Tests cover main scenarios including concurrency
