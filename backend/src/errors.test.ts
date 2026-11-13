import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, describeError, toErrorBody, toUserMessage } from "./errors";

describe("toErrorBody", () => {
  it("maps an AppError to its code, status and default message", () => {
    expect(toErrorBody(new AppError("NOT_FOUND"))).toEqual({
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "This notebook or source doesn't exist." } },
    });
  });

  it("keeps a specific message for LIMIT_REACHED", () => {
    const error = new AppError("LIMIT_REACHED", "A notebook can have up to 10 sources.");
    expect(toErrorBody(error)).toEqual({
      status: 400,
      body: { error: { code: "LIMIT_REACHED", message: "A notebook can have up to 10 sources." } },
    });
  });

  it("maps a ZodError to VALIDATION with the first issue's message", () => {
    const schema = z.object({
      title: z.string().min(1, "Enter a title."),
      count: z.number({ error: "Count must be a number." }),
    });
    const result = schema.safeParse({ title: "", count: "x" });
    expect(result.success).toBe(false);
    expect(toErrorBody(result.error)).toEqual({
      status: 400,
      body: { error: { code: "VALIDATION", message: "Enter a title." } },
    });
  });

  it("maps an unknown error to INTERNAL without leaking its details", () => {
    const { status, body } = toErrorBody(new Error("connection string postgres://secret@host"));
    expect(status).toBe(500);
    expect(body).toEqual({
      error: { code: "INTERNAL", message: "Something went wrong on our side. Try again." },
    });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("maps non-Error throws to INTERNAL", () => {
    expect(toErrorBody("boom").body.error.code).toBe("INTERNAL");
    expect(toErrorBody(undefined).body.error.code).toBe("INTERNAL");
  });
});

describe("toUserMessage", () => {
  it("falls back to the code's message when no specific one is given", () => {
    expect(toUserMessage(new AppError("VALIDATION"))).toBe("Some of the input isn't valid.");
  });
});

describe("AppError cause", () => {
  it("keeps the underlying error as cause without changing the public body", () => {
    const network = new Error("ECONNRESET");
    const error = new AppError("URL_FETCH_FAILED", { cause: network });
    expect(error.cause).toBe(network);
    expect(toErrorBody(error).body.error.code).toBe("URL_FETCH_FAILED");
    const specific = new AppError("LIMIT_REACHED", "A notebook can have up to 10 sources.", { cause: network });
    expect(specific.cause).toBe(network);
    expect(toUserMessage(specific)).toBe("A notebook can have up to 10 sources.");
  });
});

describe("describeError", () => {
  it("never copies an error's own properties", () => {
    const error = Object.assign(new Error("Bad request"), {
      requestBodyValues: { prompt: "private document text" },
      responseBody: "private document text",
    });
    const summary = describeError(error);
    expect(summary).toMatchObject({ name: "Error", message: "Bad request" });
    expect(JSON.stringify(summary)).not.toContain("private document text");
  });

  it("cuts long messages", () => {
    const summary = describeError(new Error("x".repeat(1000)));
    expect(summary.message).toHaveLength(300);
    expect(summary.stack).not.toContain("x".repeat(301));
  });

  it("logs zod issue paths and codes, never the values", () => {
    const result = z.object({ key: z.string().min(10) }).safeParse({ key: "secret" });
    const summary = describeError(result.error);
    expect(summary.issues).toEqual([{ path: "key", code: "too_small" }]);
    expect(JSON.stringify(summary)).not.toContain("secret");
  });

  it("includes a bounded cause chain", () => {
    const inner = new Error("inner", { cause: new Error("root", { cause: new Error("too deep") }) });
    const summary = describeError(new AppError("RATE_LIMITED", { cause: inner }));
    expect(summary.cause?.message).toBe("inner");
    expect(summary.cause?.cause?.message).toBe("root");
    expect(summary.cause?.cause?.cause).toBeUndefined();
  });

  it("describes non-Error throws by type only", () => {
    expect(describeError("secret string")).toEqual({ name: "string" });
  });
});
