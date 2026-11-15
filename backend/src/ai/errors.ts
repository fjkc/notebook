import { APICallError, RetryError } from "ai";
import { AppError } from "../errors";

function isRateLimit(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 429;
}

/**
 * Maps a Gemini failure: a 429 (directly, or as the last error after the SDK's retries) becomes
 * RATE_LIMITED; anything else a plain Error (→ INTERNAL). The original is kept as `cause` for the log.
 */
export function toAiError(error: unknown): Error {
  if (error instanceof AppError) return error;
  const last = RetryError.isInstance(error) ? error.lastError : error;
  if (isRateLimit(last)) return new AppError("RATE_LIMITED", { cause: error });
  return new Error("Gemini call failed", { cause: error });
}
