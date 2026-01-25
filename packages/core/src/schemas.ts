import { z } from "zod/v4";

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const UlidSchema = z.string().regex(ULID_REGEX, "Invalid ULID format");

const TitleBaseSchema = z
  .string()
  .min(1, "Title cannot be empty")
  .max(200, "Title cannot exceed 200 characters");

export const TitleSchema = TitleBaseSchema.transform((s) => s.trim());

const AgentNameBaseSchema = z
  .string()
  .min(1, "Agent name cannot be empty")
  .max(50, "Agent name cannot exceed 50 characters")
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    "Agent name must start with letter, then alphanumeric with _ or -",
  );

export const AgentNameSchema = AgentNameBaseSchema.transform((s) => s.toLowerCase());

export const ColumnIdSchema = z
  .string()
  .min(1, "Column ID cannot be empty")
  .max(50, "Column ID cannot exceed 50 characters")
  .regex(/^[a-z0-9_]+$/, "Column ID must be lowercase alphanumeric with underscores");

export const TaskSchema = z.object({
  id: UlidSchema,
  title: z.string(),
  description: z.string().nullable(),
  columnId: z.string(),
  position: z.number().int().nonnegative(),
  createdBy: z.string(),
  assignedTo: z.string().nullable(),
  parentId: UlidSchema.nullable(),
  dependsOn: z.array(UlidSchema),
  files: z.array(z.string()),
  labels: z.array(z.string()),
  blockedReason: z.string().nullable(),
  version: z.number().int().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  archived: z.boolean().default(false),
  archivedAt: z.date().nullable().optional(),
});

export const ColumnSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int().nonnegative(),
  wipLimit: z.number().int().positive().nullable(),
  isTerminal: z.boolean(),
});

export const BoardSchema = z.object({
  id: UlidSchema,
  name: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const BoardResponseSchema = z.object({
  id: UlidSchema,
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ColumnConfigSchema = z.object({
  id: ColumnIdSchema,
  name: z.string().min(1).max(50),
  wipLimit: z.number().int().positive().optional(),
  isTerminal: z.boolean().optional(),
});

export const ConfigSchema = z.object({
  board: z.object({
    name: z.string().min(1).max(100),
  }),
  columns: z.array(ColumnConfigSchema).min(1),
  defaults: z.object({
    column: ColumnIdSchema,
    agent: AgentNameSchema,
  }),
});

export const AddTaskInputSchema = z.object({
  title: TitleSchema,
  description: z.string().max(5000).optional(),
  columnId: ColumnIdSchema.optional(),
  agent: AgentNameSchema.optional(),
  dependsOn: z.array(UlidSchema).optional(),
  files: z.array(z.string()).optional(),
  labels: z.array(z.string().max(50)).optional(),
});

export const UpdateTaskInputSchema = z.object({
  title: TitleSchema.optional(),
  description: z.string().max(5000).nullable().optional(),
  assignedTo: AgentNameSchema.nullable().optional(),
  files: z.array(z.string()).optional(),
  labels: z.array(z.string().max(50)).optional(),
});

export const MoveTaskInputSchema = z.object({
  id: UlidSchema,
  columnId: ColumnIdSchema,
  force: z.boolean().optional(),
});

export const ListTasksFilterSchema = z.object({
  columnId: ColumnIdSchema.optional(),
  agent: AgentNameSchema.optional(),
  assignee: AgentNameSchema.optional(),
  blocked: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
});

export const GetTaskInputSchema = z.object({
  id: UlidSchema,
});

export const DeleteTaskInputSchema = z.object({
  id: UlidSchema,
});

export const TaskResponseSchema = TaskSchema.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable().optional(),
});

export const BoardStatusSchema = z.object({
  board: BoardResponseSchema,
  columns: z.array(
    ColumnSchema.extend({
      taskCount: z.number().int().nonnegative(),
    }),
  ),
  totalTasks: z.number().int().nonnegative(),
});

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        message: z.string(),
        code: z.number(),
      })
      .optional(),
  });

export type Task = z.infer<typeof TaskSchema>;
export type Column = z.infer<typeof ColumnSchema>;
export type Board = z.infer<typeof BoardSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type AddTaskInput = z.infer<typeof AddTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
export type MoveTaskInput = z.infer<typeof MoveTaskInputSchema>;
export type ListTasksFilter = z.infer<typeof ListTasksFilterSchema>;
export type BoardStatus = z.infer<typeof BoardStatusSchema>;

const AddTaskInputJsonSchema = z.object({
  title: TitleBaseSchema,
  description: z.string().max(5000).optional(),
  columnId: ColumnIdSchema.optional(),
  agent: AgentNameBaseSchema.optional(),
  dependsOn: z.array(UlidSchema).optional(),
  files: z.array(z.string()).optional(),
  labels: z.array(z.string().max(50)).optional(),
});

const UpdateTaskInputJsonSchema = z.object({
  title: TitleBaseSchema.optional(),
  description: z.string().max(5000).nullable().optional(),
  assignedTo: AgentNameBaseSchema.nullable().optional(),
  files: z.array(z.string()).optional(),
  labels: z.array(z.string().max(50)).optional(),
});

const ListTasksFilterJsonSchema = z.object({
  columnId: ColumnIdSchema.optional(),
  agent: AgentNameBaseSchema.optional(),
  blocked: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
});

const ColumnConfigJsonSchema = z.object({
  id: ColumnIdSchema,
  name: z.string().min(1).max(50),
  wipLimit: z.number().int().positive().optional(),
  isTerminal: z.boolean().optional(),
});

const ConfigJsonSchema = z.object({
  board: z.object({
    name: z.string().min(1).max(100),
  }),
  columns: z.array(ColumnConfigJsonSchema).min(1),
  defaults: z.object({
    column: ColumnIdSchema,
    agent: AgentNameBaseSchema,
  }),
});

export const jsonSchemas = {
  Task: z.toJSONSchema(TaskResponseSchema),
  Column: z.toJSONSchema(ColumnSchema),
  Board: z.toJSONSchema(BoardResponseSchema),
  Config: z.toJSONSchema(ConfigJsonSchema),
  AddTaskInput: z.toJSONSchema(AddTaskInputJsonSchema),
  UpdateTaskInput: z.toJSONSchema(UpdateTaskInputJsonSchema),
  MoveTaskInput: z.toJSONSchema(MoveTaskInputSchema),
  ListTasksFilter: z.toJSONSchema(ListTasksFilterJsonSchema),
  BoardStatus: z.toJSONSchema(BoardStatusSchema),
} as const;

export type SchemaName = keyof typeof jsonSchemas;

export function getJsonSchema(name: SchemaName) {
  return jsonSchemas[name];
}
