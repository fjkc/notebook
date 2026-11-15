import { describe, expect, it } from "vitest";
import { CHUNK_MIN_CHARS, CHUNK_TARGET_CHARS, MAX_CHUNK_CHARS } from "../shared/limits";
import { chunkPages, normalizeWhitespace, type Chunk } from "./chunk";

const newText = (chunk: Chunk) => chunk.content.slice(chunk.overlapChars);
const noSpace = (text: string) => text.replace(/\s+/g, "");
const MAX_NEW_WITH_TAIL = CHUNK_TARGET_CHARS + 2 + (CHUNK_MIN_CHARS - 1);

function paragraph(seed: number, sentences = 6): string {
  return Array.from(
    { length: sentences },
    (_, i) => `Sentence ${seed}.${i} talks about rivers, soil and the weather in some detail.`,
  ).join(" ");
}

function longText(paragraphs: number): string {
  return Array.from({ length: paragraphs }, (_, i) => paragraph(i)).join("\n\n");
}

/** Checks the invariants every chunking result must hold. */
function expectWellFormed(chunks: Chunk[]) {
  chunks.forEach((chunk, i) => {
    expect(chunk.chunkIndex).toBe(i);
    expect(chunk.content.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    expect(newText(chunk).length).toBeLessThanOrEqual(MAX_NEW_WITH_TAIL);
    const previous = chunks[i - 1];
    if (previous && previous.page === chunk.page) {
      expect(chunk.overlapChars).toBeGreaterThan(0);
      const overlap = chunk.content.slice(0, chunk.overlapChars - 1);
      expect(chunk.content[chunk.overlapChars - 1]).toBe(" ");
      expect(previous.content.endsWith(overlap)).toBe(true);
    } else {
      expect(chunk.overlapChars).toBe(0);
    }
  });
}

describe("normalizeWhitespace", () => {
  it("collapses spaces and tabs, limits blank lines and trims", () => {
    expect(normalizeWhitespace("  a \t b\r\n\n\n\nc  ")).toBe("a b\n\nc");
  });
});

describe("chunkPages", () => {
  it("gives one chunk for a short text", () => {
    const chunks = chunkPages([{ page: null, text: "A short note.\n\nWith two paragraphs." }]);
    expect(chunks).toEqual([
      { chunkIndex: 0, page: null, content: "A short note.\n\nWith two paragraphs.", overlapChars: 0 },
    ]);
  });

  it("keeps chunks within the bounds for a long text", () => {
    const chunks = chunkPages([{ page: null, text: longText(30) }]);
    expect(chunks.length).toBeGreaterThan(5);
    expectWellFormed(chunks);
    // Only a chunk that absorbed a tail may exceed the target.
    chunks.slice(0, -1).forEach((chunk) => expect(newText(chunk).length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS));
  });

  it("never crosses a page, keeps page numbers and has no overlap across pages", () => {
    const chunks = chunkPages([
      { page: 1, text: longText(6) },
      { page: 2, text: longText(6) },
    ]);
    expectWellFormed(chunks);
    expect(new Set(chunks.map((c) => c.page))).toEqual(new Set([1, 2]));
    const firstOfPage2 = chunks.findIndex((c) => c.page === 2);
    expect(chunks[firstOfPage2]?.overlapChars).toBe(0);
    expect(chunks.slice(firstOfPage2).every((c) => c.page === 2)).toBe(true);
  });

  it("merges a short tail into the previous chunk of the same page", () => {
    const tail = "A short closing line.";
    const chunks = chunkPages([{ page: 3, text: `${paragraph(1, 14)}\n\n${tail}` }]);
    expectWellFormed(chunks);
    const last = chunks.at(-1)!;
    expect(last.content.endsWith(`\n\n${tail}`)).toBe(true);
    expect(newText(last).length).toBeGreaterThan(CHUNK_TARGET_CHARS - 200);
  });

  it("splits a 5,000-character sentence with spaces within the bound", () => {
    const sentence = "word ".repeat(1_000).trim();
    const chunks = chunkPages([{ page: null, text: sentence }]);
    expect(chunks.length).toBeGreaterThan(4);
    expectWellFormed(chunks);
    expect(chunks.map(newText).join("").replace(/\s/g, "")).toBe(noSpace(sentence));
  });

  it("splits a 5,000-character run without spaces within the bound", () => {
    const run = "x".repeat(5_000);
    const chunks = chunkPages([{ page: null, text: run }]);
    expectWellFormed(chunks);
    expect(chunks.map(newText).join("")).toBe(run);
  });

  it("never splits inside a surrogate pair", () => {
    const run = "😀".repeat(2_600); // 5,200 UTF-16 units
    const chunks = chunkPages([{ page: null, text: run }]);
    expectWellFormed(chunks);
    for (const chunk of chunks) expect(chunk.content).not.toMatch(/^[\udc00-\udfff]|[\ud800-\udbff]$/);
    expect(chunks.map(newText).join("")).toBe(run);
  });

  it("gives no chunks for empty input and whitespace-only pages", () => {
    expect(chunkPages([])).toEqual([]);
    expect(chunkPages([{ page: 1, text: "  \n\n\t " }, { page: 2, text: "" }])).toEqual([]);
  });

  it("numbers chunks across pages and skips empty pages", () => {
    const chunks = chunkPages([
      { page: 1, text: "First page." },
      { page: 2, text: "   " },
      { page: 3, text: "Third page." },
    ]);
    expect(chunks.map((c) => [c.chunkIndex, c.page])).toEqual([
      [0, 1],
      [1, 3],
    ]);
  });

  it.each([
    [
      "German",
      Array.from(
        { length: 40 },
        (_, i) =>
          `Absatz ${i}: Die Größe der Wälder an der Küste ändert sich langsam. Über die Jahre wächst das Moos. Ärzte prüfen öfter die Luft!`,
      ).join("\n\n"),
    ],
    [
      "Chinese",
      Array.from({ length: 40 }, (_, i) => `第${i}段。气候变化影响河流和土壤。科学家每年测量温度！这是重要的研究吗？`.repeat(4)).join(
        "\n\n",
      ),
    ],
  ])("preserves the content of a %s text", (_, text) => {
    const chunks = chunkPages([{ page: null, text }]);
    expect(chunks.length).toBeGreaterThan(1);
    expectWellFormed(chunks);
    expect(noSpace(chunks.map(newText).join(""))).toBe(noSpace(normalizeWhitespace(text)));
  });
});
