"use client";

import { EllipsisIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteDialog } from "./delete-dialog";
import { RenameDialog } from "./rename-dialog";

/** "Notebook options" in the top bar: rename and delete (the only place for both, NB-006). */
export function NotebookMenu({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState<"rename" | "delete" | null>(null);

  return (
    <>
      {/* Not modal, so the menu doesn't fight the dialog it opens over focus and pointer events. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Notebook options">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpen("rename")}>Rename</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen("delete")}>
            Delete notebook
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog
        id={id}
        title={title}
        open={open === "rename"}
        onOpenChange={(next) => setOpen(next ? "rename" : null)}
      />
      <DeleteDialog
        id={id}
        title={title}
        open={open === "delete"}
        onOpenChange={(next) => setOpen(next ? "delete" : null)}
      />
    </>
  );
}
