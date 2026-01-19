import { ZodError } from "zod";
import { AgentNameSchema, ColumnIdSchema, TitleSchema, UlidSchema } from "./schemas.js";
import { ExitCode, KabanError } from "./types.js";

function wrapZodError(fn: () => string, fieldName: string): string {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues?.[0]?.message ?? `Invalid ${fieldName}`;
      throw new KabanError(message, ExitCode.VALIDATION);
    }
    throw error;
  }
}

export function validateTitle(title: string): string {
  return wrapZodError(() => TitleSchema.parse(title), "title");
}

export function validateAgentName(name: string): string {
  return wrapZodError(() => AgentNameSchema.parse(name), "agent name");
}

export function validateColumnId(id: string): string {
  return wrapZodError(() => ColumnIdSchema.parse(id), "column ID");
}

export function isValidUlid(id: string): boolean {
  return UlidSchema.safeParse(id).success;
}

export function validateTaskId(id: string): string {
  return wrapZodError(() => UlidSchema.parse(id), "task ID");
}
