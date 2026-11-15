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

const TYPE_LABEL: Record<SourceListItem["type"], string> = { text: "Text", url: "Web page", pdf: "PDF" };

/** "Text · 12,400 characters"; just the type while the size isn't known yet. */
export function sourceMeta(source: SourceListItem): string {
  const type = TYPE_LABEL[source.type];
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
        <p className="text-xs text-graphite">{sourceMeta(source)}</p>
      </div>
      {source.summary ? (
        <p className="font-reading text-sm leading-relaxed">{source.summary}</p>
      ) : (
        !failed && <p className="text-sm text-graphite">The summary appears when processing is done.</p>
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
