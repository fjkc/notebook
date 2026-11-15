"use client";

import { useState } from "react";
import { MAX_SOURCES_PER_NOTEBOOK } from "@repo/backend/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TextSourceForm } from "./text-source-form";

export const SOURCE_LIMIT_MESSAGE = `A notebook can have up to ${MAX_SOURCES_PER_NOTEBOOK} sources.`;

type AddSourceDialogProps = { notebookId: string; atLimit: boolean; className?: string };

/**
 * "Add source" at the end of the Shelf (NB-007 R14): a dialog with one tab per source type
 * (NB-008 adds web page and PDF). At the limit the button stays focusable with an explanation.
 */
export function AddSourceDialog({ notebookId, atLimit, className }: AddSourceDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (atLimit) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" size="sm" aria-disabled="true" className={cn("shrink-0", className)}>
            Add source
          </Button>
        </TooltipTrigger>
        <TooltipContent>{SOURCE_LIMIT_MESSAGE}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn("shrink-0", className)}>
          Add source
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={!pending}
        className="sm:max-w-xl"
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
        onInteractOutside={(event) => pending && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add source</DialogTitle>
          <DialogDescription>Answers in this notebook only use the sources you add.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="text">
          <TabsList>
            <TabsTrigger value="text">Paste text</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="pt-2">
            <TextSourceForm notebookId={notebookId} onPendingChange={setPending} onDone={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
