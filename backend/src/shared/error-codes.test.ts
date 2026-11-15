import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "./error-codes";

describe("ERROR_CODES", () => {
  const expected = [
    "RATE_LIMITED",
    "NOT_FOUND",
    "UNAUTHORIZED",
    "VALIDATION",
    "LIMIT_REACHED",
    "FILE_TOO_LARGE",
    "NO_TEXT_FOUND",
    "URL_FETCH_FAILED",
    "UPLOAD_INCOMPLETE",
    "ALREADY_PROCESSING",
    "INTERNAL",
  ];

  it("defines exactly the codes from docs/ARCHITECTURE.md", () => {
    expect(Object.keys(ERROR_CODES).sort()).toEqual([...expected].sort());
  });

  it.each(Object.entries(ERROR_CODES))("%s has an HTTP error status and a message", (_code, entry) => {
    expect(entry.status).toBeGreaterThanOrEqual(400);
    expect(entry.status).toBeLessThan(600);
    expect(entry.message.trim().length).toBeGreaterThan(0);
  });

  it("derives the file size message from the limit", () => {
    expect(ERROR_CODES.FILE_TOO_LARGE.message).toBe("PDFs can be up to 10 MB.");
  });
});
