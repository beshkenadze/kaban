import { describe, expect, test } from "bun:test";
import { KabanError } from "./types.js";
import { isValidUlid, validateAgentName, validateColumnId, validateTitle } from "./validation.js";

describe("validateTitle", () => {
  test("accepts valid title", () => {
    expect(() => validateTitle("Fix the bug")).not.toThrow();
  });

  test("rejects empty title", () => {
    expect(() => validateTitle("")).toThrow(KabanError);
  });

  test("rejects title over 200 chars", () => {
    const longTitle = "a".repeat(201);
    expect(() => validateTitle(longTitle)).toThrow(KabanError);
  });

  test("trims whitespace", () => {
    expect(validateTitle("  hello  ")).toBe("hello");
  });
});

describe("validateAgentName", () => {
  test("accepts valid names", () => {
    expect(() => validateAgentName("user")).not.toThrow();
    expect(() => validateAgentName("claude-code")).not.toThrow();
    expect(() => validateAgentName("agent_1")).not.toThrow();
    expect(() => validateAgentName("GPT4")).not.toThrow();
  });

  test("rejects invalid names", () => {
    expect(() => validateAgentName("my agent")).toThrow(KabanError);
    expect(() => validateAgentName("@claude")).toThrow(KabanError);
    expect(() => validateAgentName("")).toThrow(KabanError);
    expect(() => validateAgentName("1agent")).toThrow(KabanError);
  });
});

describe("validateColumnId", () => {
  test("accepts valid column IDs", () => {
    expect(() => validateColumnId("todo")).not.toThrow();
    expect(() => validateColumnId("in_progress")).not.toThrow();
  });

  test("rejects invalid column IDs", () => {
    expect(() => validateColumnId("In Progress")).toThrow(KabanError);
    expect(() => validateColumnId("")).toThrow(KabanError);
  });
});

describe("isValidUlid", () => {
  test("accepts valid ULID", () => {
    expect(isValidUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(true);
  });

  test("rejects invalid ULID", () => {
    expect(isValidUlid("invalid")).toBe(false);
    expect(isValidUlid("")).toBe(false);
  });
});
