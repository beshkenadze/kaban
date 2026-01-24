import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { type DB, tasks } from "../db/index.js";
import type {
  AddTaskInput as AddTaskInputSchema,
  ListTasksFilter as ListTasksFilterSchema,
  UpdateTaskInput as UpdateTaskInputSchema,
} from "../schemas.js";
import type { Task } from "../types.js";
import { ExitCode, KabanError } from "../types.js";
import { validateAgentName, validateColumnId, validateTitle } from "../validation.js";
import type { BoardService } from "./board.js";

export type AddTaskInput = AddTaskInputSchema;
export type ListTasksFilter = ListTasksFilterSchema;
export type UpdateTaskInput = UpdateTaskInputSchema;

export interface MoveTaskOptions {
  force?: boolean;
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

export class TaskService {
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
    const agent = input.agent ? validateAgentName(input.agent) : "user";
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
      createdBy: agent,
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
    if (filter?.columnId) {
      conditions.push(eq(tasks.columnId, filter.columnId));
    }
    if (filter?.agent) {
      conditions.push(eq(tasks.createdBy, filter.agent));
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

  async archiveTasks(
    _boardId: string,
    criteria: ArchiveTasksCriteria,
  ): Promise<ArchiveTasksResult> {
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
}
