import { parseCitations } from "@repo/backend/shared";

// Minimal mdast shapes, so the plugin needs no extra type package.
type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> };

/** A custom node that remark-rehype turns into <cite data-numbers="1,3"> (via hName). */
function citeNode(numbers: number[]): MdNode {
  return { type: "cite", children: [], data: { hName: "cite", hProperties: { dataNumbers: numbers.join(",") } } };
}

function visit(parent: MdNode, valid: ReadonlySet<number>): void {
  if (!parent.children) return;
  const children: MdNode[] = [];
  for (const child of parent.children) {
    // Only text nodes: code and inlineCode have their own types and are never touched.
    if (child.type !== "text" || !child.value) {
      visit(child, valid);
      children.push(child);
      continue;
    }
    for (const segment of parseCitations(child.value, valid)) {
      children.push(segment.type === "text" ? { type: "text", value: segment.text } : citeNode(segment.numbers));
    }
  }
  parent.children = children;
}

/**
 * Remark plugin (NB-009 R11): finds citation markers per text node, so Markdown structure stays intact,
 * and keeps only numbers in the answer's citation map.
 */
export function remarkCitations(validNumbers: readonly number[]) {
  const valid = new Set(validNumbers);
  return () => (tree: MdNode) => visit(tree, valid);
}
