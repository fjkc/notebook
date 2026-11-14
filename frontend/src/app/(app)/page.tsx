import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Home (DESIGN.md → "Layout", home). Notebooks arrive in M3; until then the list area shows the empty state.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[1.75rem] leading-tight font-semibold">Your notebooks</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* aria-disabled, not disabled: it stays focusable so the tooltip works by keyboard too. */}
            <Button type="button" aria-disabled="true" className="w-full sm:w-auto">
              New notebook
            </Button>
          </TooltipTrigger>
          <TooltipContent>Available soon</TooltipContent>
        </Tooltip>
        {/* Tooltips don't open on tap, so small screens get the hint as text. */}
        <p className="-mt-2 text-center text-sm text-graphite sm:hidden">Available soon</p>
      </div>

      <section className="mt-10 border-t border-rule pt-10">
        <h2 className="font-reading text-[1.375rem] leading-snug font-medium">No notebooks yet</h2>
        <p className="mt-2 text-graphite">
          A notebook holds your sources and the questions you ask about them.
        </p>
      </section>
    </main>
  );
}
