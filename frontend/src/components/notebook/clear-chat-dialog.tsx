"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { clearChat } from "@/app/notebook/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClearChatDialogProps = {
  notebookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after the server cleared the conversation, before the dialog closes. */
  onCleared: () => void;
};

/** Confirmation for "Clear chat" (NB-010 R8). Can't be closed while the action runs. */
export function ClearChatDialog({ notebookId, open, onOpenChange, onCleared }: ClearChatDialogProps) {
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearChat({ notebookId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      onCleared();
      onOpenChange(false);
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
          <DialogTitle>Clear this conversation?</DialogTitle>
          <DialogDescription>The questions and answers go away. Your sources stay.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleClear}>
            {pending ? "Clearing…" : "Clear chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
