"use client";

import { useState } from "react";
import { MAX_SOURCES_PER_NOTEBOOK } from "@repo/backend/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PdfSourceForm } from "./pdf-source-form";
import { TextSourceForm } from "./text-source-form";
import { UrlSourceForm } from "./url-source-form";

export const SOURCE_LIMIT_MESSAGE = `A notebook can have up to ${MAX_SOURCES_PER_NOTEBOOK} sources.`;

type AddSourceDialogProps = { notebookId: string; atLimit: boolean; className?: string };

/**
 * "Add source" at the end of the Shelf (NB-007 R14): a dialog with one tab per source type, PDF, web
 * page and pasted text (NB-008 R13). At the limit the button stays focusable with an explanation.
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
        <Tabs defaultValue="pdf" className="min-w-0">
          <TabsList>
            <TabsTrigger value="pdf" disabled={pending}>
              PDF
            </TabsTrigger>
            <TabsTrigger value="url" disabled={pending}>
              Web page
            </TabsTrigger>
            <TabsTrigger value="text" disabled={pending}>
              Paste text
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pdf" className="pt-2">
            <PdfSourceForm notebookId={notebookId} onPendingChange={setPending} onDone={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="url" className="pt-2">
            <UrlSourceForm notebookId={notebookId} onPendingChange={setPending} onDone={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="text" className="pt-2">
            <TextSourceForm notebookId={notebookId} onPendingChange={setPending} onDone={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
