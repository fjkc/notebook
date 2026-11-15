import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkCitations } from "./remark-citations";

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  // The <cite> elements come from remarkCitations. NB-010 replaces these numbers with hooks.
  cite: ({ node }) => {
    const numbers = String(node?.properties?.dataNumbers ?? "");
    return <sup className="ml-0.5 font-sans text-xs text-graphite not-italic">{numbers.replaceAll(",", ", ")}</sup>;
  },
};

/**
 * An answer as Markdown (NB-009 R11): GFM, raw HTML dropped (skipHtml), links in a new tab, and
 * citation markers whose numbers are in the answer's citation map shown as superscript numbers.
 */
export function AnswerMarkdown({ text, validNumbers }: { text: string; validNumbers: readonly number[] }) {
  return (
    <div className="space-y-3 break-words [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded-sm [&_code]:bg-surface [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface [&_pre]:p-3 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-rule [&_td]:px-2 [&_th]:border [&_th]:border-rule [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-6">
      <Markdown remarkPlugins={[remarkGfm, remarkCitations(validNumbers)]} skipHtml components={components}>
        {text}
      </Markdown>
    </div>
  );
}
