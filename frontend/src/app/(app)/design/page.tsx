import type { Metadata } from "next";
import { NotebookRow } from "@/components/home/notebook-row";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CitationDemo, DialogDemo, DropdownDemo, ToastDemo } from "./demos";
import { TokenSwatches } from "./token-swatches";

// Design reference (docs/DESIGN.md). Behind the access gate, not linked from the UI.
export const metadata: Metadata = {
  title: "Design reference",
  robots: { index: false, follow: false },
};

const TYPE_SCALE = [
  { name: "Page heading", className: "text-[1.75rem] leading-[1.2] font-semibold", sample: "Your notebooks" },
  { name: "Section heading", className: "text-[1.375rem] leading-[1.3] font-medium", sample: "Takeaways" },
  {
    name: "Reading (Newsreader)",
    className: "font-reading text-[1.0625rem] leading-[1.6]",
    sample: "Answers, passages and notes are set in the reading face.",
  },
  { name: "Body UI", className: "text-base leading-normal", sample: "Add a PDF, a web page or pasted text." },
  { name: "Small UI", className: "text-sm leading-[1.45]", sample: "3 sources · edited 12 Nov" },
  { name: "Caption", className: "text-xs leading-[1.4] text-graphite", sample: "Page 4 of 18" },
];

const MOCK_NOTEBOOKS = [
  { href: "/design#list", title: "Climate report reading group", sourceCount: 3, edited: "12 Nov" },
  { href: "/design#list", title: "Thesis: early modern trade routes", sourceCount: 7, edited: "9 Nov" },
  { href: "/design#list", title: "Onboarding notes", sourceCount: 1, edited: "2 Nov" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-t border-rule py-8">
      <h2 className="mb-5 text-[1.375rem] leading-[1.3] font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-[1.75rem] leading-[1.2] font-semibold">Design reference</h1>
      <p className="mt-2 mb-8 text-graphite">
        Tokens, type and components as described in docs/DESIGN.md. Switch the theme in the top bar to check both.
      </p>

      <Section id="colour" title="Colour">
        <TokenSwatches />
      </Section>

      <Section id="type" title="Type">
        <dl className="flex flex-col gap-4">
          {TYPE_SCALE.map((row) => (
            <div key={row.name} className="flex flex-col gap-1">
              <dt className="text-xs text-graphite">{row.name}</dt>
              <dd className={row.className}>{row.sample}</dd>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-graphite">Wordmark</dt>
            <dd>
              <Wordmark />
            </dd>
          </div>
        </dl>
      </Section>

      <Section id="buttons" title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Add source</Button>
          <Button variant="outline">Cancel</Button>
          <Button variant="ghost">Show more</Button>
          <Button variant="destructive">Delete notebook</Button>
          <Button variant="link">Open the source</Button>
          <Button aria-disabled="true">Not available</Button>
        </div>
      </Section>

      <Section id="fields" title="Fields">
        <div className="flex max-w-md flex-col gap-3">
          <label htmlFor="design-input" className="text-sm font-medium">
            Notebook title
          </label>
          <Input id="design-input" placeholder="Untitled notebook" />
          <label htmlFor="design-textarea" className="text-sm font-medium">
            Pasted text
          </label>
          <Textarea id="design-textarea" placeholder="Ask about your sources…" />
        </div>
      </Section>

      <Section id="overlays" title="Overlays">
        <div className="flex flex-wrap gap-3">
          <DropdownDemo />
          <DialogDemo />
          <ToastDemo />
        </div>
      </Section>

      <Section id="citation" title="Citation and Reader">
        <CitationDemo />
      </Section>

      <Section id="list" title="Notebook list">
        <ul className="max-w-[760px]">
          {MOCK_NOTEBOOKS.map((notebook) => (
            <NotebookRow key={notebook.title} {...notebook} />
          ))}
        </ul>
      </Section>
    </main>
  );
}
