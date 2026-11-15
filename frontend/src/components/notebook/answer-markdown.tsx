"use client";

import { useMemo, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@repo/backend/shared";
import { CitationHook } from "./citation-hook";
import { remarkCitations } from "./remark-citations";

function Link({ href, children }: { href?: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

type AnswerMarkdownProps = { messageId: string; text: string; citations: readonly Citation[] };

/**
 * An answer as Markdown (NB-009 R11): GFM, raw HTML and images dropped, links in a new tab, and
 * citation markers whose numbers are in the answer's citation map shown as hooks (NB-010 R1).
 */
export function AnswerMarkdown({ messageId, text, citations }: AnswerMarkdownProps) {
  const byNumber = useMemo(() => new Map(citations.map((c) => [c.n, c])), [citations]);
  const validNumbers = useMemo(() => [...byNumber.keys()], [byNumber]);
  const components = useMemo<Components>(
    () => ({
      a: Link,
      // The <cite data-numbers="1,3"> elements come from remarkCitations; each number becomes a hook.
      cite: ({ node }) => {
        const numbers = String(node?.properties?.dataNumbers ?? "")
          .split(",")
          .map(Number)
          .filter((n) => byNumber.has(n));
        return (
          <span className="whitespace-nowrap">
            {numbers.map((n) => (
              <CitationHook key={n} messageId={messageId} citation={byNumber.get(n)!} />
            ))}
          </span>
        );
      },
    }),
    [byNumber, messageId],
  );
  return (
    <div className="space-y-3 break-words [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded-sm [&_code]:bg-surface [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface [&_pre]:p-3 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-rule [&_td]:px-2 [&_th]:border [&_th]:border-rule [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-6">
      <Markdown
        remarkPlugins={[remarkGfm, remarkCitations(validNumbers)]}
        skipHtml
        // Never load images from an answer: a prompt-injected source could make the model emit an
        // image URL that leaks the question or passages to another server, without a click.
        disallowedElements={["img"]}
        unwrapDisallowed
        components={components}
      >
        {text}
      </Markdown>
    </div>
  );
}
