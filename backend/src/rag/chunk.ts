import { CHUNK_MIN_CHARS, CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS } from "../shared/limits";

// Pure chunker (docs/ARCHITECTURE.md §6 step 4, NB-007 R3). Each page is chunked on its own, so a
// chunk never crosses a page and its page number stays exact.

export type PageText = { page: number | null; text: string };
export type Chunk = {
  chunkIndex: number;
  page: number | null;
  content: string;
  /** Length of the overlap prefix (overlap + one space) in `content`; 0 for a page's first chunk. */
  overlapChars: number;
};

/** How far back from the target a hard split looks for whitespace. */
const HARD_SPLIT_WINDOW = 100;

type Piece = { text: string; paragraph: number };

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** Spaces and tabs → one space, three or more newlines → two, trimmed. */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits after . ! ? … followed by whitespace, and after 。！？ (no whitespace needed). */
function splitSentences(paragraph: string): string[] {
  const sentences: string[] = [];
  const boundary = /[.!?…](?=\s)|[。！？]/g;
  let start = 0;
  for (const match of paragraph.matchAll(boundary)) {
    const end = match.index + match[0].length;
    const sentence = paragraph.slice(start, end).trim();
    if (sentence) sentences.push(sentence);
    start = end;
  }
  const rest = paragraph.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

/** Cuts a too-long sentence at the last whitespace near the target, else exactly at it (surrogate-safe). */
function hardSplit(sentence: string): string[] {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > CHUNK_TARGET_CHARS) {
    const windowStart = CHUNK_TARGET_CHARS - HARD_SPLIT_WINDOW;
    const window = rest.slice(windowStart, CHUNK_TARGET_CHARS);
    const lastSpace = window.search(/\s(?=\S*$)/);
    let cut = lastSpace >= 0 ? windowStart + lastSpace : CHUNK_TARGET_CHARS;
    if (lastSpace < 0 && isHighSurrogate(rest.charCodeAt(cut - 1))) cut -= 1;
    parts.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

function toPieces(text: string): Piece[] {
  const pieces: Piece[] = [];
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .forEach((paragraph, index) => {
      const sentences = paragraph.length > CHUNK_TARGET_CHARS ? splitSentences(paragraph) : [paragraph];
      for (const sentence of sentences) {
        const parts = sentence.length > CHUNK_TARGET_CHARS ? hardSplit(sentence) : [sentence];
        for (const part of parts) pieces.push({ text: part, paragraph: index });
      }
    });
  return pieces;
}

/** Packs pieces in order while a chunk's new text (pieces plus separators) stays within the target. */
function pack(pieces: Piece[]): string[] {
  const chunks: string[] = [];
  let current = "";
  let lastParagraph = -1;
  for (const piece of pieces) {
    const separator = current ? (piece.paragraph === lastParagraph ? " " : "\n\n") : "";
    if (current && current.length + separator.length + piece.text.length > CHUNK_TARGET_CHARS) {
      chunks.push(current);
      current = piece.text;
    } else {
      current += separator + piece.text;
    }
    lastParagraph = piece.paragraph;
  }
  if (current) chunks.push(current);
  return chunks;
}

/** The last up to 150 characters of `content`, cut at whitespace when there is any, never inside a surrogate pair. */
function overlapOf(content: string): string {
  let tail = content.slice(-CHUNK_OVERLAP_CHARS);
  if (tail.length > 0 && isLowSurrogate(tail.charCodeAt(0))) tail = tail.slice(1);
  const space = tail.search(/\s/);
  if (space === -1) return tail;
  const cut = tail.slice(space).trimStart();
  return cut || tail;
}

export function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    const newTexts = pack(toPieces(normalizeWhitespace(text)));
    // Tail: a short last chunk joins the previous chunk of the same page.
    const last = newTexts.at(-1);
    if (newTexts.length >= 2 && last !== undefined && last.length < CHUNK_MIN_CHARS) {
      newTexts.pop();
      newTexts[newTexts.length - 1] += `\n\n${last}`;
    }
    let previous: string | undefined;
    for (const newText of newTexts) {
      const overlap = previous === undefined ? "" : overlapOf(previous);
      const content = overlap ? `${overlap} ${newText}` : newText;
      chunks.push({ chunkIndex: chunks.length, page, content, overlapChars: overlap ? overlap.length + 1 : 0 });
      previous = content;
    }
  }
  return chunks;
}
