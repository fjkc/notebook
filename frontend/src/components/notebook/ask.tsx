import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReaderContent } from "./reader";

/**
 * Ask (DESIGN.md → "Layout"): the chat area. In NB-006 it shows the empty state and a read-only
 * input; chat arrives in NB-009. Between 640 and 1023 px its header opens the Reader as a sheet.
 */
export function Ask() {
  return (
    <section aria-labelledby="ask-heading" className="flex min-h-0 min-w-0 flex-1 flex-col lg:basis-3/5">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-6">
        <h2 id="ask-heading" className="text-sm font-medium">
          Ask
        </h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex lg:hidden">
              Reader
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Reader</SheetTitle>
            </SheetHeader>
            <div className="px-4">
              <ReaderContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <h3 className="font-reading text-[1.375rem] leading-snug font-medium">Ask about your sources</h3>
          <p className="mt-2 text-graphite">
            Add a source first. Answers come only from your sources, with a hook to each passage.
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-6">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Read-only and aria-disabled, with no submit handler: it stays focusable for the tooltip. */}
            <Input
              aria-label="Ask about your sources"
              placeholder="Ask about your sources…"
              aria-disabled="true"
              readOnly
              className="aria-disabled:cursor-not-allowed"
            />
          </TooltipTrigger>
          <TooltipContent>Add a source first</TooltipContent>
        </Tooltip>
      </div>
    </section>
  );
}
