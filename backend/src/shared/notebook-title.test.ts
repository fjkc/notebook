import { describe, expect, it } from "vitest";
import { NotebookTitle } from "./notebook-title";

function firstMessage(input: string): string | undefined {
  const result = NotebookTitle.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("NotebookTitle", () => {
  it("trims", () => {
    expect(NotebookTitle.parse("  Climate reading  ")).toBe("Climate reading");
  });

  it("rejects empty and whitespace-only titles", () => {
    expect(firstMessage("")).toBe("Give the notebook a name.");
    expect(firstMessage("   ")).toBe("Give the notebook a name.");
  });

  it("rejects line breaks and tabs", () => {
    const message = "Names can't contain line breaks or control characters.";
    expect(firstMessage("Climate\nreading")).toBe(message);
    expect(firstMessage("Climate\treading")).toBe(message);
  });

  it("allows 120 characters and rejects 121", () => {
    expect(NotebookTitle.parse("a".repeat(120))).toHaveLength(120);
    expect(firstMessage("a".repeat(121))).toBe("Names can be up to 120 characters.");
  });

  it("reports control characters before length", () => {
    expect(firstMessage(`${"a".repeat(130)}\tb`)).toBe("Names can't contain line breaks or control characters.");
  });

  it("accepts German umlauts and Japanese text", () => {
    expect(NotebookTitle.parse("Übungen für Größen")).toBe("Übungen für Größen");
    expect(NotebookTitle.parse("気候変動の読書会")).toBe("気候変動の読書会");
  });
});
