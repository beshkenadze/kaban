import { and, eq, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { type DB, tasks } from "../db/index.js";
import type { Task } from "../types.js";
import { ExitCode, KabanError } from "../types.js";
import { validateAgentName, validateColumnId, validateTitle } from "../validation.js";
import type { BoardService } from "./board.js";

export interface AddTaskInput {
  title: string;
  description?: string;
  columnId?: string;
  agent?: string;
  dependsOn?: string[];
  files?: string[];
  labels?: string[];
}

export interface ListTasksFilter {
  columnId?: string;
  agent?: string;
  blocked?: boolean;
}

export interface MoveTaskOptions {
  force?: boolean;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: string | null;
  files?: string[];
  labels?: string[];
}

export class TaskService {
  constructor(
    private db: DB,
    private boardService: BoardService,
  ) {}

  private getTaskOrThrow(id: string): Task {
    const task = this.getTask(id);
    if (!task) {
      throw new KabanError(`Task '${id}' not found`, ExitCode.NOT_FOUND);
    }
    return task;
  }

  addTask(input: AddTaskInput): Task {
    const title = validateTitle(input.title);
    const agent = input.agent ? validateAgentName(input.agent) : "user";
    const columnId = input.columnId ? validateColumnId(input.columnId) : "todo";

    const column = this.boardService.getColumn(columnId);
    if (!column) {
      throw new KabanError(`Column '${columnId}' does not exist`, ExitCode.VALIDATION);
    }

    const now = new Date();
    const id = ulid();

    const maxPosition = this.db
      .select({ max: sql<number>`COALESCE(MAX(position), -1)` })
      .from(tasks)
      .where(eq(tasks.columnId, columnId))
      .get();

    const position = (maxPosition?.max ?? -1) + 1;

    this.db
      .insert(tasks)
      .values({
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
      })
      .run();

    return this.getTaskOrThrow(id);
  }

  getTask(id: string): Task | null {
    const row = this.db.select().from(tasks).where(eq(tasks.id, id)).get();
    return row ?? null;
  }

  listTasks(filter?: ListTasksFilter): Task[] {
    let query = this.db.select().from(tasks);

    const conditions = [];
    if (filter?.columnId) {
      conditions.push(eq(tasks.columnId, filter.columnId));
    }
    if (filter?.agent) {
      conditions.push(eq(tasks.createdBy, filter.agent));
    }
    if (filter?.blocked === true) {
      conditions.push(sql`${tasks.blockedReason} IS NOT NULL`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return query.orderBy(tasks.columnId, tasks.position).all();
  }

  deleteTask(id: string): void {
    const task = this.getTask(id);
    if (!task) {
      throw new KabanError(`Task '${id}' not found`, ExitCode.NOT_FOUND);
    }

    this.db.delete(tasks).where(eq(tasks.id, id)).run();
  }

  moveTask(id: string, columnId: string, options?: MoveTaskOptions): Task {
    const task = this.getTask(id);
    if (!task) {
      throw new KabanError(`Task '${id}' not found`, ExitCode.NOT_FOUND);
    }

    validateColumnId(columnId);
    const column = this.boardService.getColumn(columnId);
    if (!column) {
      throw new KabanError(`Column '${columnId}' does not exist`, ExitCode.VALIDATION);
    }

    if (column.wipLimit && !options?.force) {
      const count = this.getTaskCountInColumn(columnId);
      if (count >= column.wipLimit) {
        throw new KabanError(
          `Column '${column.name}' at WIP limit (${count}/${column.wipLimit}). Move a task out first.`,
          ExitCode.VALIDATION,
        );
      }
    }

    const now = new Date();
    const isTerminal = column.isTerminal;

    const maxPosition = this.db
      .select({ max: sql<number>`COALESCE(MAX(position), -1)` })
      .from(tasks)
      .where(eq(tasks.columnId, columnId))
      .get();

    const newPosition = (maxPosition?.max ?? -1) + 1;

    this.db
      .update(tasks)
      .set({
        columnId,
        position: newPosition,
        version: task.version + 1,
        updatedAt: now,
        completedAt: isTerminal ? now : task.completedAt,
        startedAt: columnId === "in_progress" && !task.startedAt ? now : task.startedAt,
      })
      .where(eq(tasks.id, id))
      .run();

    return this.getTaskOrThrow(id);
  }

  updateTask(id: string, input: UpdateTaskInput, expectedVersion?: number): Task {
    const task = this.getTask(id);
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

    this.db
      .update(tasks)
      .set(updates)
      .where(
        expectedVersion !== undefined
          ? and(eq(tasks.id, id), eq(tasks.version, expectedVersion))
          : eq(tasks.id, id),
      )
      .run();

    return this.getTaskOrThrow(id);
  }

  private getTaskCountInColumn(columnId: string): number {
    const result = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(eq(tasks.columnId, columnId))
      .get();
    return result?.count ?? 0;
  }
}
