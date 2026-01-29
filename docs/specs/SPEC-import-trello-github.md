# SPEC: Trello/GitHub Projects Import

**Status**: Draft  
**Priority**: P3 (Low)  
**Complexity**: High  
**Estimated effort**: 3-5 days  

---

## 1. Overview

One-way import of kanban boards from external services (Trello, GitHub Projects) into kaban-board.

### Goals
- Import boards from Trello and GitHub Projects v2
- Preserve task structure: columns, tasks, descriptions, due dates
- Support checklists → subtasks conversion
- Provide CLI and MCP interfaces
- **Atomic imports** (all-or-nothing via transaction)
- **Conflict resolution** for existing board names

### Non-Goals
- Bidirectional sync (out of scope)
- Real-time webhooks (out of scope)
- Attachments import (future consideration)
- Comments/activity history (future consideration)

---

## 2. User Stories

```gherkin
Feature: Import from Trello

  Scenario: Import a Trello board
    Given I have a Trello API token
    When I run `kaban import trello <board-id> --token <token>`
    Then a new board is created with all lists as columns
    And all cards are imported as tasks
    And checklists are converted to subtasks (dependsOn)
    And due dates are preserved

  Scenario: Import with existing board name
    Given a board named "Project Alpha" already exists
    When I run `kaban import trello <board-id>` for a board also named "Project Alpha"
    Then I am prompted to rename or overwrite
    Or the import is rejected with clear error

Feature: Import from GitHub Projects

  Scenario: Import a GitHub Project
    Given I have a GitHub PAT with read:project scope
    When I run `kaban import github <owner/project-number> --token <token>`
    Then a new board is created with Status field options as columns
    And all items (issues, PRs, drafts) are imported as tasks
    And custom field values are preserved as labels
```

---

## 3. Data Model Mapping

### 3.1 Trello → Kaban

| Trello | Kaban | Notes |
|--------|-------|-------|
| Board | Board | `name`, `desc` → `name` |
| List | Column | `name`, `pos` → position |
| Card | Task | See mapping below |
| Checklist | Tasks with `dependsOn` | Parent task blocks subtasks |
| Label | `labels[]` | Color → hex mapping |
| Due date | `dueDate` field | |
| Members | `assignedTo` | First member only |

**Card → Task Mapping:**

```typescript
interface TrelloCardToTask {
  // Direct mapping
  name        → title
  desc        → description
  idList      → columnId (via list mapping)
  pos         → position (normalized)
  due         → dueDate
  dueComplete → mark as completed if true
  
  // Derived
  idMembers[0] → assignedTo
  idLabels     → labels (color names)
  checklists   → separate tasks with blocked_by link to parent
}
```

### 3.2 GitHub Projects → Kaban

| GitHub Projects v2 | Kaban | Notes |
|-------------------|-------|-------|
| ProjectV2 | Board | `title` → `name` |
| SingleSelectField.options | Columns | Status field options |
| ProjectV2Item | Task | See mapping below |
| Issue/PR body | description | Markdown preserved |
| Draft Issue | Task | `type: draft` in labels |
| Custom fields | labels | `field:value` format |

**Item → Task Mapping:**

```typescript
interface GitHubItemToTask {
  // From content (Issue/PR/Draft)
  content.title  → title
  content.body   → description
  content.number → labels.push(`#${number}`)
  content.repository → labels.push(nameWithOwner)
  
  // From fieldValues
  Status.optionId → columnId (via option mapping)
  Date fields     → labels.push(`due:${date}`)
  Text fields     → labels.push(`${name}:${value}`)
  
  // Derived
  type           → labels.push(type.toLowerCase())
  isArchived     → archived
}
```

---

## 4. Architecture

### 4.1 Module Structure

```
packages/core/src/
├── services/
│   └── import/
│       ├── index.ts           # ImportService facade
│       ├── types.ts           # Common types
│       ├── trello/
│       │   ├── client.ts      # Trello API client
│       │   ├── mapper.ts      # Trello → Kaban mapper
│       │   └── types.ts       # Trello API types
│       └── github/
│           ├── client.ts      # GitHub GraphQL client
│           ├── mapper.ts      # GitHub → Kaban mapper
│           └── types.ts       # GitHub API types

packages/cli/src/commands/
└── import.ts                  # CLI command
```

### 4.2 Class Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      ImportService                          │
├─────────────────────────────────────────────────────────────┤
│ + importFromTrello(boardId, token): Promise<ImportResult>   │
│ + importFromGitHub(owner, project, token): Promise<Result>  │
│ - executeInTransaction(fn): Promise<T>                      │
│ - resolveConflict(name, strategy): Promise<string>          │
│ - createBoard(name): Promise<Board>                         │
│ - createColumns(columns): Promise<Column[]>                 │
│ - createTasks(tasks): Promise<Task[]>                       │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│     TrelloClient        │     │     GitHubClient        │
├─────────────────────────┤     ├─────────────────────────┤
│ + fetchBoard(id)        │     │ + fetchProject(id)      │
│ + fetchLists(boardId)   │     │ + fetchItems(projectId) │
│ + fetchCards(boardId)   │     │ + fetchFields(projectId)│
│ + fetchChecklists(id)   │     └─────────────────────────┘
└─────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│     TrelloMapper        │     │     GitHubMapper        │
├─────────────────────────┤     ├─────────────────────────┤
│ + mapBoard(data)        │     │ + mapProject(data)      │
│ + mapList(list)         │     │ + mapField(field)       │
│ + mapCard(card)         │     │ + mapItem(item)         │
│ + mapChecklist(list)    │     └─────────────────────────┘
└─────────────────────────┘
```

---

## 5. API Design

### 5.1 ImportService

```typescript
// packages/core/src/services/import/types.ts

export type ConflictStrategy = 'rename' | 'overwrite' | 'error';

export interface ImportOptions {
  /** Skip tasks in archived/closed lists */
  skipArchived?: boolean;
  /** Import checklists as subtasks */
  importChecklists?: boolean;
  /** Column mapping overrides */
  columnMapping?: Record<string, string>;
  /** Dry run - return preview without creating */
  dryRun?: boolean;
  /** How to handle existing board with same name */
  conflictStrategy?: ConflictStrategy;
}

export interface ImportResult {
  success: boolean;
  board: {
    id: string;
    name: string;
  };
  stats: {
    columnsCreated: number;
    tasksCreated: number;
    subtasksCreated: number;
    skipped: number;
    errors: string[];
  };
  /** Only in dry run mode */
  preview?: {
    columns: Array<{ name: string; taskCount: number }>;
    tasks: Array<{ title: string; column: string }>;
  };
  /** Conflict resolution applied */
  conflictResolution?: {
    originalName: string;
    resolvedName: string;
    strategy: ConflictStrategy;
  };
}

export interface ImportService {
  importFromTrello(
    boardId: string,
    token: string,
    apiKey: string,
    options?: ImportOptions
  ): Promise<ImportResult>;

  importFromGitHub(
    owner: string,
    projectNumber: number,
    token: string,
    ownerType: 'user' | 'organization',
    options?: ImportOptions
  ): Promise<ImportResult>;
}
```

### 5.2 Conflict Resolution

```typescript
// packages/core/src/services/import/conflict.ts

export async function resolveBoardNameConflict(
  db: Database,
  name: string,
  strategy: ConflictStrategy
): Promise<{ name: string; existingBoardId?: string }> {
  // Check for existing board
  const existing = await db.select()
    .from(boards)
    .where(eq(boards.name, name))
    .get();
  
  if (!existing) {
    return { name };  // No conflict
  }
  
  switch (strategy) {
    case 'error':
      throw new ImportError(
        `Board "${name}" already exists. Use --conflict rename|overwrite to handle.`,
        ImportErrorCode.CONFLICT
      );
    
    case 'rename':
      // Generate unique name
      let suffix = 2;
      let newName = `${name} (${suffix})`;
      while (await boardExists(db, newName)) {
        suffix++;
        newName = `${name} (${suffix})`;
      }
      return { name: newName };
    
    case 'overwrite':
      // Return existing board ID for deletion
      return { name, existingBoardId: existing.id };
    
    default:
      throw new Error(`Unknown conflict strategy: ${strategy}`);
  }
}
```

### 5.3 Transaction Wrapper

```typescript
// packages/core/src/services/import/index.ts

export class ImportService {
  constructor(
    private db: Database,
    private boardService: BoardService,
    private taskService: TaskService,
  ) {}

  async importFromTrello(
    boardId: string,
    token: string,
    apiKey: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const client = new TrelloClient(apiKey, token);
    
    // Fetch data from Trello (outside transaction - read-only)
    const trelloData = await client.fetchBoard(boardId);
    const mapper = new TrelloMapper(trelloData);
    
    // Preview mode - no transaction needed
    if (options.dryRun) {
      return this.createPreview(mapper);
    }
    
    // Execute import in transaction (atomic)
    return this.executeInTransaction(async (tx) => {
      const conflictStrategy = options.conflictStrategy ?? 'error';
      
      // Resolve name conflict
      const { name, existingBoardId } = await resolveBoardNameConflict(
        tx,
        mapper.boardName,
        conflictStrategy
      );
      
      // Delete existing board if overwriting
      if (existingBoardId) {
        await this.boardService.deleteBoard(existingBoardId, tx);
      }
      
      // Create board
      const board = await this.boardService.createBoard({ name }, tx);
      
      // Create columns
      const columnMap = new Map<string, string>();
      for (const [i, col] of mapper.columns.entries()) {
        const column = await this.boardService.createColumn({
          boardId: board.id,
          name: col.name,
          position: i,
        }, tx);
        columnMap.set(col.originalId, column.id);
      }
      
      // Create tasks
      let tasksCreated = 0;
      let subtasksCreated = 0;
      const errors: string[] = [];
      
      for (const taskData of mapper.tasks) {
        try {
          const columnId = columnMap.get(taskData.columnId);
          if (!columnId) {
            errors.push(`Unknown column for task: ${taskData.title}`);
            continue;
          }
          
          const task = await this.taskService.addTask({
            ...taskData,
            columnId,
            createdBy: 'import:trello',
          }, tx);
          tasksCreated++;
          
          // Import checklists as subtasks
          if (options.importChecklists !== false) {
            for (const subtask of taskData.subtasks ?? []) {
              await this.taskService.addTask({
                title: subtask.title,
                columnId: subtask.completed ? 'done' : columnId,
                createdBy: 'import:trello',
              }, tx);
              
              // Create blocked_by link
              await this.linkService.createLink({
                fromTaskId: subtask.id,
                toTaskId: task.id,
                linkType: 'blocked_by',
              }, tx);
              
              subtasksCreated++;
            }
          }
        } catch (error) {
          errors.push(`Task "${taskData.title}": ${error.message}`);
        }
      }
      
      return {
        success: errors.length === 0,
        board: { id: board.id, name },
        stats: {
          columnsCreated: columnMap.size,
          tasksCreated,
          subtasksCreated,
          skipped: mapper.tasks.length - tasksCreated,
          errors,
        },
        conflictResolution: existingBoardId ? {
          originalName: mapper.boardName,
          resolvedName: name,
          strategy: conflictStrategy,
        } : undefined,
      };
    });
  }

  private async executeInTransaction<T>(
    fn: (tx: Transaction) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      try {
        return await fn(tx);
      } catch (error) {
        // Transaction automatically rolls back on error
        throw error;
      }
    });
  }
}
```

### 5.4 CLI Interface

```bash
# Trello import
kaban import trello <board-id> \
  --api-key <key> \
  --token <token> \
  [--skip-archived] \
  [--no-checklists] \
  [--conflict rename|overwrite|error] \
  [--dry-run]

# GitHub import
kaban import github <owner>/<project-number> \
  --token <token> \
  [--type user|org]        # Default: auto-detect
  [--skip-archived] \
  [--conflict rename|overwrite|error] \
  [--dry-run]

# Examples
kaban import trello abc123def456 --api-key xxx --token yyy
kaban import trello abc123 --api-key xxx --token yyy --conflict rename
kaban import github myorg/5 --token ghp_xxx --type org
kaban import github myuser/3 --token ghp_xxx
```

### 5.5 MCP Tools

```typescript
// Tool: import_trello_board
{
  name: "import_trello_board",
  description: "Import a Trello board into kaban",
  parameters: {
    boardId: { type: "string", description: "Trello board ID" },
    apiKey: { type: "string", description: "Trello API key" },
    token: { type: "string", description: "Trello user token" },
    skipArchived: { type: "boolean", optional: true },
    importChecklists: { type: "boolean", optional: true, default: true },
    conflictStrategy: { 
      type: "string", 
      enum: ["rename", "overwrite", "error"],
      optional: true,
      default: "error"
    },
    dryRun: { type: "boolean", optional: true }
  }
}

// Tool: import_github_project
{
  name: "import_github_project",
  description: "Import a GitHub Project (v2) into kaban",
  parameters: {
    owner: { type: "string", description: "Organization or user login" },
    projectNumber: { type: "number", description: "Project number" },
    token: { type: "string", description: "GitHub PAT with read:project scope" },
    ownerType: { type: "string", enum: ["user", "organization"], optional: true },
    skipArchived: { type: "boolean", optional: true },
    conflictStrategy: { 
      type: "string", 
      enum: ["rename", "overwrite", "error"],
      optional: true,
      default: "error"
    },
    dryRun: { type: "boolean", optional: true }
  }
}
```

---

## 6. Implementation Details

### 6.1 Trello Client

```typescript
// packages/core/src/services/import/trello/client.ts

const TRELLO_API_BASE = 'https://api.trello.com/1';

export class TrelloClient {
  constructor(
    private apiKey: string,
    private token: string
  ) {}

  async fetchBoard(boardId: string): Promise<TrelloImportData> {
    return withRateLimitRetry(async () => {
      const response = await fetch(
        `${TRELLO_API_BASE}/boards/${boardId}?` +
        `key=${this.apiKey}&token=${this.token}&` +
        `lists=all&` +
        `cards=all&` +
        `card_checklists=all&` +
        `labels=all&` +
        `fields=id,name,desc,closed`
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new ImportError('Invalid Trello credentials', ImportErrorCode.INVALID_CREDENTIALS);
        }
        if (response.status === 404) {
          throw new ImportError('Board not found or not accessible', ImportErrorCode.NOT_FOUND);
        }
        if (response.status === 429) {
          throw new ImportError('Rate limited', ImportErrorCode.RATE_LIMITED);
        }
        throw new ImportError(`Trello API error: ${response.status}`, ImportErrorCode.NETWORK_ERROR);
      }

      return response.json();
    });
  }
}
```

### 6.2 GitHub Client

```typescript
// packages/core/src/services/import/github/client.ts

import { Octokit } from '@octokit/core';

export class GitHubProjectsClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async fetchProject(
    owner: string,
    projectNumber: number,
    ownerType: 'user' | 'organization'
  ): Promise<GitHubProjectData> {
    // Step 1: Get project ID
    const projectId = await this.getProjectId(owner, projectNumber, ownerType);

    // Step 2: Fetch project with fields
    const project = await this.fetchProjectDetails(projectId);

    // Step 3: Fetch all items with pagination
    const items = await this.fetchAllItems(projectId);

    return { project, items };
  }

  private async fetchAllItems(projectId: string): Promise<ProjectItem[]> {
    const items: ProjectItem[] = [];
    let cursor: string | null = null;

    do {
      const response = await withRateLimitRetry(() => 
        this.octokit.graphql<ItemsResponse>(ITEMS_QUERY, { id: projectId, cursor })
      );

      items.push(...response.node.items.nodes);
      cursor = response.node.items.pageInfo.hasNextPage
        ? response.node.items.pageInfo.endCursor
        : null;
    } while (cursor);

    return items;
  }
}
```

### 6.3 Rate Limit Handling

```typescript
// packages/core/src/services/import/utils/rate-limit.ts

export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ImportError && error.code === ImportErrorCode.RATE_LIMITED) {
        if (attempt < maxRetries - 1) {
          const delay = baseDelayMs * Math.pow(2, attempt); // Exponential backoff
          console.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await sleep(delay);
          continue;
        }
      }
      throw error;
    }
  }
  throw new ImportError('Rate limit exceeded after max retries', ImportErrorCode.RATE_LIMITED);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 7. Error Handling

### 7.1 Error Types

```typescript
export class ImportError extends Error {
  constructor(
    message: string,
    public code: ImportErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export enum ImportErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_DATA = 'INVALID_DATA',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONFLICT = 'CONFLICT',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
}
```

---

## 8. Security Considerations

### 8.1 Token Handling

- Tokens are NEVER stored persistently
- Tokens are passed via CLI flags or MCP parameters
- Tokens are not logged (use `[REDACTED]` in logs)
- Clear tokens from memory after use

### 8.2 Permissions

| Service | Required Scope | Grants |
|---------|---------------|--------|
| Trello | `read` | Read-only board access |
| GitHub | `read:project` | Read-only project access |

### 8.3 Rate Limits

| Service | Limit | Strategy |
|---------|-------|----------|
| Trello | 100 req/10s per token | Batch with nested resources |
| GitHub | 5000 points/hour | Monitor via `rateLimit` query, exponential backoff |

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('TrelloMapper', () => {
  it('maps board to kaban board', () => { /* ... */ });
  it('maps lists to columns with correct positions', () => { /* ... */ });
  it('maps cards to tasks', () => { /* ... */ });
  it('converts checklists to subtasks with blocked_by links', () => { /* ... */ });
  it('maps labels to kaban labels', () => { /* ... */ });
  it('handles archived cards based on options', () => { /* ... */ });
});

describe('GitHubMapper', () => {
  it('maps project to kaban board', () => { /* ... */ });
  it('maps Status field options to columns', () => { /* ... */ });
  it('maps items to tasks', () => { /* ... */ });
  it('handles draft issues', () => { /* ... */ });
  it('maps custom fields to labels', () => { /* ... */ });
});
```

### 9.2 Integration Tests

```typescript
describe('ImportService', () => {
  it('imports Trello board end-to-end', async () => {
    // Use recorded HTTP fixtures
  });

  it('imports GitHub project end-to-end', async () => {
    // Use recorded GraphQL fixtures
  });

  it('handles dry run mode', async () => {
    const result = await importService.importFromTrello(boardId, token, apiKey, {
      dryRun: true,
    });
    
    // Verify no data created
    expect(result.preview).toBeDefined();
    const boards = await boardService.listBoards();
    expect(boards.find(b => b.name === result.preview!.boardName)).toBeUndefined();
  });

  it('rolls back on partial failure', async () => {
    // Mock failure after creating board but before creating tasks
    jest.spyOn(taskService, 'addTask').mockRejectedValueOnce(new Error('Simulated failure'));
    
    await expect(
      importService.importFromTrello(boardId, token, apiKey)
    ).rejects.toThrow();
    
    // Verify board was not created (rolled back)
    const boards = await boardService.listBoards();
    expect(boards.find(b => b.name === 'Imported Board')).toBeUndefined();
  });
});

describe('Conflict resolution', () => {
  beforeEach(async () => {
    // Create existing board
    await boardService.createBoard({ name: 'Project Alpha' });
  });

  it('throws error by default on conflict', async () => {
    await expect(
      importService.importFromTrello(boardId, token, apiKey)
    ).rejects.toThrow(/already exists/i);
  });

  it('renames board with conflict=rename', async () => {
    const result = await importService.importFromTrello(boardId, token, apiKey, {
      conflictStrategy: 'rename',
    });
    
    expect(result.board.name).toBe('Project Alpha (2)');
    expect(result.conflictResolution?.strategy).toBe('rename');
  });

  it('overwrites board with conflict=overwrite', async () => {
    const result = await importService.importFromTrello(boardId, token, apiKey, {
      conflictStrategy: 'overwrite',
    });
    
    expect(result.board.name).toBe('Project Alpha');
    
    // Verify only one board with this name
    const boards = await boardService.listBoards();
    const matching = boards.filter(b => b.name === 'Project Alpha');
    expect(matching).toHaveLength(1);
  });
});

describe('Rate limiting', () => {
  it('handles Trello rate limit with exponential backoff', async () => {
    // Mock rate limit response followed by success
    const mockFetch = jest.spyOn(global, 'fetch');
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockBoard), { status: 200 }));
    
    const result = await importService.importFromTrello(boardId, token, apiKey);
    
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('fails after max retries on persistent rate limit', async () => {
    const mockFetch = jest.spyOn(global, 'fetch');
    mockFetch.mockResolvedValue(new Response(null, { status: 429 }));
    
    await expect(
      importService.importFromTrello(boardId, token, apiKey)
    ).rejects.toThrow(/rate limit/i);
    
    expect(mockFetch).toHaveBeenCalledTimes(3); // Max retries
  });
});
```

### 9.3 Test Fixtures

Store sample API responses in `packages/core/src/services/import/__fixtures__/`:
- `trello-board.json`
- `github-project.json`
- `github-items.json`

---

## 10. Future Enhancements

### Phase 2 (Medium Priority)
- [ ] Import attachments (store URLs in description)
- [ ] Import comments as task description appendix
- [ ] Column mapping UI (interactive mode)
- [ ] Progress reporting for large imports

### Phase 3 (Low Priority)
- [ ] Jira import
- [ ] Asana import
- [ ] Linear import
- [ ] Export to Trello/GitHub (bidirectional)

---

## 11. Dependencies

### New Dependencies

```json
{
  "@octokit/core": "^6.0.0",      // GitHub API client
  "@octokit/graphql": "^8.0.0"    // GraphQL support
}
```

### No New Dependencies for Trello
- Use native `fetch` (available in Node 18+/Bun)

---

## 12. Acceptance Criteria

- [ ] `kaban import trello` imports board with lists, cards, checklists
- [ ] `kaban import github` imports project with columns, items
- [ ] **All imports are atomic** (transaction rollback on failure)
- [ ] **Conflict resolution** works (rename, overwrite, error)
- [ ] Dry run mode shows preview without creating data
- [ ] Error messages are clear and actionable
- [ ] Rate limits are respected with exponential backoff
- [ ] Tokens are never logged or stored
- [ ] Unit tests cover mapper logic
- [ ] Integration tests verify end-to-end flow including rollback
- [ ] CLI help is comprehensive
- [ ] MCP tools work with Claude

---

## Appendix A: Trello API Reference

### Authentication URL
```
https://trello.com/1/authorize?
  expiration=1day
  &scope=read
  &response_type=token
  &key={API_KEY}
  &return_url={CALLBACK}
```

### Board Fetch URL (with nested resources)
```
GET https://api.trello.com/1/boards/{id}
  ?key={apiKey}
  &token={token}
  &lists=all
  &cards=all
  &card_checklists=all
  &labels=all
  &fields=id,name,desc,closed
```

---

## Appendix B: GitHub GraphQL Queries

### Get Project ID
```graphql
query($login: String!, $number: Int!) {
  organization(login: $login) {
    projectV2(number: $number) { id }
  }
}
```

### Get Project Items (paginated)
```graphql
query($id: ID!, $cursor: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        nodes {
          id
          type
          isArchived
          content {
            ... on Issue { title body number }
            ... on PullRequest { title body number }
            ... on DraftIssue { title body }
          }
          fieldValues(first: 50) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                optionId
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```
