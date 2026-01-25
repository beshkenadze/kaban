import { describe, expect, test } from "bun:test";
import { jaccardSimilarity } from "./similarity.js";

describe("jaccardSimilarity", () => {
  test("returns 1 for identical strings", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1);
    expect(jaccardSimilarity("fix the bug", "fix the bug")).toBe(1);
  });

  test("returns 0 for completely different strings", () => {
    expect(jaccardSimilarity("hello world", "foo bar")).toBe(0);
    expect(jaccardSimilarity("apple orange", "banana grape")).toBe(0);
  });

  test("returns correct similarity for partial overlap", () => {
    expect(jaccardSimilarity("hello world", "hello there")).toBe(1 / 3);
    expect(jaccardSimilarity("the quick fox", "the slow fox")).toBe(2 / 4);
  });

  test("is case insensitive", () => {
    expect(jaccardSimilarity("Hello World", "hello world")).toBe(1);
    expect(jaccardSimilarity("HELLO", "hello")).toBe(1);
    expect(jaccardSimilarity("HeLLo WoRLd", "hElLO wORld")).toBe(1);
  });

  test("handles empty strings", () => {
    expect(jaccardSimilarity("", "")).toBe(0);
    expect(jaccardSimilarity("hello", "")).toBe(0);
    expect(jaccardSimilarity("", "world")).toBe(0);
  });

  test("ignores non-alphanumeric characters", () => {
    expect(jaccardSimilarity("hello, world!", "hello world")).toBe(1);
    expect(jaccardSimilarity("fix: the bug", "fix the bug")).toBe(1);
    expect(jaccardSimilarity("hello-world", "hello world")).toBe(1);
  });

  test("handles strings with numbers", () => {
    expect(jaccardSimilarity("task 123", "task 123")).toBe(1);
    expect(jaccardSimilarity("version 2", "version 3")).toBe(1 / 3);
  });

  test("handles whitespace variations", () => {
    expect(jaccardSimilarity("hello   world", "hello world")).toBe(1);
    expect(jaccardSimilarity("  hello world  ", "hello world")).toBe(1);
  });
});
