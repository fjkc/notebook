"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SourceListItem } from "@repo/backend";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { prefersReducedMotion } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { useNotebookState } from "./notebook-state";
import { processInBackground } from "./process-source";
import { chipLabel, DeleteSourceDialog, SourcePopoverBody } from "./source-popover";

type ChipStatus = "processing" | "ready" | "failed";

const STATUS_LABEL: Record<ChipStatus, string> = { processing: "processing", ready: "ready", failed: "failed" };

function StatusDot({ status, excluded }: { status: ChipStatus; excluded: boolean }) {
  if (status === "processing") {
    return (
      <span aria-hidden="true" className="flex size-3 shrink-0 items-center justify-center">
        {/* Reduced motion: a static hollow dot instead of the spinner (DESIGN.md → "Motion"). */}
        <LoaderCircleIcon className="size-3 animate-spin text-graphite motion-reduce:hidden" />
        <span className="hidden size-2 rounded-full border border-graphite motion-reduce:block" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mx-0.5 size-2 shrink-0 rounded-full",
        status === "failed" ? "bg-danger" : excluded ? "border border-graphite" : "bg-ink",
      )}
    />
  );
}

type SourceChipProps = { source: SourceListItem; className?: string };

/**
 * One source on the Shelf (NB-007 R14): status dot, title and type; pressing it opens the popover.
 * While its own "Try again" call runs, the chip shows "processing" until a refresh catches up.
 * The active citation's source gets the marker background and is scrolled into view (NB-010 R4);
 * a ready source left out of answers shows graphite text and an unfilled dot (R7).
 */
export function SourceChip({ source, className }: SourceChipProps) {
  const router = useRouter();
  const { active, excluded: excludedIds, toggleExcluded } = useNotebookState();
  const highlighted = active?.citation.sourceId === source.id;
  const chipRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const status: ChipStatus =
    retrying || source.status === "pending" || source.status === "processing"
      ? "processing"
      : source.status;
  const excluded = status === "ready" && excludedIds.has(source.id);

  useEffect(() => {
    // Does nothing while the chip is hidden (the strip below 640 px).
    if (highlighted) {
      chipRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "instant" : "smooth",
      });
    }
  }, [highlighted, active]);

  function handleRetry() {
    setOpen(false);
    setRetrying(true);
    void processInBackground(source.id, () => {
      setRetrying(false);
      router.refresh();
    });
  }

  function handleDelete() {
    setOpen(false);
    setDeleting(true);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                ref={chipRef}
                type="button"
                aria-label={`${source.title}, ${STATUS_LABEL[status]}${excluded ? ", not used in answers" : ""}`}
                className={cn(
                  "flex h-8 max-w-64 min-w-0 shrink-0 items-center gap-2 rounded-[4px] border border-edge px-2.5 text-sm transition-colors",
                  highlighted ? "bg-marker text-ink" : "bg-surface hover:bg-paper",
                  excluded && !highlighted && "text-graphite",
                  className,
                )}
              >
                <StatusDot status={status} excluded={excluded} />
                <span className="min-w-0 truncate">{source.title}</span>
                <span className="shrink-0 text-xs text-graphite">
                  {status === "processing" ? "Processing" : chipLabel(source)}
                </span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{source.title}</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
          <SourcePopoverBody
            source={source}
            processing={status === "processing"}
            usedInAnswers={!excludedIds.has(source.id)}
            onToggleUse={() => toggleExcluded(source.id)}
            onRetry={handleRetry}
            onDelete={handleDelete}
          />
        </PopoverContent>
      </Popover>
      <DeleteSourceDialog source={source} open={deleting} onOpenChange={setDeleting} />
    </>
  );
}
