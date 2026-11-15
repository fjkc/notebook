"use client";

import type { Citation } from "@repo/backend/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { passageLabel, useNotebookState } from "./notebook-state";

/**
 * A citation hook (NB-010 R1): the only pill in the UI. Pressing it opens the Reader on its passage,
 * pressing the active hook again closes it. Hover changes colour only.
 */
export function CitationHook({ messageId, citation }: { messageId: string; citation: Citation }) {
  const { active, toggleCitation } = useNotebookState();
  const pressed = active?.messageId === messageId && active.citation.n === citation.n;
  const label = passageLabel(citation);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          onClick={(event) => toggleCitation(messageId, citation, event.currentTarget)}
          className={cn(
            "mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-hook px-1.5 align-[0.15em] font-sans text-xs leading-none font-medium tabular-nums not-italic transition-colors duration-150",
            pressed ? "bg-hook text-paper" : "bg-paper text-hook hover:bg-marker",
          )}
        >
          {citation.n}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
