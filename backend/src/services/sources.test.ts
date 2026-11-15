import { describe, expect, it } from "vitest";
import { STUCK_SOURCE_MS } from "../shared/limits";
import { CLOCK_SKEW_MARGIN_MS, effectiveStatus, textTitle } from "./sources";

describe("textTitle", () => {
  it("uses a plain first line", () => {
    expect(textTitle("Climate notes\nSecond line")).toBe("Climate notes");
  });

  it("strips a Markdown heading", () => {
    expect(textTitle("## Field report: rivers \n\nBody")).toBe("Field report: rivers");
  });

  it("skips leading blank lines", () => {
    expect(textTitle("\n\n   \n  First real line\nmore")).toBe("First real line");
  });

  it("cuts a long line at a word boundary with an ellipsis", () => {
    const line = "The long history of rivers and soils in the northern valleys and how farmers adapted to change";
    const title = textTitle(line);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("…")).toBe(true);
    expect(line.startsWith(title.slice(0, -1))).toBe(true);
    expect(line[title.length - 1]).toBe(" ");
  });

  it("cuts a long line without spaces at 80 characters, never inside a surrogate pair", () => {
    expect(textTitle("x".repeat(200))).toBe(`${"x".repeat(79)}…`);
    const emoji = textTitle("😀".repeat(100));
    expect(emoji.length).toBeLessThanOrEqual(80);
    expect(emoji.slice(0, -1)).not.toMatch(/[\ud800-\udbff]$/);
  });
});

describe("effectiveStatus", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  const at = (msAgo: number) => new Date(now - msAgo).toISOString();
  const row = (status: "pending" | "processing" | "ready" | "failed", msAgo: number, error: string | null = null) => ({
    status,
    error,
    updatedAt: at(msAgo),
  });

  it.each(["pending", "processing"] as const)("keeps a fresh %s source", (status) => {
    expect(effectiveStatus(row(status, 60_000), now)).toEqual(row(status, 60_000));
  });

  it.each(["pending", "processing"] as const)("shows a stuck %s source as failed", (status) => {
    // Within the clock-skew margin it still shows as in flight; past it, as failed.
    expect(effectiveStatus(row(status, STUCK_SOURCE_MS + 1_000), now).status).toBe(status);
    expect(effectiveStatus(row(status, STUCK_SOURCE_MS + CLOCK_SKEW_MARGIN_MS + 1_000), now)).toMatchObject({
      status: "failed",
      error: "Processing timed out.",
    });
  });

  it("leaves failed and ready sources alone, however old", () => {
    const failed = row("failed", STUCK_SOURCE_MS * 10, "Lots of requests right now. Try again in a minute.");
    const ready = row("ready", STUCK_SOURCE_MS * 10);
    expect(effectiveStatus(failed, now)).toEqual(failed);
    expect(effectiveStatus(ready, now)).toEqual(ready);
  });
});
