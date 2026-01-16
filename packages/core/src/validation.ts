import { ExitCode, KabanError } from "./types.js";

const TITLE_MAX = 200;
const AGENT_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/;
const COLUMN_ID_REGEX = /^[a-z][a-z0-9_]*$/;
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function validateTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new KabanError("Title cannot be empty", ExitCode.VALIDATION);
  }
  if (trimmed.length > TITLE_MAX) {
    throw new KabanError(
      `Title exceeds maximum length of ${TITLE_MAX} characters`,
      ExitCode.VALIDATION,
    );
  }
  return trimmed;
}

export function validateAgentName(name: string): string {
  if (!AGENT_REGEX.test(name)) {
    throw new KabanError(
      `Invalid agent name: '${name}'. Must match: ${AGENT_REGEX}`,
      ExitCode.VALIDATION,
    );
  }
  return name;
}

export function validateColumnId(id: string): string {
  if (!COLUMN_ID_REGEX.test(id)) {
    throw new KabanError(
      `Invalid column ID: '${id}'. Must be lowercase alphanumeric with underscores`,
      ExitCode.VALIDATION,
    );
  }
  return id;
}

export function isValidUlid(id: string): boolean {
  return ULID_REGEX.test(id);
}

export function validateTaskId(id: string): string {
  if (!isValidUlid(id)) {
    throw new KabanError(`Invalid task ID: '${id}'`, ExitCode.VALIDATION);
  }
  return id;
}
