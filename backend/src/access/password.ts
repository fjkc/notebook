import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { MAX_PASSWORD_INPUT_CHARS } from "../shared/limits";

const PasswordInput = z.string().min(1).max(MAX_PASSWORD_INPUT_CHARS);

/** The submitted password if it's a non-empty string of at most MAX_PASSWORD_INPUT_CHARS, else null. */
export function parsePasswordInput(input: unknown): string | null {
  const result = PasswordInput.safeParse(input);
  return result.success ? result.data : null;
}

/** Compares SHA-256 digests in constant time, so neither length nor content leaks through timing. */
export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
