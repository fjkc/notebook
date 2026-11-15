import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const EMPTY_COPY = "No sources yet. Add a PDF, a web page or some text to start.";

/** Sources arrive in NB-007; until then the button is unavailable but explained (DESIGN.md → "Components"). */
function AddSourceButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-disabled="true" className="shrink-0">
          Add source
        </Button>
      </TooltipTrigger>
      <TooltipContent>Available soon</TooltipContent>
    </Tooltip>
  );
}

/**
 * The Shelf (DESIGN.md → "Layout"): a strip under the top bar from 640 px, and below that a
 * "Sources (n)" button that opens it as a bottom sheet. Empty in NB-006.
 */
export function Shelf() {
  return (
    <>
      <section aria-label="Shelf" className="hidden border-b border-rule sm:block">
        <div className="flex items-center gap-4 overflow-x-auto px-4 py-3">
          <h2 className="shrink-0 text-sm font-medium">Shelf</h2>
          <p className="min-w-0 flex-1 text-sm text-graphite">{EMPTY_COPY}</p>
          <AddSourceButton />
        </div>
      </section>

      <div className="border-b border-rule px-4 py-2 sm:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Sources (0)
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-lg">
            <SheetHeader>
              <SheetTitle>Shelf</SheetTitle>
              <SheetDescription>{EMPTY_COPY}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-2 px-4 pb-6">
              <AddSourceButton />
              {/* Tooltips don't open on tap, so small screens get the hint as text. */}
              <p className="text-center text-sm text-graphite">Available soon</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
