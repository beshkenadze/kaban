# SPEC-005: Extended Link Types

**Status**: Draft  
**Priority**: P2 (Medium)  
**Complexity**: Low  
**Estimated effort**: 0.5 day  
**Source**: Cainban

---

## 1. Overview

Extend task relationship types from one (`dependsOn` array) to three distinct link types stored in a dedicated table.

### Current State
```typescript
// Current: single type stored in JSON array
task.dependsOn: string[]  // Array of task IDs
```

### Target State
```typescript
// After: dedicated table with 3 link types
interface TaskLink {
  fromTaskId: string;
  toTaskId: string;
  type: 'blocks' | 'blocked_by' | 'related';
}
```

### Design Decision: 3 Types, Not 4

**Removed:** `depends_on` type

**Reason:** `depends_on` is semantically identical to `blocked_by`:
- "A depends on B" = "A is blocked by B" = "B blocks A"

Having both causes confusion and complicates queries. Use `blocked_by` for the directional relationship.

---

## 2. Link Types

| Type | Direction | Meaning | Blocks Movement? | Inverse |
|------|-----------|---------|------------------|---------|
| `blocks` | A → B | A blocks B (A must finish first) | Yes (B blocked) | `blocked_by` |
| `blocked_by` | A → B | A is blocked by B (B must finish first) | Yes (A blocked) | `blocks` |
| `related` | A ↔ B | A and B are related (informational only) | No | `related` |

### Semantic Equivalence
```
A blocks B  ≡  B blocked_by A

When creating "A blocks B":
  1. Insert (A, B, 'blocks')
  2. Auto-insert (B, A, 'blocked_by')
```

### Why Not Separate `depends_on`?
- `depends_on` = `blocked_by` semantically
- "Task A depends on Task B" means "Task A cannot start until Task B is complete"
- This is exactly what `blocked_by` means
- Having both confuses users and AI agents
- **Use `blocked_by` for all dependency relationships**

---

## 3. Database Schema

### New Table: `task_links`

```sql
CREATE TABLE task_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  to_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('blocks', 'blocked_by', 'related')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(from_task_id, to_task_id, link_type)
);

CREATE INDEX idx_task_links_from ON task_links(from_task_id);
CREATE INDEX idx_task_links_to ON task_links(to_task_id);
CREATE INDEX idx_task_links_type ON task_links(link_type);
```

### Drizzle Schema

```typescript
// packages/core/src/db/schema.ts

export const linkTypes = ['blocks', 'blocked_by', 'related'] as const;
export type LinkType = typeof linkTypes[number];

export const taskLinks = sqliteTable("task_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromTaskId: text("from_task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  toTaskId: text("to_task_id").notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  linkType: text("link_type", { enum: linkTypes }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  unique: unique().on(table.fromTaskId, table.toTaskId, table.linkType),
}));
```

---

## 4. Migration Strategy

### Full Migration (Recommended)

**Goal:** Migrate existing `dependsOn` data to `task_links` table and **remove** the `dependsOn` column.

### Migration Steps

```sql
-- drizzle/0007_task_links.sql

-- Step 1: Create new table
CREATE TABLE task_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  to_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('blocks', 'blocked_by', 'related')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(from_task_id, to_task_id, link_type)
);

CREATE INDEX idx_task_links_from ON task_links(from_task_id);
CREATE INDEX idx_task_links_to ON task_links(to_task_id);
CREATE INDEX idx_task_links_type ON task_links(link_type);

-- Step 2: Migrate data (done in application code, see below)

-- Step 3: Drop old column (after verifying migration)
-- ALTER TABLE tasks DROP COLUMN depends_on;
-- Note: SQLite doesn't support DROP COLUMN directly; requires table recreation
```

### Application Migration Code

```typescript
// packages/core/src/db/migrations/migrate-depends-on.ts

import { db } from '../index';
import { tasks, taskLinks } from '../schema';
import { eq } from 'drizzle-orm';

export async function migrateDependsOnToLinks(): Promise<{
  tasksProcessed: number;
  linksCreated: number;
  errors: string[];
}> {
  const result = { tasksProcessed: 0, linksCreated: 0, errors: [] as string[] };
  
  // Get all tasks with non-empty dependsOn
  const tasksWithDeps = await db
    .select({ id: tasks.id, dependsOn: tasks.dependsOn })
    .from(tasks)
    .where(sql`json_array_length(${tasks.dependsOn}) > 0`);
  
  for (const task of tasksWithDeps) {
    result.tasksProcessed++;
    
    try {
      const depIds = JSON.parse(task.dependsOn || '[]') as string[];
      
      for (const depId of depIds) {
        // Create blocked_by link (task is blocked by depId)
        await db.insert(taskLinks).values({
          fromTaskId: task.id,
          toTaskId: depId,
          linkType: 'blocked_by',
        }).onConflictDoNothing();
        
        // Create inverse blocks link
        await db.insert(taskLinks).values({
          fromTaskId: depId,
          toTaskId: task.id,
          linkType: 'blocks',
        }).onConflictDoNothing();
        
        result.linksCreated += 2;
      }
    } catch (error) {
      result.errors.push(`Task ${task.id}: ${error.message}`);
    }
  }
  
  return result;
}

// Run migration
export async function runMigration(): Promise<void> {
  console.log('Migrating dependsOn to task_links...');
  const result = await migrateDependsOnToLinks();
  
  console.log(`Tasks processed: ${result.tasksProcessed}`);
  console.log(`Links created: ${result.linksCreated}`);
  
  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
    throw new Error('Migration completed with errors');
  }
  
  console.log('Migration complete. You can now remove the dependsOn column.');
}
```

### Table Recreation (to remove column)

```sql
-- After verifying migration, recreate table without dependsOn
-- This is required because SQLite doesn't support DROP COLUMN

-- Step 1: Create new table without dependsOn
CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  board_task_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  column_id TEXT NOT NULL REFERENCES columns(id),
  -- ... other columns EXCEPT depends_on
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- Step 2: Copy data
INSERT INTO tasks_new SELECT 
  id, board_task_id, title, description, column_id, /* ... */
FROM tasks;

-- Step 3: Drop old table
DROP TABLE tasks;

-- Step 4: Rename new table
ALTER TABLE tasks_new RENAME TO tasks;

-- Step 5: Recreate indexes
-- ...
```

---

## 5. LinkService

```typescript
// packages/core/src/services/link.ts

export interface TaskLink {
  id: number;
  fromTaskId: string;
  toTaskId: string;
  linkType: LinkType;
  createdAt: Date;
}

export interface CreateLinkInput {
  fromTaskId: string;
  toTaskId: string;
  linkType: LinkType;
}

export class LinkService {
  constructor(private db: Database) {}

  /**
   * Create a link between two tasks.
   * Automatically creates inverse link for blocks/blocked_by.
   */
  async createLink(input: CreateLinkInput): Promise<TaskLink> {
    const { fromTaskId, toTaskId, linkType } = input;
    
    // Validate tasks exist
    await this.validateTaskExists(fromTaskId);
    await this.validateTaskExists(toTaskId);
    
    // Check for cycles (for blocking types only)
    if (linkType !== 'related') {
      await this.checkForCycle(fromTaskId, toTaskId, linkType);
    }
    
    // Create link
    const [link] = await this.db.insert(taskLinks).values(input).returning();
    
    // Create inverse link for blocks/blocked_by
    if (linkType === 'blocks') {
      await this.db.insert(taskLinks).values({
        fromTaskId: toTaskId,
        toTaskId: fromTaskId,
        linkType: 'blocked_by',
      }).onConflictDoNothing();
    } else if (linkType === 'blocked_by') {
      await this.db.insert(taskLinks).values({
        fromTaskId: toTaskId,
        toTaskId: fromTaskId,
        linkType: 'blocks',
      }).onConflictDoNothing();
    }
    // 'related' links are bidirectional by nature, no inverse needed
    
    return link;
  }

  /**
   * Remove a link between tasks.
   * Automatically removes inverse link.
   */
  async removeLink(fromTaskId: string, toTaskId: string, linkType?: LinkType): Promise<void> {
    // Remove direct link
    await this.db.delete(taskLinks)
      .where(and(
        eq(taskLinks.fromTaskId, fromTaskId),
        eq(taskLinks.toTaskId, toTaskId),
        linkType ? eq(taskLinks.linkType, linkType) : undefined,
      ));
    
    // Remove inverse link
    await this.db.delete(taskLinks)
      .where(and(
        eq(taskLinks.fromTaskId, toTaskId),
        eq(taskLinks.toTaskId, fromTaskId),
      ));
  }

  /**
   * Get all links for a task, grouped by type.
   */
  async getTaskLinks(taskId: string): Promise<{
    blocks: TaskLink[];
    blockedBy: TaskLink[];
    related: TaskLink[];
  }> {
    const outgoing = await this.db.select()
      .from(taskLinks)
      .where(eq(taskLinks.fromTaskId, taskId));
    
    return {
      blocks: outgoing.filter(l => l.linkType === 'blocks'),
      blockedBy: outgoing.filter(l => l.linkType === 'blocked_by'),
      related: outgoing.filter(l => l.linkType === 'related'),
    };
  }

  /**
   * Check if a task is blocked by any incomplete tasks.
   */
  async isBlocked(taskId: string): Promise<boolean> {
    const blockers = await this.db.select()
      .from(taskLinks)
      .innerJoin(tasks, eq(taskLinks.toTaskId, tasks.id))
      .where(and(
        eq(taskLinks.fromTaskId, taskId),
        eq(taskLinks.linkType, 'blocked_by'),
        isNull(tasks.completedAt)  // Blocker not completed
      ))
      .limit(1);
    
    return blockers.length > 0;
  }

  /**
   * Get incomplete blocking tasks.
   */
  async getBlockers(taskId: string): Promise<Task[]> {
    const result = await this.db.select({ task: tasks })
      .from(taskLinks)
      .innerJoin(tasks, eq(taskLinks.toTaskId, tasks.id))
      .where(and(
        eq(taskLinks.fromTaskId, taskId),
        eq(taskLinks.linkType, 'blocked_by'),
        isNull(tasks.completedAt)
      ));
    
    return result.map(r => r.task);
  }

  private async checkForCycle(fromTaskId: string, toTaskId: string, linkType: LinkType): Promise<void> {
    // Use cycle detection from SPEC-004
    const wouldBlock = linkType === 'blocks' 
      ? { taskId: toTaskId, byId: fromTaskId }
      : { taskId: fromTaskId, byId: toTaskId };
    
    const cyclePath = await this.findCyclePath(wouldBlock.taskId, wouldBlock.byId);
    
    if (cyclePath) {
      throw new CyclicDependencyError(
        `Cannot add link: would create cycle`,
        cyclePath
      );
    }
  }

  private async validateTaskExists(taskId: string): Promise<void> {
    const task = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
  }
}
```

---

## 6. CLI Integration

```bash
# Create links (3 types)
kaban link add 12 15 --type blocks      # #12 blocks #15
kaban link add 12 15 --type blocked-by  # #12 is blocked by #15
kaban link add 12 15 --type related     # #12 related to #15

# Shorthand syntax
kaban link 12 blocks 15
kaban link 12 blocked-by 15
kaban link 12 related 15

# Remove link (removes inverse automatically)
kaban link remove 12 15

# List links for task
kaban link list 12

# Output:
Task #12 links:
  Blocks:
    #15 - Setup CI/CD
    #18 - Deploy to prod
  Blocked by:
    #10 - Design review
  Related:
    #20 - Update docs
```

---

## 7. MCP Tools

```typescript
// Tool: create_task_link
{
  name: "kaban_create_link",
  description: "Create a link between two tasks. Use 'blocked_by' for dependencies (not 'depends_on').",
  parameters: {
    fromTaskId: { type: "string", description: "Source task ID" },
    toTaskId: { type: "string", description: "Target task ID" },
    linkType: { 
      type: "string", 
      enum: ["blocks", "blocked_by", "related"],
      description: "Type of link. Use 'blocked_by' when fromTask needs toTask to complete first."
    }
  }
}

// Tool: get_task_links
{
  name: "kaban_get_task_links",
  description: "Get all links for a task",
  parameters: {
    taskId: { type: "string" }
  }
}

// Tool: remove_task_link
{
  name: "kaban_remove_link",
  description: "Remove a link between tasks (removes inverse automatically)",
  parameters: {
    fromTaskId: { type: "string" },
    toTaskId: { type: "string" }
  }
}
```

---

## 8. Task Display Updates

```typescript
// Include link info in task output

interface TaskWithLinks extends Task {
  links: {
    blocks: string[];      // Task IDs this task blocks
    blockedBy: string[];   // Task IDs blocking this task
    related: string[];     // Related task IDs
  };
  isBlocked: boolean;
}

// CLI task show output:
// Task #12: Implement auth
// ━━━━━━━━━━━━━━━━━━━━━━━━
// Status:     blocked ⚠️
// Blocked by: #10 (Design review)
// Blocks:     #15, #18
// Related:    #20
```

---

## 9. Testing

```typescript
describe('LinkService', () => {
  describe('createLink', () => {
    it('creates blocks link with inverse blocked_by', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'blocks',
      });
      
      const aLinks = await linkService.getTaskLinks(taskA.id);
      const bLinks = await linkService.getTaskLinks(taskB.id);
      
      expect(aLinks.blocks).toHaveLength(1);
      expect(aLinks.blocks[0].toTaskId).toBe(taskB.id);
      expect(bLinks.blockedBy).toHaveLength(1);
      expect(bLinks.blockedBy[0].toTaskId).toBe(taskA.id);
    });

    it('creates blocked_by link with inverse blocks', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'blocked_by',
      });
      
      const aLinks = await linkService.getTaskLinks(taskA.id);
      const bLinks = await linkService.getTaskLinks(taskB.id);
      
      expect(aLinks.blockedBy).toHaveLength(1);
      expect(bLinks.blocks).toHaveLength(1);
    });

    it('prevents cycles for blocking links', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'blocks',
      });
      
      await expect(
        linkService.createLink({
          fromTaskId: taskB.id,
          toTaskId: taskA.id,
          linkType: 'blocks',
        })
      ).rejects.toThrow(CyclicDependencyError);
    });

    it('allows related links without cycle check', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'related',
      });
      
      // Should not throw - related links don't create cycles
      await linkService.createLink({
        fromTaskId: taskB.id,
        toTaskId: taskA.id,
        linkType: 'related',
      });
    });

    it('prevents duplicate links', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'blocks',
      });
      
      await expect(
        linkService.createLink({
          fromTaskId: taskA.id,
          toTaskId: taskB.id,
          linkType: 'blocks',
        })
      ).rejects.toThrow(/unique|duplicate/i);
    });
  });

  describe('removeLink', () => {
    it('removes both direct and inverse links', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'blocks',
      });
      
      await linkService.removeLink(taskA.id, taskB.id);
      
      const aLinks = await linkService.getTaskLinks(taskA.id);
      const bLinks = await linkService.getTaskLinks(taskB.id);
      
      expect(aLinks.blocks).toHaveLength(0);
      expect(bLinks.blockedBy).toHaveLength(0);
    });
  });

  describe('isBlocked', () => {
    it('returns true when blocked by incomplete task', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'blocked_by',
      });
      
      expect(await linkService.isBlocked(taskA.id)).toBe(true);
    });

    it('returns false when blocker is completed', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'blocked_by',
      });
      
      await taskService.completeTask(taskB.id);
      
      expect(await linkService.isBlocked(taskA.id)).toBe(false);
    });

    it('returns false for tasks with only related links', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'related',
      });
      
      expect(await linkService.isBlocked(taskA.id)).toBe(false);
    });
  });

  describe('cascade delete', () => {
    it('removes links when task is deleted', async () => {
      await linkService.createLink({
        fromTaskId: taskA.id,
        toTaskId: taskB.id,
        linkType: 'blocks',
      });
      
      // Delete task A
      await taskService.deleteTask(taskA.id);
      
      // B should no longer show as blocked
      const bLinks = await linkService.getTaskLinks(taskB.id);
      expect(bLinks.blockedBy).toHaveLength(0);
      
      // Direct query should return nothing
      const remainingLinks = await db.select()
        .from(taskLinks)
        .where(or(
          eq(taskLinks.fromTaskId, taskA.id),
          eq(taskLinks.toTaskId, taskA.id)
        ));
      expect(remainingLinks).toHaveLength(0);
    });

    it('removes all links when deleting task with multiple links', async () => {
      // A blocks B, C; A is blocked by D; A related to E
      await linkService.createLink({ fromTaskId: taskA.id, toTaskId: taskB.id, linkType: 'blocks' });
      await linkService.createLink({ fromTaskId: taskA.id, toTaskId: taskC.id, linkType: 'blocks' });
      await linkService.createLink({ fromTaskId: taskA.id, toTaskId: taskD.id, linkType: 'blocked_by' });
      await linkService.createLink({ fromTaskId: taskA.id, toTaskId: taskE.id, linkType: 'related' });
      
      await taskService.deleteTask(taskA.id);
      
      // All related tasks should have no links to A
      for (const task of [taskB, taskC, taskD, taskE]) {
        const links = await linkService.getTaskLinks(task.id);
        const allLinks = [...links.blocks, ...links.blockedBy, ...links.related];
        const linksToA = allLinks.filter(l => l.toTaskId === taskA.id || l.fromTaskId === taskA.id);
        expect(linksToA).toHaveLength(0);
      }
    });
  });

  describe('migration', () => {
    it('migrates dependsOn to task_links', async () => {
      // Create task with old-style dependsOn
      const taskA = await db.insert(tasks).values({
        id: ulid(),
        title: 'A',
        dependsOn: JSON.stringify([taskB.id, taskC.id]),
      }).returning().get();
      
      // Run migration
      const result = await migrateDependsOnToLinks();
      
      expect(result.tasksProcessed).toBe(1);
      expect(result.linksCreated).toBe(4);  // 2 blocked_by + 2 blocks (inverses)
      
      // Verify links
      const aLinks = await linkService.getTaskLinks(taskA.id);
      expect(aLinks.blockedBy).toHaveLength(2);
    });
  });
});
```

---

## 10. Acceptance Criteria

- [ ] `task_links` table created with correct schema
- [ ] Migration from `dependsOn` to `task_links` works
- [ ] Old `dependsOn` column removed after migration
- [ ] Creating `blocks` auto-creates inverse `blocked_by`
- [ ] Creating `blocked_by` auto-creates inverse `blocks`
- [ ] Cycle detection works for blocking link types
- [ ] `related` links don't trigger cycle detection
- [ ] `ON DELETE CASCADE` removes links when task deleted
- [ ] CLI commands `link add/remove/list` work
- [ ] MCP tools available with correct enum values
- [ ] `isBlocked()` only considers incomplete blockers
- [ ] Tests cover all link types and cascade scenarios
