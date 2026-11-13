import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLogLine, logOperation } from "./log";

describe("buildLogLine", () => {
  it("drops fields that aren't allow-listed", () => {
    const line = buildLogLine({
      route: "chat",
      durationMs: 12.7,
      outcome: "ok",
      apiKey: "sk-secret",
      content: "document text",
      ownerId: "0f8e2c4a-1111-2222-3333-444455556666",
    });
    expect(line).toEqual({ level: "info", route: "chat", durationMs: 13, outcome: "ok" });
  });

  it("cuts the owner prefix to 8 characters", () => {
    const line = buildLogLine({
      route: "chat",
      durationMs: 1,
      outcome: "ok",
      ownerPrefix: "0f8e2c4a-1111-2222-3333-444455556666",
    });
    expect(line.ownerPrefix).toBe("0f8e2c4a");
  });

  it("keeps known error codes and drops unknown ones", () => {
    expect(buildLogLine({ route: "r", durationMs: 1, outcome: "error", errorCode: "NOT_FOUND" }))
      .toEqual({ level: "error", route: "r", durationMs: 1, outcome: "error", errorCode: "NOT_FOUND" });
    expect(buildLogLine({ route: "r", durationMs: 1, outcome: "error", errorCode: "leaked text" }))
      .not.toHaveProperty("errorCode");
  });
});

describe("logOperation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes one JSON line, errors to stderr", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    logOperation({ route: "health", durationMs: 5, outcome: "error", errorCode: "INTERNAL" });
    expect(err).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(err.mock.calls[0]?.[0]))).toMatchObject({ route: "health", errorCode: "INTERNAL" });
  });
});
