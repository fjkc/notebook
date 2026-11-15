"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { NotebookTitle } from "@repo/backend/shared";
import { renameNotebook } from "@/app/notebook/[id]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type RenameDialogProps = {
  id: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Rename (NB-006 R10). Validates with the same NotebookTitle rule as the server, before the round trip. */
export function RenameDialog({ id, title, open, onOpenChange }: RenameDialogProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    if (pending) return; // Can't be closed while saving.
    // Radix only reports closes here (the menu opens the dialog through `open`), so clear on close.
    setError(null);
    onOpenChange(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = new FormData(event.currentTarget).get("title");
    const parsed = NotebookTitle.safeParse(typeof raw === "string" ? raw : "");
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await renameNotebook({ id, title: parsed.data });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onOpenChange(false);
      toast.success("Notebook renamed.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!pending}
        onOpenAutoFocus={(event) => {
          // Focus the field with the current name selected, so typing replaces it.
          event.preventDefault();
          inputRef.current?.select();
        }}
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
        onInteractOutside={(event) => pending && event.preventDefault()}
      >
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename notebook</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="notebook-title" className="text-sm font-medium">
              Name
            </label>
            <Input
              ref={inputRef}
              id="notebook-title"
              name="title"
              defaultValue={title}
              autoComplete="off"
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "notebook-title-error" : undefined}
            />
            {error && (
              <p id="notebook-title-error" role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
