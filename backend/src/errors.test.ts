import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, toErrorBody, toUserMessage } from "./errors";

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
