// Citation map and marker helpers (docs/ARCHITECTURE.md §7). Client-safe: the Ask pane parses
// markers with it, the chat service filters saved citations with it.

/** One numbered passage an answer may cite. Sent as message metadata and stored with the answer. */
export type Citation = {
  /** The number used in the answer. */
  n: number;
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  page: number | null;
  /** Chunk content, at most CITATION_EXCERPT_CHARS characters. */
  excerpt: string;
};

export type CitationSegment = { type: "text"; text: string } | { type: "cite"; numbers: number[] };

type ValidNumbers = ReadonlySet<number> | readonly number[];

/**
 * One or more adjacent markers like `[1]`, `[1, 3]` or `[1][3]`. Not followed by "(", so a Markdown
 * link `[1](url)` isn't a marker. `[^1]` and `[a]` never match (a digit must follow "[").
 */
const MARKER_RUN = /(?:\[\s*\d+(?:\s*,\s*\d+)*\s*\])+(?!\()/g;

function toSet(valid: ValidNumbers): ReadonlySet<number> {
  return valid instanceof Set ? valid : new Set(valid);
}

/** The valid numbers of one marker run, in order, without repeats. */
function numbersIn(run: string, valid: ReadonlySet<number>): number[] {
  const numbers: number[] = [];
  for (const digits of run.match(/\d+/g) ?? []) {
    const n = Number(digits);
    if (valid.has(n) && !numbers.includes(n)) numbers.push(n);
  }
  return numbers;
}

/**
 * Splits plain text (one Markdown text node, never raw Markdown) into text and citation segments.
 * Adjacent markers merge into one segment; numbers not in `validNumbers` are dropped, and a marker
 * with none left stays plain text.
 */
export function parseCitations(text: string, validNumbers: ValidNumbers): CitationSegment[] {
  const valid = toSet(validNumbers);
  const segments: CitationSegment[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    const last = segments.at(-1);
    if (last?.type === "text") last.text += value;
    else segments.push({ type: "text", text: value });
  };

  let cursor = 0;
  for (const match of text.matchAll(MARKER_RUN)) {
    const numbers = numbersIn(match[0], valid);
    if (numbers.length === 0) continue;
    pushText(text.slice(cursor, match.index));
    segments.push({ type: "cite", numbers });
    cursor = match.index + match[0].length;
  }
  pushText(text.slice(cursor));
  return segments;
}

/** Raw Markdown without fenced code blocks and inline code spans, whose brackets aren't markers. */
function withoutCode(markdown: string): string {
  const kept: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const opener = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && opener) fence = opener;
    else if (fence !== null && opener?.startsWith(fence[0]!) && opener.length >= fence.length) fence = null;
    else if (fence === null) kept.push(line);
  }
  return kept.join("\n").replace(/(`+)[\s\S]*?\1/g, "");
}

/** The valid citation numbers used anywhere in an answer's raw Markdown (code ignored), ascending. */
export function usedCitationNumbers(markdown: string, validNumbers: ValidNumbers): number[] {
  const valid = toSet(validNumbers);
  const used = new Set<number>();
  for (const match of withoutCode(markdown).matchAll(MARKER_RUN)) {
    for (const n of numbersIn(match[0], valid)) used.add(n);
  }
  return [...used].sort((a, b) => a - b);
}

/** Removes every numeric marker and the spaces before it ("real [1][3]." → "real."). */
export function stripCitationMarkers(markdown: string): string {
  return markdown.replace(/[ \t]*(?:\[\s*\d+(?:\s*,\s*\d+)*\s*\])+(?!\()/g, "");
}

/** Cuts text to `max` characters at a word boundary, ending in "…" when it was cut. */
export function cutExcerpt(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  let cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.search(/\s\S*$/);
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  else if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}
