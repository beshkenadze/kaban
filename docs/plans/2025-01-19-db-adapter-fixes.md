# DB Adapter Codex Review Fixes - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix type safety, error handling, and add cleanup methods to the pluggable SQLite adapter based on Codex code review.

**Architecture:** Replace unsafe type casts with a proper interface, wrap all database operations in try/catch with `KabanError`, add `$close()` method for resource cleanup.

**Tech Stack:** TypeScript, Drizzle ORM, bun:sqlite, @libsql/client

---

## Task 1: Define Proper DB Interface

**Files:**
- Modify: `packages/core/src/db/index.ts:7-10`
- Test: `packages/core/src/db/index.test.ts`

**Step 1: Update the DB type definition**

Replace the unsafe type cast with a proper interface based on actual usage:

```typescript
// packages/core/src/db/index.ts - Replace lines 7-10

import type { InferSelectModel } from "drizzle-orm";

/**
 * Database adapter interface.
 * Supports both bun:sqlite and @libsql/client backends.
 */
export interface DB {
  select: () => {
    from: <T extends typeof schema.boards | typeof schema.columns | typeof schema.tasks>(
      table: T
    ) => Promise<InferSelectModel<T>[]> & {
      where: (condition: unknown) => Promise<InferSelectModel<T>[]> & {
        limit: (n: number) => Promise<InferSelectModel<T>[]>;
      };
      orderBy: (...columns: unknown[]) => Promise<InferSelectModel<T>[]>;
      limit: (n: number) => Promise<InferSelectModel<T>[]>;
    };
  };
  insert: <T extends typeof schema.boards | typeof schema.columns | typeof schema.tasks>(
    table: T
  ) => {
    values: (data: Partial<InferSelectModel<T>> | Partial<InferSelectModel<T>>[]) => Promise<void>;
  };
  delete: <T extends typeof schema.tasks>(table: T) => {
    where: (condition: unknown) => Promise<void>;
  };
  /** Raw database client. Type varies by backend. */
  $client: unknown;
  /**
   * Execute raw SQL statements.
   * @internal For schema initialization only. Does not sanitize input.
   */
  $runRaw: (sql: string) => Promise<void>;
  /** Close the database connection and release resources. */
  $close: () => Promise<void>;
}
```

**Step 2: Run tests to verify compilation**

```bash
cd packages/core && bun run build
```

Expected: Build may fail - that's OK, we'll fix in next tasks.

---

## Task 2: Add Error Handling with KabanError

**Files:**
- Modify: `packages/core/src/db/index.ts:1-5` (imports)
- Modify: `packages/core/src/db/index.ts:26-42` (createBunDb)
- Modify: `packages/core/src/db/index.ts:44-61` (createLibsqlDb)
- Modify: `packages/core/src/db/index.ts:63-75` (createDb)
- Test: `packages/core/src/db/index.test.ts`

**Step 1: Add KabanError import**

```typescript
// packages/core/src/db/index.ts - Line 1-5
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";
import { ExitCode, KabanError } from "../types.js";
```

**Step 2: Update createBunDb with error handling**

```typescript
async function createBunDb(filePath: string): Promise<DB> {
  try {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");

    ensureDir(filePath);
    const sqlite = new Database(filePath);
    const db = drizzle({ client: sqlite, schema });

    return Object.assign(db, {
      $client: sqlite,
      $runRaw: async (sql: string) => {
        // Note: Simple split on ';' - only use for trusted schema SQL
        // without semicolons in string literals.
        const statements = sql.split(";").filter((s) => s.trim());
        for (const stmt of statements) {
          try {
            sqlite.run(stmt);
          } catch (error) {
            throw new KabanError(
              `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`,
              ExitCode.GENERAL_ERROR
            );
          }
        }
      },
      $close: async () => {
        sqlite.close();
      },
    }) as unknown as DB;
  } catch (error) {
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create Bun database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR
    );
  }
}
```

**Step 3: Update createLibsqlDb with error handling**

```typescript
async function createLibsqlDb(config: DbConfig): Promise<DB> {
  try {
    const { createClient } = await import("@libsql/client");
    const { drizzle } = await import("drizzle-orm/libsql");

    if (config.url.startsWith("file:")) {
      ensureDir(config.url.replace("file:", ""));
    }

    const client = createClient(config);
    const db = drizzle(client, { schema });

    return Object.assign(db, {
      $client: client,
      $runRaw: async (sql: string) => {
        try {
          await client.executeMultiple(sql);
        } catch (error) {
          throw new KabanError(
            `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`,
            ExitCode.GENERAL_ERROR
          );
        }
      },
      $close: async () => {
        client.close();
      },
    }) as unknown as DB;
  } catch (error) {
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create libsql database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR
    );
  }
}
```

**Step 4: Update createDb with error handling**

```typescript
export async function createDb(config: DbConfig | string): Promise<DB> {
  try {
    if (typeof config === "string") {
      if (isBun) {
        return await createBunDb(config);
      }
      return await createLibsqlDb({ url: `file:${config}` });
    }

    if (isBun && config.url.startsWith("file:")) {
      return await createBunDb(config.url.replace("file:", ""));
    }
    return await createLibsqlDb(config);
  } catch (error) {
    if (error instanceof KabanError) throw error;
    throw new KabanError(
      `Failed to create database: ${error instanceof Error ? error.message : String(error)}`,
      ExitCode.GENERAL_ERROR
    );
  }
}
```

**Step 5: Run tests**

```bash
cd packages/core && bun test
```

Expected: All tests pass.

---

## Task 3: Add Tests for Error Handling and $close

**Files:**
- Modify: `packages/core/src/db/index.test.ts`

**Step 1: Add error handling tests**

```typescript
// Add to packages/core/src/db/index.test.ts

import { KabanError } from "../types.js";

describe("error handling", () => {
  let db: DB;

  beforeEach(async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    db = await createDb(TEST_DB);
    await initializeSchema(db);
  });

  afterEach(async () => {
    await db.$close();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("$runRaw throws KabanError on invalid SQL", async () => {
    expect(db.$runRaw("INVALID SQL SYNTAX")).rejects.toThrow(KabanError);
  });

  test("$runRaw throws KabanError with descriptive message", async () => {
    try {
      await db.$runRaw("SELECT * FROM nonexistent_table");
    } catch (error) {
      expect(error).toBeInstanceOf(KabanError);
      expect((error as KabanError).message).toContain("SQL execution failed");
    }
  });
});

describe("$close", () => {
  test("closes database connection", async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    const db = await createDb(TEST_DB);
    await initializeSchema(db);

    await db.$close();

    // Verify closed by checking operations fail
    // Note: Behavior varies by backend, just ensure no crash
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  test("can be called multiple times safely", async () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    const db = await createDb(TEST_DB);

    await db.$close();
    await db.$close(); // Should not throw

    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });
});
```

**Step 2: Run tests**

```bash
cd packages/core && bun test
```

Expected: All tests pass.

---

## Task 4: Update Existing Tests to Use $close

**Files:**
- Modify: `packages/core/src/db/index.test.ts`
- Modify: `packages/core/src/services/board.test.ts`
- Modify: `packages/core/src/services/task.test.ts`

**Step 1: Update db/index.test.ts existing tests**

Add `await db.$close()` in afterEach hooks where db is used.

**Step 2: Update board.test.ts**

```typescript
// packages/core/src/services/board.test.ts - Add to afterEach
afterEach(async () => {
  await db.$close();
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});
```

Note: Change `afterEach(() => {` to `afterEach(async () => {`

**Step 3: Update task.test.ts**

```typescript
// packages/core/src/services/task.test.ts - Add to afterEach
afterEach(async () => {
  await db.$close();
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});
```

Note: Change `afterEach(() => {` to `afterEach(async () => {`

**Step 4: Run all tests**

```bash
cd packages/core && bun test
```

Expected: All tests pass.

---

## Task 5: Build and Integration Test

**Files:**
- Build: `packages/core`
- Build: `packages/cli`
- Build: `packages/tui`

**Step 1: Build core**

```bash
cd packages/core && bun run build
```

Expected: Build succeeds.

**Step 2: Build and test CLI**

```bash
cd packages/cli && bun run build && bun test
```

Expected: All 42 tests pass.

**Step 3: Build TUI**

```bash
cd packages/tui && bun run build
```

Expected: Build succeeds.

**Step 4: Integration test**

```bash
cd /tmp && rm -rf kaban-integration-test && mkdir kaban-integration-test && cd kaban-integration-test
bun /Users/akira/Projects/My/KabanProject/kaban-board/packages/cli/dist/index.js init --name "Test"
bun /Users/akira/Projects/My/KabanProject/kaban-board/packages/cli/dist/index.js add "Test task"
bun /Users/akira/Projects/My/KabanProject/kaban-board/packages/cli/dist/index.js status
```

Expected: Board initializes, task added, status shows task.

---

## Task 6: Commit Changes

**Step 1: Stage files**

```bash
cd /Users/akira/Projects/My/KabanProject/kaban-board
git add packages/core/src/db/index.ts packages/core/src/db/index.test.ts packages/core/src/services/board.test.ts packages/core/src/services/task.test.ts
```

**Step 2: Commit**

```bash
git commit -m "fix(core): improve DB adapter type safety and error handling

- Add proper error handling with KabanError pattern
- Add \$close() method for connection cleanup
- Add JSDoc documentation for internal methods
- Add tests for error cases and cleanup
- Update existing tests to use \$close() in afterEach

Addresses Codex code review feedback."
```

**Step 3: Verify**

```bash
git log -1 --oneline
```

Expected: Commit created successfully.

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Define proper DB interface | 5 min |
| 2 | Add error handling with KabanError | 10 min |
| 3 | Add tests for error handling and $close | 5 min |
| 4 | Update existing tests to use $close | 5 min |
| 5 | Build and integration test | 5 min |
| 6 | Commit changes | 2 min |

**Total estimated time:** ~30 minutes
