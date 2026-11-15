"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { SourceListItem } from "@repo/backend";
import { deleteSource } from "@/app/notebook/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Shown on the chip and in the popover. */
export const TYPE_LABEL: Record<SourceListItem["type"], string> = { text: "Text", url: "Web page", pdf: "PDF" };

/** The chip's type label: a PDF shows its page count once known ("12 p."). */
export function chipLabel(source: SourceListItem): string {
  return source.type === "pdf" && source.pageCount !== null ? `${source.pageCount} p.` : TYPE_LABEL[source.type];
}

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** "Text · 12,400 characters", "PDF · 12 pages"; the web page's host is a link (rendered below). */
export function sourceMeta(source: SourceListItem): string {
  const type = TYPE_LABEL[source.type];
  if (source.type === "pdf") {
    if (source.pageCount === null) return type;
    return `${type} · ${source.pageCount} ${source.pageCount === 1 ? "page" : "pages"}`;
  }
  if (source.type === "url") return type;
  return source.charCount === null ? type : `${type} · ${source.charCount.toLocaleString("en-US")} characters`;
}

type SourcePopoverBodyProps = {
  source: SourceListItem;
  /** True while this source's process call runs, before a refresh shows it. */
  processing: boolean;
  onRetry: () => void;
  onDelete: () => void;
};

/** What the popover of a chip shows (NB-007 R14): size, summary or error, retry and delete. */
export function SourcePopoverBody({ source, processing, onRetry, onDelete }: SourcePopoverBodyProps) {
  const failed = source.status === "failed" && !processing;
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <p className="leading-snug font-medium break-words">{source.title}</p>
        <SourceMeta source={source} />
      </div>
      {source.summary ? (
        <p className="font-reading text-sm leading-relaxed">{source.summary}</p>
      ) : (
        !failed && (
          <p className="text-sm text-graphite">
            {source.status === "ready" && !processing
              ? "No summary for this source. Its passages are still used in answers."
              : "The summary appears when processing is done."}
          </p>
        )
      )}
      {failed && (
        <div className="grid gap-2">
          <p className="text-sm text-danger">{source.error}</p>
          <Button type="button" size="sm" onClick={onRetry} className="justify-self-start">
            Try again
          </Button>
        </div>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="justify-self-start text-danger">
        Delete source
      </Button>
    </div>
  );
}

function SourceMeta({ source }: { source: SourceListItem }) {
  const host = source.type === "url" ? hostnameOf(source.url) : null;
  return (
    <p className="text-xs text-graphite">
      {sourceMeta(source)}
      {host && source.url && (
        <>
          {" · "}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline underline-offset-2 hover:text-ink"
          >
            {host}
          </a>
        </>
      )}
    </p>
  );
}

type DeleteSourceDialogProps = {
  source: SourceListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Delete confirmation for a source, allowed in every status (NB-007 R14). */
export function DeleteSourceDialog({ source, open, onOpenChange }: DeleteSourceDialogProps) {
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return; // Can't be closed while deleting.
    onOpenChange(next);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSource({ id: source.id });
      // NOT_FOUND: already gone (e.g. another tab). The outcome the user wanted.
      if (!result.ok && result.error.code !== "NOT_FOUND") {
        toast.error(result.error.message);
        return;
      }
      onOpenChange(false);
      toast.success("Source deleted.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
        onInteractOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="leading-snug break-words">Delete {source.title}?</DialogTitle>
          <DialogDescription>Its passages won&apos;t be used in answers any more.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting…" : "Delete source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
