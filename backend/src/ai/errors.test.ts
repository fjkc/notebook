import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { AppError } from "../errors";
import { toAiError } from "./errors";

function apiError(statusCode: number) {
  return new APICallError({ message: `HTTP ${statusCode}`, url: "https://example.test", requestBodyValues: {}, statusCode });
}

describe("toAiError", () => {
  it("maps a 429 to RATE_LIMITED and keeps the cause", () => {
    const original = apiError(429);
    const error = toAiError(original);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "RATE_LIMITED" });
    expect(error.cause).toBe(original);
  });

  it("maps a RetryError whose last error is a 429 to RATE_LIMITED", () => {
    const retry = new RetryError({ message: "failed", reason: "maxRetriesExceeded", errors: [apiError(500), apiError(429)] });
    expect(toAiError(retry)).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("maps other API errors, retries and unknown values to a plain Error", () => {
    for (const original of [
      apiError(500),
      new RetryError({ message: "failed", reason: "maxRetriesExceeded", errors: [apiError(429), apiError(503)] }),
      new TypeError("fetch failed"),
      "boom",
    ]) {
      const error = toAiError(original);
      expect(error).not.toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
      expect(error.cause).toBe(original);
    }
  });

  it("passes an AppError through", () => {
    const original = new AppError("NOT_FOUND");
    expect(toAiError(original)).toBe(original);
  });
});
