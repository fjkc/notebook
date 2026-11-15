"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteNotebook } from "@/app/notebook/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteDialogProps = {
  id: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Delete confirmation (NB-006 R10). On success the toast is shown first, then the client navigates
 * home; the Toaster lives in the root layout, so the toast survives the navigation.
 */
export function DeleteDialog({ id, title, open, onOpenChange }: DeleteDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return; // Can't be closed while deleting.
    onOpenChange(next);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteNotebook({ id });
      // NOT_FOUND: already deleted, e.g. in another tab. The outcome the user wanted, so treat it as success.
      if (!result.ok && result.error.code !== "NOT_FOUND") {
        toast.error(result.error.message);
        return;
      }
      toast.success("Notebook deleted.");
      router.replace("/");
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
          <DialogTitle className="leading-snug break-words">Delete {title}?</DialogTitle>
          <DialogDescription>Its sources and chat go with it. This can&apos;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting…" : "Delete notebook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
