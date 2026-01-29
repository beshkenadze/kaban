# SPEC-004: Dependency Cycle Detection

**Status**: Draft  
**Priority**: P2 (Medium)  
**Complexity**: Low  
**Estimated effort**: 0.5 day  
**Source**: kanban-tui

---

## 1. Overview

DFS-based check for cyclic dependencies before creating a link between tasks.

### Problem
```
# Currently possible to create a cycle:
Task A depends_on Task B
Task B depends_on Task C
Task C depends_on Task A  # Cycle! All tasks blocked forever
```

### Solution
```
# After:
kaban dependency add A C
Error: Cannot add dependency - would create cycle: #A → #B → #C → #A
```

### Goals
- Prevent cyclic dependencies
- Clear error message showing the cycle path
- O(V+E) check (no performance impact)

### Non-Goals
- Dependency graph visualization (future feature)

---

## 2. Algorithm

### DFS Cycle Detection

```typescript
// packages/core/src/services/dependency.ts

/**
 * Check if adding dependency would create a cycle.
 * Uses DFS to traverse from dependsOnId and see if we can reach taskId.
 * 
 * @param taskId - Task that will depend on another
 * @param dependsOnId - Task that will become a dependency
 * @param getDependencies - Function to get task's dependencies
 * @returns true if cycle would be created
 */
function wouldCreateCycle(
  taskId: string,
  dependsOnId: string,
  getDependencies: (id: string) => string[]
): boolean {
  // Self-dependency is always a cycle
  if (taskId === dependsOnId) return true;
  
  // DFS from dependsOnId to see if we can reach taskId
  const visited = new Set<string>();
  const stack = [dependsOnId];
  
  while (stack.length > 0) {
    const current = stack.pop()!;
    
    // Found cycle - we can reach taskId from dependsOnId
    if (current === taskId) return true;
    
    // Already visited - skip
    if (visited.has(current)) continue;
    visited.add(current);
    
    // Add dependencies to stack
    const deps = getDependencies(current);
    stack.push(...deps);
  }
  
  return false;
}
```

### Find Cycle Path (for error message)

```typescript
/**
 * Find the cycle path if it exists.
 * Returns the path showing the cycle, or null if no cycle.
 * 
 * @returns Array of task IDs forming the cycle, e.g., ['A', 'B', 'C', 'A']
 */
function findCyclePath(
  taskId: string,
  dependsOnId: string,
  getDependencies: (id: string) => string[]
): string[] | null {
  // Self-dependency
  if (taskId === dependsOnId) return [taskId, taskId];
  
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const stack = [dependsOnId];
  
  // Virtual edge we're trying to add: taskId -> dependsOnId
  parent.set(dependsOnId, taskId);
  
  while (stack.length > 0) {
    const current = stack.pop()!;
    
    if (current === taskId) {
      // Reconstruct path from taskId back to taskId
      const path: string[] = [current];
      let node = current;
      
      while (parent.has(node)) {
        node = parent.get(node)!;
        path.push(node);
        if (node === taskId && path.length > 1) break;
      }
      
      return path.reverse();
    }
    
    if (visited.has(current)) continue;
    visited.add(current);
    
    for (const dep of getDependencies(current)) {
      if (!visited.has(dep)) {
        parent.set(dep, current);
        stack.push(dep);
      }
    }
  }
  
  return null;
}
```

---

## 3. Integration

### 3.1 TaskService Update

**Note:** No caching - direct DB query is fast enough for typical board sizes (<1000 tasks).

```typescript
// packages/core/src/services/task.ts

export class TaskService {
  /**
   * Add a dependency between tasks.
   * Validates both tasks exist and checks for cycles.
   */
  async addDependency(taskId: string, dependsOnId: string): Promise<void> {
    // Validate tasks exist
    const task = await this.getTask(taskId);
    const dependsOn = await this.getTask(dependsOnId);
    
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!dependsOn) throw new Error(`Task not found: ${dependsOnId}`);
    
    // Check for existing dependency
    if (task.dependsOn.includes(dependsOnId)) {
      throw new Error(`Dependency already exists: ${this.formatTaskRef(task)} → ${this.formatTaskRef(dependsOn)}`);
    }
    
    // Check for cycle
    // Load all dependencies from DB (no caching - direct query is fast)
    const allTasks = await this.getAllTasksWithDependencies();
    const depsMap = new Map<string, string[]>();
    for (const t of allTasks) {
      depsMap.set(t.id, t.dependsOn);
    }
    
    const cyclePath = findCyclePath(
      taskId,
      dependsOnId,
      (id) => depsMap.get(id) ?? []
    );
    
    if (cyclePath) {
      // Format path with short IDs for readability
      const pathStr = await this.formatCyclePath(cyclePath);
      throw new CyclicDependencyError(
        `Cannot add dependency: would create cycle: ${pathStr}`,
        cyclePath
      );
    }
    
    // Add dependency
    const newDependsOn = [...task.dependsOn, dependsOnId];
    await this.updateTask(taskId, { dependsOn: newDependsOn });
  }

  private async formatCyclePath(path: string[]): Promise<string> {
    const tasks = await this.getTasksByIds(path);
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    return path
      .map(id => {
        const t = taskMap.get(id);
        return t ? `#${t.boardTaskId}` : id.slice(0, 8);
      })
      .join(' → ');
  }

  private formatTaskRef(task: Task): string {
    return `#${task.boardTaskId} (${task.title.slice(0, 30)}${task.title.length > 30 ? '...' : ''})`;
  }
}
```

### 3.2 Custom Error

```typescript
// packages/core/src/errors.ts

export class CyclicDependencyError extends Error {
  constructor(
    message: string,
    public readonly cyclePath: string[]
  ) {
    super(message);
    this.name = 'CyclicDependencyError';
  }
}
```

### 3.3 Performance Considerations

**Why no caching:**
- SQLite query for 1000 tasks with dependencies: < 10ms
- Caching adds complexity without meaningful benefit
- Cache invalidation is error-prone in multi-process scenarios (CLI + TUI)
- KISS principle: direct query is simpler and reliable

**When to consider caching (future):**
- Boards with > 5000 tasks
- Real-time collaborative editing
- Until then, direct query is the right approach

---

## 4. CLI Integration

```bash
# Add dependency
kaban dependency add <task-id> <depends-on-id>
kaban dep add 12 15  # Task #12 depends on #15

# Error output
$ kaban dep add 12 10
Error: Cannot add dependency: would create cycle: #12 → #15 → #10 → #12

# List dependencies
kaban dependency list <task-id>
kaban dep list 12

# Output:
Task #12 depends on:
  #15 - Implement auth API
  #18 - Setup database

Tasks blocked by #12:
  #20 - Integration tests

# Remove dependency
kaban dependency remove <task-id> <depends-on-id>
kaban dep rm 12 15
```

---

## 5. MCP Integration

```typescript
// Tool: add_dependency
{
  name: "kaban_add_dependency",
  description: "Add a dependency between tasks. Returns error if would create cycle.",
  parameters: {
    taskId: { type: "string", description: "Task that will depend on another" },
    dependsOnId: { type: "string", description: "Task that must complete first" }
  }
}

// Response on success
{
  success: true,
  message: "Dependency added: #12 depends on #15"
}

// Response on cycle
{
  success: false,
  error: "CyclicDependencyError",
  message: "Cannot add dependency: would create cycle: #12 → #15 → #10 → #12",
  cyclePath: ["01JJX...", "01JJY...", "01JJZ...", "01JJX..."]
}
```

---

## 6. Validation on Task Move

```typescript
// packages/core/src/services/task.ts

/**
 * When moving task to "in-progress", check if dependencies are complete.
 */
async moveTask(taskId: string, columnId: string): Promise<void> {
  const task = await this.getTask(taskId);
  const column = await this.getColumn(columnId);
  const board = await this.getBoard(column.boardId);
  
  // Check if this is a "work" column (not backlog, not done)
  const isWorkColumn = !column.isTerminal && column.id !== board.backlogColumnId;
  
  if (isWorkColumn) {
    const blockers = await this.getUnresolvedDependencies(taskId);
    
    if (blockers.length > 0) {
      const blockerRefs = blockers
        .map(t => `#${t.boardTaskId} (${t.title.slice(0, 20)}...)`)
        .join(', ');
      
      throw new Error(
        `Cannot start task #${task.boardTaskId}: blocked by unfinished tasks: ${blockerRefs}`
      );
    }
  }
  
  // Proceed with move
  await this.updateTask(taskId, { columnId });
}

async getUnresolvedDependencies(taskId: string): Promise<Task[]> {
  const task = await this.getTask(taskId);
  if (!task || task.dependsOn.length === 0) return [];
  
  const dependencies = await this.getTasksByIds(task.dependsOn);
  
  // Filter to only incomplete dependencies
  return dependencies.filter(dep => !dep.completedAt);
}
```

---

## 7. Testing

```typescript
describe('Cycle Detection', () => {
  describe('wouldCreateCycle', () => {
    const deps: Record<string, string[]> = {
      'A': ['B'],
      'B': ['C'],
      'C': [],
    };
    const getDeps = (id: string) => deps[id] ?? [];

    it('detects self-dependency', () => {
      expect(wouldCreateCycle('A', 'A', getDeps)).toBe(true);
    });

    it('detects direct cycle (A→B, add B→A)', () => {
      expect(wouldCreateCycle('B', 'A', getDeps)).toBe(true);
    });

    it('detects indirect cycle (A→B→C, add C→A)', () => {
      expect(wouldCreateCycle('C', 'A', getDeps)).toBe(true);
    });

    it('allows valid dependency (no cycle)', () => {
      deps['D'] = [];
      expect(wouldCreateCycle('D', 'C', getDeps)).toBe(false);
    });

    it('handles disconnected graph', () => {
      deps['X'] = ['Y'];
      deps['Y'] = [];
      // X→Y is disconnected from A→B→C
      expect(wouldCreateCycle('X', 'C', getDeps)).toBe(false);
    });
  });

  describe('findCyclePath', () => {
    it('returns path for direct cycle', () => {
      const deps = { 'A': ['B'], 'B': [] };
      const path = findCyclePath('B', 'A', id => deps[id] ?? []);
      expect(path).toEqual(['A', 'B', 'A']);
    });

    it('returns path for indirect cycle', () => {
      const deps = { 'A': ['B'], 'B': ['C'], 'C': [] };
      const path = findCyclePath('C', 'A', id => deps[id] ?? []);
      expect(path).toEqual(['A', 'B', 'C', 'A']);
    });

    it('returns path for self-dependency', () => {
      const path = findCyclePath('A', 'A', () => []);
      expect(path).toEqual(['A', 'A']);
    });

    it('returns null when no cycle', () => {
      const deps = { 'A': ['B'], 'B': [] };
      const path = findCyclePath('C', 'A', id => deps[id] ?? []);
      expect(path).toBeNull();
    });

    it('handles long chain (10+ nodes)', () => {
      // A → B → C → D → E → F → G → H → I → J
      const deps: Record<string, string[]> = {};
      const nodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      
      for (let i = 0; i < nodes.length - 1; i++) {
        deps[nodes[i]] = [nodes[i + 1]];
      }
      deps['J'] = [];
      
      // Try to add J → A (would create cycle through entire chain)
      const path = findCyclePath('J', 'A', id => deps[id] ?? []);
      
      expect(path).not.toBeNull();
      expect(path).toHaveLength(11); // A→B→C→D→E→F→G→H→I→J→A
      expect(path![0]).toBe('A');
      expect(path![path!.length - 1]).toBe('A');
    });

    it('handles diamond dependency pattern', () => {
      // A → B → D
      // A → C → D
      const deps = {
        'A': ['B', 'C'],
        'B': ['D'],
        'C': ['D'],
        'D': [],
      };
      
      // No cycle should be detected
      expect(wouldCreateCycle('E', 'D', id => deps[id] ?? [])).toBe(false);
      
      // But D → A would create cycle
      expect(wouldCreateCycle('D', 'A', id => deps[id] ?? [])).toBe(true);
    });
  });

  describe('TaskService.addDependency', () => {
    it('throws CyclicDependencyError on cycle', async () => {
      const taskA = await taskService.addTask({ title: 'A' });
      const taskB = await taskService.addTask({ title: 'B' });
      
      await taskService.addDependency(taskA.id, taskB.id);  // A → B
      
      await expect(
        taskService.addDependency(taskB.id, taskA.id)  // B → A (cycle!)
      ).rejects.toThrow(CyclicDependencyError);
    });

    it('error message includes readable path with short IDs', async () => {
      const taskA = await taskService.addTask({ title: 'Task A' });
      const taskB = await taskService.addTask({ title: 'Task B' });
      const taskC = await taskService.addTask({ title: 'Task C' });
      
      await taskService.addDependency(taskA.id, taskB.id);  // A → B
      await taskService.addDependency(taskB.id, taskC.id);  // B → C
      
      try {
        await taskService.addDependency(taskC.id, taskA.id);  // C → A (cycle!)
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CyclicDependencyError);
        expect(error.message).toMatch(/#\d+ → #\d+ → #\d+ → #\d+/);
      }
    });

    it('allows adding valid dependency', async () => {
      const taskA = await taskService.addTask({ title: 'A' });
      const taskB = await taskService.addTask({ title: 'B' });
      const taskC = await taskService.addTask({ title: 'C' });
      
      await taskService.addDependency(taskA.id, taskB.id);  // A → B
      await taskService.addDependency(taskA.id, taskC.id);  // A → C (no cycle, same level)
      
      const task = await taskService.getTask(taskA.id);
      expect(task.dependsOn).toContain(taskB.id);
      expect(task.dependsOn).toContain(taskC.id);
    });

    it('prevents duplicate dependency', async () => {
      const taskA = await taskService.addTask({ title: 'A' });
      const taskB = await taskService.addTask({ title: 'B' });
      
      await taskService.addDependency(taskA.id, taskB.id);
      
      await expect(
        taskService.addDependency(taskA.id, taskB.id)
      ).rejects.toThrow(/already exists/i);
    });
  });

  describe('Move validation', () => {
    it('blocks move to in-progress when dependencies incomplete', async () => {
      const taskA = await taskService.addTask({ title: 'A', columnId: 'todo' });
      const taskB = await taskService.addTask({ title: 'B', columnId: 'todo' });
      
      await taskService.addDependency(taskA.id, taskB.id);  // A depends on B
      
      await expect(
        taskService.moveTask(taskA.id, 'in-progress')
      ).rejects.toThrow(/blocked by unfinished/i);
    });

    it('allows move when dependencies complete', async () => {
      const taskA = await taskService.addTask({ title: 'A', columnId: 'todo' });
      const taskB = await taskService.addTask({ title: 'B', columnId: 'todo' });
      
      await taskService.addDependency(taskA.id, taskB.id);  // A depends on B
      await taskService.completeTask(taskB.id);  // Complete B
      
      // Should not throw
      await taskService.moveTask(taskA.id, 'in-progress');
      
      const task = await taskService.getTask(taskA.id);
      expect(task.columnId).toBe('in-progress');
    });
  });
});
```

---

## 8. Acceptance Criteria

- [ ] `wouldCreateCycle()` detects cycles in O(V+E)
- [ ] `findCyclePath()` returns human-readable cycle path
- [ ] `addDependency()` throws `CyclicDependencyError` when cycle detected
- [ ] Error message includes short IDs (`#12 → #15 → #10 → #12`)
- [ ] CLI shows clear error message with cycle path
- [ ] MCP tool returns structured error with cycle info
- [ ] Moving task to "in-progress" validates dependencies
- [ ] Self-dependency is detected and rejected
- [ ] Long chains (10+ nodes) are handled correctly
- [ ] Diamond patterns don't cause false positives
- [ ] Tests cover all edge cases
