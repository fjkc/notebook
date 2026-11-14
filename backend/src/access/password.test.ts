import { describe, expect, it } from "vitest";
import { MAX_PASSWORD_INPUT_CHARS } from "../shared/limits";
import { parsePasswordInput, passwordMatches } from "./password";

describe("passwordMatches", () => {
  it("is true for equal inputs", () => {
    expect(passwordMatches("abc123", "abc123")).toBe(true);
  });

  it("is false for different inputs of the same length", () => {
    expect(passwordMatches("abc123", "abc124")).toBe(false);
  });

  it("is false for different lengths, without throwing", () => {
    expect(passwordMatches("abc", "abc123")).toBe(false);
    expect(passwordMatches("", "abc123")).toBe(false);
  });
});

describe("parsePasswordInput", () => {
  it("accepts a non-empty string up to the limit", () => {
    expect(parsePasswordInput("pw")).toBe("pw");
    expect(parsePasswordInput("x".repeat(MAX_PASSWORD_INPUT_CHARS))).toHaveLength(MAX_PASSWORD_INPUT_CHARS);
  });

  it.each([undefined, null, 5, "", "x".repeat(MAX_PASSWORD_INPUT_CHARS + 1)])("rejects %j", (input) => {
    expect(parsePasswordInput(input)).toBeNull();
  });
});
