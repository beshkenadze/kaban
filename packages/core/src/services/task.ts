import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { tasks } from "../db/schema.js";
import type { DB } from "../db/types.js";
import type {
  AddTaskInput as AddTaskInputSchema,
  ListTasksFilter as ListTasksFilterSchema,
  UpdateTaskInput as UpdateTaskInputSchema,
} from "../schemas.js";
import type { Task } from "../types.js";
import { ExitCode, KabanError } from "../types.js";
import { jaccardSimilarity } from "../utils/similarity.js";
import { validateAgentName, validateColumnId, validateTitle } from "../validation.js";
import type { BoardService } from "./board.js";

export type AddTaskInput = AddTaskInputSchema;
export type ListTasksFilter = ListTasksFilterSchema;
export type UpdateTaskInput = UpdateTaskInputSchema;

export interface MoveTaskOptions {
  force?: boolean;
  validateDeps?: boolean;
}

export interface ArchiveTasksCriteria {
  status?: string;
  olderThan?: Date;
  taskIds?: string[];
}

export interface ArchiveTasksResult {
  archivedCount: number;
  taskIds: string[];
}

export interface SearchArchiveOptions {
  limit?: number;
  offset?: number;
}

export interface SearchArchiveResult {
  tasks: Task[];
  total: number;
}

export interface PurgeArchiveCriteria {
  olderThan?: Date;
}

export interface PurgeArchiveResult {
  deletedCount: number;
}

export interface ResetBoardResult {
  deletedCount: number;
}

export interface ValidateDependenciesResult {
  valid: boolean;
  blockedBy: string[];
}

export interface AddTaskCheckedResult {
  task: Task | null;
  created: boolean;
  similarTasks: Array<{ task: Task; similarity: number }>;
  rejected: boolean;
  rejectionReason?: string;
}

export class TaskService {
  private duplicateConfig = {
    enabled: true,
    threshold: 0.5,
    warnThreshold: 0.5,
  };

  constructor(
    private db: DB,
    private boardService: BoardService,
  ) {}

  private async getTaskOrThrow(id: string): Promise<Task> {
    const task = await this.getTask(id);
    if (!task) {
      throw new KabanError(`Task '${id}' not found`, ExitCode.NOT_FOUND);
    }
    return task;
  }

  async addTask(input: AddTaskInput): Promise<Task> {
    const title = validateTitle(input.title);
    // Priority: createdBy > agent > "user"
    const createdBy = input.createdBy
      ? validateAgentName(input.createdBy)
      : input.agent
        ? validateAgentName(input.agent)
        : "user";
    const columnId = input.columnId ? validateColumnId(input.columnId) : "todo";

    const column = await this.boardService.getColumn(columnId);
    if (!column) {
      throw new KabanError(`Column '${columnId}' does not exist`, ExitCode.VALIDATION);
    }

    const now = new Date();
    const id = ulid();

    const maxPositionResult = await this.db
      .select({ max: sql<number>`COALESCE(MAX(position), -1)` })
      .from(tasks)
      .where(eq(tasks.columnId, columnId));

    const position = (maxPositionResult[0]?.max ?? -1) + 1;

    await this.db.insert(tasks).values({
      id,
      title,
      description: input.description ?? null,
      columnId,
      position,
      createdBy,
      assignedTo: null,
      parentId: null,
      dependsOn: input.dependsOn ?? [],
      files: input.files ?? [],
      labels: input.labels ?? [],
      blockedReason: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      archived: false,
      archivedAt: null,
    });

    return this.getTaskOrThrow(id);
  }

  async getTask(id: string): Promise<Task | null> {
    const rows = await this.db.select().from(tasks).where(eq(tasks.id, id));
    return rows[0] ?? null;
  }

  async listTasks(filter?: ListTasksFilter): Promise<Task[]> {
    const conditions = [];

    if (!filter?.includeArchived) {
      conditions.push(eq(tasks.archived, false));
    }

    if (filter?.columnId) {
      conditions.push(eq(tasks.columnId, filter.columnId));
    }
    const creatorFilter = filter?.createdBy ?? filter?.agent;
    if (creatorFilter) {
      conditions.push(eq(tasks.createdBy, creatorFilter));
    }
    if (filter?.assignee) {
      conditions.push(eq(tasks.assignedTo, filter.assignee));
    }
    if (filter?.blocked === true) {
      conditions.push(sql`${tasks.blockedReason} IS NOT NULL`);
    }

    if (conditions.length > 0) {
      return this.db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(tasks.columnId, tasks.position);
    }

    return this.db.select().from(tasks).orderBy(tasks.columnId, tasks.position);
  }

  async deleteTask(id: string): Promise<void> {
    const task = await this.getTask(id);
    if (!task) {
      throw new KabanError(`Task '${id}' not found`, ExitCode.NOT_FOUND);
    }

    await this.db.delete(tasks).where(eq(tasks.id, id));
  }

  async moveTask(id: string, columnId: string, options?: MoveTaskOptions): Promise<Task> {
    const task = await this.getTask(id);
    if (!task) {
      throw new KabanError(`Task '${id}' not found`, ExitCode.NOT_FOUND);
    }

    validateColumnId(columnId);
    const column = await this.boardService.getColumn(columnId);
    if (!column) {
      throw new KabanError(`Column '${columnId}' does not exist`, ExitCode.VALIDATION);
    }

    if (column.wipLimit && !options?.force) {
      const count = await this.getTaskCountInColumn(columnId);
      if (count >= column.wipLimit) {
        throw new KabanError(
          `Column '${column.name}' at WIP limit (${count}/${column.wipLimit}). Move a task out first.`,
          ExitCode.VALIDATION,
        );
      }
    }

    if (column.isTerminal && options?.validateDeps) {
      const depResult = await this.validateDependencies(id);
      if (!depResult.valid) {
        throw new KabanError(
          `Task '${id}' is blocked by incomplete dependencies: ${depResult.blockedBy.join(", ")}`,
          ExitCode.VALIDATION,
        );
      }
    }

    const now = new Date();
    const isTerminal = column.isTerminal;

    const maxPositionResult = await this.db
      .select({ max: sql<number>`COALESCE(MAX(position), -1)` })
      .from(tasks)
      .where(eq(tasks.columnId, columnId));

    const newPosition = (maxPositionResult[0]?.max ?? -1) + 1;

    await this.db
      .update(tasks)
      .set({
        columnId,
        position: newPosition,
        version: task.version + 1,
        updatedAt: now,
        completedAt: isTerminal ? now : task.completedAt,
        startedAt: columnId === "in_progress" && !task.startedAt ? now : task.startedAt,
      })
      .where(eq(tasks.id, id));

    return this.getTaskOrThrow(id);
  }

  async updateTask(id: string, input: UpdateTaskInput, expectedVersion?: number): Promise<Task> {
    const task = await this.getTask(id);
    if (!task) {
      throw new KabanError(`Task '${id}' not found`, ExitCode.NOT_FOUND);
    }

    if (expectedVersion !== undefined && task.version !== expectedVersion) {
      throw new KabanError(
        `Task modified by another agent, re-read required. Current version: ${task.version}`,
        ExitCode.CONFLICT,
      );
    }

    const updates: Record<string, unknown> = {
      version: task.version + 1,
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      updates.title = validateTitle(input.title);
    }
    if (input.description !== undefined) {
      updates.description = input.description;
    }
    if (input.assignedTo !== undefined) {
      updates.assignedTo = input.assignedTo ? validateAgentName(input.assignedTo) : null;
    }
    if (input.files !== undefined) {
      updates.files = input.files;
    }
    if (input.labels !== undefined) {
      updates.labels = input.labels;
    }

    await this.db
      .update(tasks)
      .set(updates)
      .where(
        expectedVersion !== undefined
          ? and(eq(tasks.id, id), eq(tasks.version, expectedVersion))
          : eq(tasks.id, id),
      );

    return this.getTaskOrThrow(id);
  }

  private async getTaskCountInColumn(columnId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(eq(tasks.columnId, columnId));
    return result[0]?.count ?? 0;
  }

  async archiveTasks(criteria: ArchiveTasksCriteria): Promise<ArchiveTasksResult> {
    const hasCriteria = criteria.status || criteria.olderThan || criteria.taskIds?.length;
    if (!hasCriteria) {
      throw new KabanError("At least one criteria must be provided", ExitCode.VALIDATION);
    }

    const conditions = [eq(tasks.archived, false)];

    if (criteria.status) {
      conditions.push(eq(tasks.columnId, criteria.status));
    }

    if (criteria.olderThan) {
      conditions.push(lt(tasks.createdAt, criteria.olderThan));
    }

    if (criteria.taskIds?.length) {
      conditions.push(inArray(tasks.id, criteria.taskIds));
    }

    const matchingTasks = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(...conditions));

    if (matchingTasks.length === 0) {
      return { archivedCount: 0, taskIds: [] };
    }

    const taskIds = matchingTasks.map((t) => t.id);
    const now = new Date();

    await this.db
      .update(tasks)
      .set({
        archived: true,
        archivedAt: now,
        updatedAt: now,
      })
      .where(inArray(tasks.id, taskIds));

    return {
      archivedCount: taskIds.length,
      taskIds,
    };
  }

  /**
   * Restores an archived task.
   * Note: WIP limits are intentionally bypassed for restore operations because
   * restore is a recovery operation - users should always be able to recover their work,
   * and archived tasks already existed in the system.
   */
  async restoreTask(taskId: string, targetColumnId?: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new KabanError(`Task '${taskId}' not found`, ExitCode.NOT_FOUND);
    }

    if (!task.archived) {
      throw new KabanError(`Task '${taskId}' is not archived`, ExitCode.VALIDATION);
    }

    const columnId = targetColumnId ?? task.columnId;

    if (targetColumnId) {
      validateColumnId(targetColumnId);
      const column = await this.boardService.getColumn(targetColumnId);
      if (!column) {
        throw new KabanError(`Column '${targetColumnId}' does not exist`, ExitCode.VALIDATION);
      }
    }

    const now = new Date();

    await this.db
      .update(tasks)
      .set({
        archived: false,
        archivedAt: null,
        columnId,
        version: task.version + 1,
        updatedAt: now,
      })
      .where(eq(tasks.id, taskId));

    return this.getTaskOrThrow(taskId);
  }

  async searchArchive(query: string, options?: SearchArchiveOptions): Promise<SearchArchiveResult> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    if (!query.trim()) {
      const countResult = await this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(tasks)
        .where(eq(tasks.archived, true));

      const total = countResult[0]?.count ?? 0;

      const archivedTasks = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.archived, true))
        .orderBy(tasks.archivedAt)
        .limit(limit)
        .offset(offset);

      return { tasks: archivedTasks, total };
    }

    const ftsQuery = query
      .trim()
      .split(/\s+/)
      .map((term) => `"${term}"`)
      .join(" ");

    type TaskRow = {
      id: string;
      title: string;
      description: string | null;
      column_id: string;
      position: number;
      created_by: string;
      assigned_to: string | null;
      parent_id: string | null;
      depends_on: string;
      files: string;
      labels: string;
      blocked_reason: string | null;
      version: number;
      created_at: number;
      updated_at: number;
      started_at: number | null;
      completed_at: number | null;
      archived: number;
      archived_at: number | null;
    };

    interface BunSqliteClient {
      prepare: (sql: string) => {
        all: (...args: unknown[]) => TaskRow[];
        get: (...args: unknown[]) => { count: number } | undefined;
      };
    }

    const client = this.db.$client as unknown as BunSqliteClient;

    const countRow = client
      .prepare(
        `SELECT COUNT(*) as count FROM tasks t
         JOIN tasks_fts fts ON t.id = fts.id
         WHERE tasks_fts MATCH ?
         AND t.archived = 1`,
      )
      .get(ftsQuery);

    const total = countRow?.count ?? 0;

    const rows = client
      .prepare(
        `SELECT t.* FROM tasks t
         JOIN tasks_fts fts ON t.id = fts.id
         WHERE tasks_fts MATCH ?
         AND t.archived = 1
         ORDER BY rank
         LIMIT ? OFFSET ?`,
      )
      .all(ftsQuery, limit, offset);

    const searchTasks: Task[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      columnId: row.column_id,
      position: row.position,
      createdBy: row.created_by,
      assignedTo: row.assigned_to,
      parentId: row.parent_id,
      dependsOn: JSON.parse(row.depends_on || "[]"),
      files: JSON.parse(row.files || "[]"),
      labels: JSON.parse(row.labels || "[]"),
      blockedReason: row.blocked_reason,
      version: row.version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      archived: Boolean(row.archived),
      archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    }));

    return { tasks: searchTasks, total };
  }

  async purgeArchive(criteria?: PurgeArchiveCriteria): Promise<PurgeArchiveResult> {
    const conditions = [eq(tasks.archived, true)];

    if (criteria?.olderThan) {
      conditions.push(lt(tasks.archivedAt, criteria.olderThan));
    }

    const matchingTasks = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(...conditions));

    if (matchingTasks.length === 0) {
      return { deletedCount: 0 };
    }

    const taskIds = matchingTasks.map((t) => t.id);

    await this.db.delete(tasks).where(inArray(tasks.id, taskIds));

    return { deletedCount: taskIds.length };
  }

  async resetBoard(): Promise<ResetBoardResult> {
    const allTasks = await this.db.select({ id: tasks.id }).from(tasks);

    if (allTasks.length === 0) {
      return { deletedCount: 0 };
    }

    await this.db.delete(tasks).where(sql`1=1`);

    return { deletedCount: allTasks.length };
  }

  async addDependency(taskId: string, dependsOnId: string): Promise<Task> {
    if (taskId === dependsOnId) {
      throw new KabanError("Task cannot depend on itself", ExitCode.VALIDATION);
    }

    const task = await this.getTaskOrThrow(taskId);
    await this.getTaskOrThrow(dependsOnId);

    if (task.dependsOn.includes(dependsOnId)) {
      return task;
    }

    const updatedDependsOn = [...task.dependsOn, dependsOnId];
    const now = new Date();

    await this.db
      .update(tasks)
      .set({
        dependsOn: updatedDependsOn,
        version: task.version + 1,
        updatedAt: now,
      })
      .where(eq(tasks.id, taskId));

    return this.getTaskOrThrow(taskId);
  }

  async removeDependency(taskId: string, dependsOnId: string): Promise<Task> {
    const task = await this.getTaskOrThrow(taskId);

    if (!task.dependsOn.includes(dependsOnId)) {
      return task;
    }

    const updatedDependsOn = task.dependsOn.filter((id) => id !== dependsOnId);
    const now = new Date();

    await this.db
      .update(tasks)
      .set({
        dependsOn: updatedDependsOn,
        version: task.version + 1,
        updatedAt: now,
      })
      .where(eq(tasks.id, taskId));

    return this.getTaskOrThrow(taskId);
  }

  async validateDependencies(taskId: string): Promise<ValidateDependenciesResult> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new KabanError(`Task '${taskId}' not found`, ExitCode.NOT_FOUND);
    }

    if (!task.dependsOn || task.dependsOn.length === 0) {
      return { valid: true, blockedBy: [] };
    }

    const terminalColumn = await this.boardService.getTerminalColumn();
    if (!terminalColumn) {
      return { valid: true, blockedBy: [] };
    }

    const blockedBy: string[] = [];

    for (const depId of task.dependsOn) {
      const depTask = await this.getTask(depId);
      if (depTask && depTask.columnId !== terminalColumn.id) {
        blockedBy.push(depId);
      }
    }

    return {
      valid: blockedBy.length === 0,
      blockedBy,
    };
  }

  async findSimilarTasks(
    title: string,
    threshold = 0.5,
  ): Promise<Array<{ task: Task; similarity: number }>> {
    const activeTasks = await this.listTasks({ includeArchived: false });

    return activeTasks
      .map((task) => ({
        task,
        similarity: jaccardSimilarity(title, task.title),
      }))
      .filter((result) => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }

  async addTaskChecked(
    input: AddTaskInput,
    options?: { force?: boolean },
  ): Promise<AddTaskCheckedResult> {
    const similarTasks = await this.findSimilarTasks(input.title, this.duplicateConfig.threshold);
    const highSimilarity = similarTasks.filter(
      (s) => s.similarity >= this.duplicateConfig.warnThreshold,
    );

    if (highSimilarity.length > 0 && !options?.force) {
      const similar = highSimilarity
        .map((s) => `"${s.task.title}" (${Math.round(s.similarity * 100)}%)`)
        .join(", ");

      return {
        task: null,
        created: false,
        similarTasks,
        rejected: true,
        rejectionReason: `Found ${highSimilarity.length} very similar task(s): ${similar}. Use force=true to create anyway.`,
      };
    }

    const task = await this.addTask(input);

    return {
      task,
      created: true,
      similarTasks,
      rejected: false,
    };
  }

  async getArchiveStats(): Promise<{
    totalArchived: number;
    byColumn: Record<string, number>;
    oldestArchivedAt: Date | null;
  }> {
    const archived = await this.db.select().from(tasks).where(eq(tasks.archived, true));

    const byColumn: Record<string, number> = {};
    let oldestArchivedAt: Date | null = null;

    for (const task of archived) {
      byColumn[task.columnId] = (byColumn[task.columnId] ?? 0) + 1;
      if (task.archivedAt && (!oldestArchivedAt || task.archivedAt < oldestArchivedAt)) {
        oldestArchivedAt = task.archivedAt;
      }
    }

    return {
      totalArchived: archived.length,
      byColumn,
      oldestArchivedAt,
    };
  }
}
