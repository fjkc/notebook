import type { SourceListItem } from "@repo/backend";
import { MAX_SOURCES_PER_NOTEBOOK } from "@repo/backend/shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AddSourceDialog, SOURCE_LIMIT_MESSAGE } from "./add-source-dialog";
import { SourceChip } from "./source-chip";
import { SourcePoller } from "./source-poller";

const EMPTY_COPY = "No sources yet. Add a PDF, a web page or some text to start.";

type ShelfProps = { notebookId: string; sources: SourceListItem[] };

/**
 * The Shelf (DESIGN.md → "Layout", NB-007 R14): a strip of source chips under the top bar from
 * 640 px, and below that a "Sources (n)" button that opens the same chips as a bottom sheet.
 */
export function Shelf({ notebookId, sources }: ShelfProps) {
  const atLimit = sources.length >= MAX_SOURCES_PER_NOTEBOOK;
  const inFlight = sources.some((source) => source.status === "pending" || source.status === "processing");

  return (
    <>
      <SourcePoller active={inFlight} />

      <section aria-label="Shelf" className="hidden border-b border-rule sm:block">
        <div className="flex items-center gap-4 overflow-x-auto px-4 py-3">
          <h2 className="shrink-0 text-sm font-medium">Shelf</h2>
          {sources.length === 0 ? (
            <p className="min-w-0 flex-1 text-sm text-graphite">{EMPTY_COPY}</p>
          ) : (
            <ul className="flex min-w-0 items-center gap-2">
              {sources.map((source) => (
                <li key={source.id} className="min-w-0 shrink-0">
                  <SourceChip source={source} />
                </li>
              ))}
            </ul>
          )}
          <AddSourceDialog notebookId={notebookId} atLimit={atLimit} />
        </div>
      </section>

      <div className="border-b border-rule px-4 py-2 sm:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Sources ({sources.length})
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-lg">
            <SheetHeader>
              <SheetTitle>Shelf</SheetTitle>
              <SheetDescription className={sources.length > 0 ? "sr-only" : undefined}>
                {sources.length > 0 ? `${sources.length} of ${MAX_SOURCES_PER_NOTEBOOK} sources` : EMPTY_COPY}
              </SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4 pb-6">
              {sources.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {sources.map((source) => (
                    <li key={source.id}>
                      <SourceChip source={source} className="w-full max-w-none" />
                    </li>
                  ))}
                </ul>
              )}
              <AddSourceDialog notebookId={notebookId} atLimit={atLimit} className="w-full" />
              {/* Tooltips don't open on tap, so small screens get the hint as text. */}
              {atLimit && <p className="text-center text-sm text-graphite">{SOURCE_LIMIT_MESSAGE}</p>}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
