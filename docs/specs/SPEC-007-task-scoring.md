# SPEC-007: Task Scoring System

**Status**: Draft  
**Priority**: P2 (Medium)  
**Complexity**: Medium  
**Estimated effort**: 1 day  
**Source**: daikanban

---

## 1. Overview

Pluggable task scoring system for automatic backlog prioritization.

### Goals
- Automatic task sorting by "importance"
- Pluggable scorers (can add custom ones)
- Board-level scorer configuration
- AI-friendly (agents can use scoring for prioritization)

### Non-Goals
- ML-based scoring (future feature)
- Per-user scoring preferences

---

## 2. Scorer Interface

```typescript
// packages/core/src/services/scoring/types.ts

export interface TaskScorer {
  /** Unique identifier */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** Units for display (e.g., "pri/day", "score") */
  units?: string;
  
  /** 
   * Calculate score for task. Higher = more important.
   * 
   * Returns Promise to allow async operations (e.g., fetching related tasks).
   * For sync scorers, simply return Promise.resolve(score).
   */
  score(task: Task): Promise<number>;
}

export interface ScorerConfig {
  /** Which scorer to use */
  scorerName: string;
  
  /** Scorer-specific settings */
  settings?: Record<string, unknown>;
}
```

### Why Async Interface?

The scorer interface uses `Promise<number>` instead of synchronous `number` to support:
1. Scorers that need to fetch related tasks (network effect)
2. Scorers that query external data (e.g., GitHub issue priority)
3. Future ML-based scorers that may call external services

For simple scorers, wrap the return value: `return Promise.resolve(score)` or use `async` function.

---

## 3. Scorer Selection Guide

| Scorer | Best For | Example Use Case |
|--------|----------|------------------|
| `priority` | Simple projects with manual priority labels | Personal todo lists, small teams |
| `due-date` | Deadline-driven work | Sprint planning, release schedules |
| `priority-rate` | Agile teams with story point estimates | Scrum teams, backlog grooming |
| `wsjf` | Enterprise/SAFe environments | Large organizations, portfolio planning |
| `age` | Preventing task starvation | Long-running projects, support queues |
| `combined` | Balanced approach (default) | General purpose, mixed workloads |

---

## 4. Built-in Scorers

### 4.1 Priority Scorer (Default)

```typescript
// packages/core/src/services/scoring/scorers/priority.ts

export const PriorityScorer: TaskScorer = {
  name: 'priority',
  description: 'Sort by priority label (critical > high > medium > low)',
  units: 'pri',
  
  async score(task: Task): Promise<number> {
    const priorityMap: Record<string, number> = {
      'critical': 100,
      'high': 75,
      'medium': 50,
      'low': 25,
      'none': 0,
    };
    
    for (const label of task.labels) {
      const normalized = label.toLowerCase();
      if (normalized in priorityMap) {
        return priorityMap[normalized];
      }
    }
    
    return priorityMap['none'];
  },
};
```

### 4.2 Due Date Scorer

```typescript
// packages/core/src/services/scoring/scorers/due-date.ts

export const DueDateScorer: TaskScorer = {
  name: 'due-date',
  description: 'Sort by due date urgency (closer/overdue = higher score)',
  units: 'urgency',
  
  async score(task: Task): Promise<number> {
    if (!task.dueDate) return 0;
    
    const now = Date.now();
    const due = task.dueDate.getTime();
    const daysUntilDue = (due - now) / (1000 * 60 * 60 * 24);
    
    // Overdue: max score + days overdue
    if (daysUntilDue < 0) return 100 + Math.abs(daysUntilDue);
    
    // Due today/tomorrow: high score
    if (daysUntilDue <= 1) return 90;
    if (daysUntilDue <= 3) return 70;
    if (daysUntilDue <= 7) return 50;
    if (daysUntilDue <= 14) return 30;
    if (daysUntilDue <= 30) return 10;
    
    return 0;
  },
};
```

### 4.3 Priority Rate Scorer (daikanban-style)

```typescript
// packages/core/src/services/scoring/scorers/priority-rate.ts

interface PriorityRateSettings {
  defaultPriority: number;
  defaultDuration: number; // days
}

export function createPriorityRateScorer(
  settings: PriorityRateSettings = { defaultPriority: 1, defaultDuration: 4 }
): TaskScorer {
  return {
    name: 'priority-rate',
    description: 'Priority divided by expected duration (higher rate = do first)',
    units: 'pri/day',
    
    async score(task: Task): Promise<number> {
      // Get priority from labels
      const priorityLabel = task.labels.find(l => 
        ['critical', 'high', 'medium', 'low'].includes(l.toLowerCase())
      );
      const priorityMap = { critical: 4, high: 3, medium: 2, low: 1 };
      const priority = priorityLabel 
        ? priorityMap[priorityLabel.toLowerCase() as keyof typeof priorityMap] 
        : settings.defaultPriority;
      
      // Get duration from label (e.g., "duration:3d") or use default
      const durationLabel = task.labels.find(l => l.startsWith('duration:'));
      let duration = settings.defaultDuration;
      if (durationLabel) {
        const match = durationLabel.match(/duration:(\d+)([dwh])?/);
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2] || 'd';
          duration = unit === 'w' ? value * 7 : unit === 'h' ? value / 24 : value;
        }
      }
      
      // Avoid division by zero
      if (duration <= 0) duration = settings.defaultDuration;
      
      return priority / duration;
    },
  };
}
```

### 4.4 WSJF Scorer (Weighted Shortest Job First)

```typescript
// packages/core/src/services/scoring/scorers/wsjf.ts

export const WSJFScorer: TaskScorer = {
  name: 'wsjf',
  description: 'Weighted Shortest Job First (SAFe methodology)',
  units: 'wsjf',
  
  async score(task: Task): Promise<number> {
    // WSJF = Cost of Delay / Job Size
    // Cost of Delay = User Value + Time Criticality + Risk Reduction
    
    const getValue = (prefix: string, defaultVal: number): number => {
      const label = task.labels.find(l => l.startsWith(prefix));
      if (!label) return defaultVal;
      const match = label.match(/:(\d+)/);
      return match ? parseInt(match[1]) : defaultVal;
    };
    
    const userValue = getValue('value:', 5);      // 1-10
    const timeCriticality = getValue('time:', 5); // 1-10
    const riskReduction = getValue('risk:', 5);   // 1-10
    const jobSize = getValue('size:', 5);         // 1-10 (story points, t-shirt size)
    
    // Avoid division by zero
    const safeJobSize = jobSize > 0 ? jobSize : 1;
    
    const costOfDelay = userValue + timeCriticality + riskReduction;
    return costOfDelay / safeJobSize;
  },
};
```

### 4.5 Age Scorer (FIFO with decay)

```typescript
// packages/core/src/services/scoring/scorers/age.ts

export const AgeScorer: TaskScorer = {
  name: 'age',
  description: 'Older tasks get higher priority (prevent starvation)',
  units: 'days',
  
  async score(task: Task): Promise<number> {
    const ageMs = Date.now() - task.createdAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays;
  },
};
```

### 4.6 Combined Scorer

```typescript
// packages/core/src/services/scoring/scorers/combined.ts

interface CombinedScorerSettings {
  weights: {
    priority: number;
    dueDate: number;
    age: number;
  };
}

export function createCombinedScorer(
  settings: CombinedScorerSettings = { weights: { priority: 0.5, dueDate: 0.3, age: 0.2 } }
): TaskScorer {
  return {
    name: 'combined',
    description: 'Weighted combination of priority, due date, and age',
    units: 'score',
    
    async score(task: Task): Promise<number> {
      const { weights } = settings;
      
      // Collect scores from other scorers
      const [priorityScore, dueDateScore, ageScore] = await Promise.all([
        PriorityScorer.score(task),
        DueDateScorer.score(task),
        AgeScorer.score(task),
      ]);
      
      // Cap age at 100 to normalize scale
      const normalizedAge = Math.min(ageScore, 100);
      
      return (
        weights.priority * priorityScore +
        weights.dueDate * dueDateScore +
        weights.age * normalizedAge
      );
    },
  };
}
```

---

## 5. Scorer Registry

```typescript
// packages/core/src/services/scoring/registry.ts

const BUILT_IN_SCORERS: TaskScorer[] = [
  PriorityScorer,
  DueDateScorer,
  createPriorityRateScorer(),
  WSJFScorer,
  AgeScorer,
  createCombinedScorer(),
];

class ScorerRegistry {
  private scorers = new Map<string, TaskScorer>();
  
  constructor() {
    for (const scorer of BUILT_IN_SCORERS) {
      this.register(scorer);
    }
  }
  
  register(scorer: TaskScorer): void {
    this.scorers.set(scorer.name, scorer);
  }
  
  get(name: string): TaskScorer | undefined {
    return this.scorers.get(name);
  }
  
  list(): TaskScorer[] {
    return Array.from(this.scorers.values());
  }
  
  names(): string[] {
    return Array.from(this.scorers.keys());
  }
}

export const scorerRegistry = new ScorerRegistry();
```

---

## 6. ScoringService

```typescript
// packages/core/src/services/scoring/service.ts

export class ScoringService {
  constructor(
    private registry: ScorerRegistry,
    private config: ScorerConfig = { scorerName: 'combined' }
  ) {}

  setScorer(name: string): void {
    if (!this.registry.get(name)) {
      const available = this.registry.names().join(', ');
      throw new Error(`Unknown scorer: ${name}. Available: ${available}`);
    }
    this.config.scorerName = name;
  }

  getScorer(): TaskScorer {
    return this.registry.get(this.config.scorerName) ?? PriorityScorer;
  }

  getScorerName(): string {
    return this.config.scorerName;
  }

  async scoreTask(task: Task): Promise<number> {
    return this.getScorer().score(task);
  }

  async scoreTasks(tasks: Task[]): Promise<Array<Task & { score: number }>> {
    const scorer = this.getScorer();
    
    // Score all tasks in parallel
    const scores = await Promise.all(tasks.map(t => scorer.score(t)));
    
    return tasks.map((task, i) => ({
      ...task,
      score: scores[i],
    }));
  }

  async sortByScore(tasks: Task[]): Promise<Task[]> {
    const scored = await this.scoreTasks(tasks);
    return scored
      .sort((a, b) => b.score - a.score)
      .map(({ score, ...task }) => task as Task);
  }

  listScorers(): Array<{ name: string; description: string; units?: string }> {
    return this.registry.list().map(s => ({
      name: s.name,
      description: s.description,
      units: s.units,
    }));
  }

  getScorerInfo(name: string): { name: string; description: string; units?: string } | undefined {
    const scorer = this.registry.get(name);
    if (!scorer) return undefined;
    return {
      name: scorer.name,
      description: scorer.description,
      units: scorer.units,
    };
  }
}
```

---

## 7. Integration

### 7.1 TaskService Integration

```typescript
// packages/core/src/services/task.ts

export class TaskService {
  constructor(
    private db: Database,
    private scoringService: ScoringService,
  ) {}

  async listTasks(options?: {
    columnId?: string;
    sortByScore?: boolean;
  }): Promise<Task[]> {
    let tasks = await this.getTasksFromDb(options);
    
    if (options?.sortByScore) {
      tasks = await this.scoringService.sortByScore(tasks);
    }
    
    return tasks;
  }

  async getBacklog(boardId: string): Promise<Array<Task & { score: number }>> {
    const backlogColumn = await this.boardService.getBacklogColumn(boardId);
    const tasks = await this.listTasks({ columnId: backlogColumn.id });
    const scored = await this.scoringService.scoreTasks(tasks);
    return scored.sort((a, b) => b.score - a.score);
  }
}
```

### 7.2 Board-Level Scorer Config

```typescript
// Add scorer config to board settings

// packages/core/src/db/schema.ts
export const boards = sqliteTable("boards", {
  // ... existing fields
  scorerConfig: text("scorer_config"),  // JSON: { scorerName: string, settings?: Record }
});

// packages/core/src/services/board.ts
async setScorerForBoard(boardId: string, scorerName: string): Promise<void> {
  // Validate scorer exists
  if (!scorerRegistry.get(scorerName)) {
    throw new Error(`Unknown scorer: ${scorerName}`);
  }
  
  await this.db.update(boards)
    .set({ scorerConfig: JSON.stringify({ scorerName }) })
    .where(eq(boards.id, boardId));
}

async getScorerForBoard(boardId: string): Promise<string> {
  const board = await this.getBoard(boardId);
  if (!board.scorerConfig) return 'combined';  // Default
  
  const config = JSON.parse(board.scorerConfig) as ScorerConfig;
  return config.scorerName;
}
```

---

## 8. CLI Integration

```bash
# List available scorers
kaban scorer list

# Output:
Available scorers:
  priority      - Sort by priority label (critical > high > medium > low)
  due-date      - Sort by due date urgency (closer = higher score)
  priority-rate - Priority divided by expected duration
  wsjf          - Weighted Shortest Job First (SAFe methodology)
  age           - Older tasks get higher priority
  combined      - Weighted combination of priority, due date, and age [current]

# Set scorer for current board
kaban scorer set priority-rate

# View backlog with scores
kaban task list --column backlog --scores

# Output:
  #   Score  Title                    Due         Labels
───────────────────────────────────────────────────────────────
  5   2.00   Quick fix                tomorrow    high, duration:1d
  3   1.50   Implement feature        next week   high, duration:2d
  8   0.75   Refactor module          -           medium, duration:4d
  1   0.25   Update docs              -           low, duration:4d

# Get next task to work on
kaban next

# Output:
Next recommended task (by combined score):
  #5 - Quick fix (score: 2.00)
```

---

## 9. MCP Tools

```typescript
// Tool: list_scorers
{
  name: "kaban_list_scorers",
  description: "List available task scoring algorithms",
  parameters: {}
}

// Tool: set_scorer
{
  name: "kaban_set_scorer",
  description: "Set the scoring algorithm for task prioritization",
  parameters: {
    scorerName: { 
      type: "string",
      description: "Scorer name: priority, due-date, priority-rate, wsjf, age, combined"
    }
  }
}

// Tool: get_scored_backlog
{
  name: "kaban_get_scored_backlog",
  description: "Get backlog tasks sorted by score",
  parameters: {
    boardId: { type: "string", optional: true },
    limit: { type: "number", optional: true, default: 10 }
  }
}

// Tool: get_next_task
{
  name: "kaban_get_next_task",
  description: "Get the highest-scored task to work on next",
  parameters: {
    boardId: { type: "string", optional: true }
  }
}
```

---

## 10. Testing

```typescript
describe('Task Scoring', () => {
  describe('Scorer determinism', () => {
    it('scoring is deterministic for same input', async () => {
      const task = createTask({ 
        labels: ['high'], 
        dueDate: new Date('2024-06-15'),
        createdAt: new Date('2024-01-01'),
      });
      
      // Score multiple times
      const score1 = await PriorityScorer.score(task);
      const score2 = await PriorityScorer.score(task);
      const score3 = await PriorityScorer.score(task);
      
      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });

    it('combined scorer is deterministic', async () => {
      const task = createTask({ 
        labels: ['medium'], 
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days old
      });
      
      const scorer = createCombinedScorer();
      const scores = await Promise.all([
        scorer.score(task),
        scorer.score(task),
        scorer.score(task),
      ]);
      
      expect(new Set(scores).size).toBe(1); // All same
    });
  });

  describe('PriorityScorer', () => {
    it('scores critical highest', async () => {
      const task = createTask({ labels: ['critical'] });
      expect(await PriorityScorer.score(task)).toBe(100);
    });

    it('scores high as 75', async () => {
      const task = createTask({ labels: ['high'] });
      expect(await PriorityScorer.score(task)).toBe(75);
    });

    it('scores untagged tasks as 0', async () => {
      const task = createTask({ labels: [] });
      expect(await PriorityScorer.score(task)).toBe(0);
    });

    it('is case-insensitive', async () => {
      const task1 = createTask({ labels: ['HIGH'] });
      const task2 = createTask({ labels: ['High'] });
      const task3 = createTask({ labels: ['high'] });
      
      expect(await PriorityScorer.score(task1)).toBe(75);
      expect(await PriorityScorer.score(task2)).toBe(75);
      expect(await PriorityScorer.score(task3)).toBe(75);
    });
  });

  describe('DueDateScorer', () => {
    it('scores overdue tasks highest', async () => {
      const task = createTask({ dueDate: new Date(Date.now() - 86400000) }); // Yesterday
      const score = await DueDateScorer.score(task);
      expect(score).toBeGreaterThan(100);
    });

    it('scores tasks without due date as 0', async () => {
      const task = createTask({ dueDate: undefined });
      expect(await DueDateScorer.score(task)).toBe(0);
    });

    it('scores due today as 90', async () => {
      const today = new Date();
      today.setHours(23, 59, 59);
      const task = createTask({ dueDate: today });
      expect(await DueDateScorer.score(task)).toBe(90);
    });
  });

  describe('PriorityRateScorer', () => {
    it('calculates priority / duration', async () => {
      const scorer = createPriorityRateScorer({ defaultPriority: 1, defaultDuration: 4 });
      const task = createTask({ labels: ['high', 'duration:2d'] }); // priority 3, duration 2
      expect(await scorer.score(task)).toBe(1.5); // 3/2 = 1.5
    });

    it('uses defaults when labels missing', async () => {
      const scorer = createPriorityRateScorer({ defaultPriority: 2, defaultDuration: 4 });
      const task = createTask({ labels: [] });
      expect(await scorer.score(task)).toBe(0.5); // 2/4 = 0.5
    });

    it('handles duration:0d gracefully', async () => {
      const scorer = createPriorityRateScorer({ defaultPriority: 1, defaultDuration: 4 });
      const task = createTask({ labels: ['high', 'duration:0d'] });
      // Should use default duration, not divide by zero
      const score = await scorer.score(task);
      expect(Number.isFinite(score)).toBe(true);
    });
  });

  describe('ScoringService', () => {
    it('sorts tasks by score descending', async () => {
      const tasks = [
        createTask({ labels: ['low'] }),
        createTask({ labels: ['critical'] }),
        createTask({ labels: ['medium'] }),
      ];
      
      const sorted = await scoringService.sortByScore(tasks);
      
      expect(sorted[0].labels).toContain('critical');
      expect(sorted[2].labels).toContain('low');
    });

    it('scores tasks in parallel', async () => {
      const tasks = Array.from({ length: 100 }, (_, i) => 
        createTask({ labels: [i % 2 === 0 ? 'high' : 'low'] })
      );
      
      const start = Date.now();
      const scored = await scoringService.scoreTasks(tasks);
      const duration = Date.now() - start;
      
      expect(scored).toHaveLength(100);
      // Should be fast due to parallel execution
      expect(duration).toBeLessThan(1000);
    });

    it('throws on unknown scorer', () => {
      expect(() => scoringService.setScorer('nonexistent'))
        .toThrow(/unknown scorer/i);
    });
  });

  describe('Scorer registry', () => {
    it('lists all built-in scorers', () => {
      const names = scorerRegistry.names();
      expect(names).toContain('priority');
      expect(names).toContain('due-date');
      expect(names).toContain('priority-rate');
      expect(names).toContain('wsjf');
      expect(names).toContain('age');
      expect(names).toContain('combined');
    });

    it('allows registering custom scorer', async () => {
      const customScorer: TaskScorer = {
        name: 'custom',
        description: 'Custom scorer',
        async score() { return 42; },
      };
      
      scorerRegistry.register(customScorer);
      
      expect(scorerRegistry.get('custom')).toBe(customScorer);
      expect(await scorerRegistry.get('custom')!.score(createTask({}))).toBe(42);
    });
  });
});
```

---

## 11. Acceptance Criteria

- [ ] 6 built-in scorers implemented
- [ ] All scorers use async interface (`Promise<number>`)
- [ ] Registry allows registering custom scorers
- [ ] `ScoringService.sortByScore()` sorts tasks correctly
- [ ] Scorer configurable at board level
- [ ] CLI `scorer list/set` works
- [ ] CLI `task list --scores` shows scores
- [ ] CLI `kaban next` recommends highest-scored task
- [ ] MCP tools available
- [ ] Scoring is deterministic (same input = same output)
- [ ] Scoring handles edge cases (missing labels, division by zero)
- [ ] Tests cover all scorers
