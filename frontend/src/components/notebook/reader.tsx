"use client";

import { useState } from "react";
import type { SourceListItem } from "@repo/backend";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/use-media-query";
import { useNotebookState, type ActiveCitation } from "./notebook-state";
import { TYPE_LABEL } from "./source-popover";

/** What "About this source" says: the summary, or why there's none (NB-010 R3). */
function aboutText(source: SourceListItem | undefined): { text: string; summary: boolean } {
  if (!source) return { text: "This source was deleted.", summary: false };
  if (source.summary) return { text: source.summary, summary: true };
  // A ready source whose summary call failed won't get one later (NB-007's popover wording).
  if (source.status === "ready") return { text: "No summary for this source. Its passages are still used in answers.", summary: false };
  return { text: "The summary appears when processing is done.", summary: false };
}

/**
 * The passage for one citation: title, page or type, the excerpt with the marker highlight, then the
 * source's summary. The source comes from the notebook's list; a deleted one shows what the citation stored.
 */
function Passage({ active }: { active: ActiveCitation }) {
  const { sources } = useNotebookState();
  const { citation } = active;
  const source = sources.find((s) => s.id === citation.sourceId);
  const where = citation.page !== null ? `Page ${citation.page}` : source ? TYPE_LABEL[source.type] : null;
  const about = aboutText(source);
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="leading-snug font-medium break-words">{citation.sourceTitle}</p>
        {where && <p className="text-sm text-graphite">{where}</p>}
      </div>
      <blockquote className="font-reading text-[1.0625rem] leading-relaxed break-words whitespace-pre-line">
        <mark className="bg-marker text-ink [box-decoration-break:clone] px-0.5">{citation.excerpt}</mark>
      </blockquote>
      <hr className="border-rule" />
      <div className="grid gap-1">
        <p className="text-sm font-medium">About this source</p>
        <p className={about.summary ? "font-reading text-sm leading-relaxed" : "text-sm text-graphite"}>{about.text}</p>
      </div>
    </div>
  );
}

/**
 * The Reader (DESIGN.md → "Layout", NB-010 R3): the right pane from 1024 px, a sheet from the right
 * between 640 and 1023 px, a bottom sheet below 640 px. Sheets open only from a hook, and closing
 * one in any way clears the active citation.
 */
export function Reader() {
  const { active, clearCitation, lastHook } = useNotebookState();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const tablet = useMediaQuery("(min-width: 640px)");
  // Mounted only below 1024 px: a modal sheet hidden by CSS would still trap focus on desktop.
  const sheetOpen = active !== null && !desktop;
  // The last passage shown, so a closing sheet keeps its content while it animates out.
  const [shown, setShown] = useState<ActiveCitation | null>(null);
  if (active && active !== shown) setShown(active);

  return (
    <>
      <section aria-label="Reader" className="hidden min-h-0 basis-2/5 flex-col border-l border-rule lg:flex">
        <div className="flex h-12 items-center justify-between gap-2 px-6 pt-2">
          <h2 className="text-sm font-medium">Reader</h2>
          {active && (
            <Button type="button" variant="ghost" size="sm" onClick={clearCitation}>
              Close
            </Button>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {active ? `Showing passage ${active.citation.n} from ${active.citation.sourceTitle}` : ""}
        </p>
        <div className="min-h-0 overflow-y-auto px-6 py-4">
          {active ? (
            <Passage active={active} />
          ) : (
            <p className="font-reading text-[1.0625rem] leading-relaxed text-graphite">
              Press a numbered hook in an answer to read the passage here.
            </p>
          )}
        </div>
      </section>

      <Sheet open={sheetOpen} onOpenChange={(open) => !open && clearCitation()}>
        {shown && (
          <SheetContent
            side={tablet ? "right" : "bottom"}
            aria-describedby={undefined}
            className={tablet ? undefined : "max-h-[85dvh] rounded-t-lg"}
            onCloseAutoFocus={(event) => {
              // Back to the hook that opened it (Radix would pick the last focused element, which
              // a mouse press in Safari never sets).
              const hook = lastHook.current;
              if (hook?.isConnected) {
                event.preventDefault();
                hook.focus();
              }
            }}
          >
            <SheetHeader>
              <SheetTitle>Reader</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 overflow-y-auto px-4 pb-6">
              <Passage active={shown} />
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  );
}
