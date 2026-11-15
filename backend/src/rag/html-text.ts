import { parseHTML } from "linkedom";

// Readability's article HTML → plain text with paragraph breaks (NB-008 R5), so the chunker sees paragraphs.

const BLOCK_TAGS = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "LI", "H1", "H2", "H3", "H4", "H5", "H6",
  "BLOCKQUOTE", "PRE", "TABLE", "TR", "TD", "TH", "DT", "DD", "FIGCAPTION",
]);
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

// Markers that can't occur in text: paragraph break and line break, resolved after the walk.
const PARA = "\u0000P\u0000";
const LINE = "\u0000L\u0000";

type MinimalNode = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<MinimalNode> };

/**
 * Walks the tree once in document order: every text node is emitted exactly once, block elements get
 * a paragraph break before and after, `br` a newline; script and style are skipped. Runs of breaks
 * collapse into one blank line, and whitespace inside a paragraph collapses to single spaces.
 */
export function htmlToText(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const out: string[] = [];

  const walk = (node: MinimalNode) => {
    if (node.nodeType === TEXT_NODE) {
      out.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== ELEMENT_NODE) return;
    const tag = node.nodeName.toUpperCase();
    if (SKIPPED_TAGS.has(tag)) return;
    if (tag === "BR") {
      out.push(LINE);
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) out.push(PARA);
    for (const child of Array.from(node.childNodes)) walk(child);
    if (block) out.push(PARA);
  };
  walk(document.body as unknown as MinimalNode);

  return out
    .join("")
    .split(PARA)
    .map((paragraph) =>
      paragraph
        .split(LINE)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean)
    .join("\n\n");
}
