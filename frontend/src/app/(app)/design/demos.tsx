"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Interactive parts of the /design reference page. Mock content only.

export function DropdownDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44">
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this notebook?</DialogTitle>
          <DialogDescription>Its sources, questions and takeaways are removed too.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep it</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive">Delete notebook</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ToastDemo() {
  return (
    <Button variant="outline" onClick={() => toast("Source added to the shelf")}>
      Show a toast
    </Button>
  );
}

/** A citation hook and the Reader excerpt it points to. Pressing the hook marks the passage. */
export function CitationDemo() {
  const [active, setActive] = useState(false);

  return (
    <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
      <p className="font-reading text-[1.0625rem] leading-relaxed">
        Most of the warming since 1950 comes from greenhouse gases released by people
        <button
          type="button"
          aria-pressed={active}
          aria-label="Citation 1: Climate summary, page 4"
          onClick={() => setActive((value) => !value)}
          className={`mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 align-[0.15em] font-sans text-xs font-medium tabular-nums transition-colors duration-150 ${
            active ? "bg-hook text-paper" : "bg-hook/10 text-hook hover:bg-hook/20"
          }`}
        >
          1
        </button>
        , and the effect of aerosols partly hides it.
      </p>
      <aside className="border-t border-rule pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6" aria-label="Reader">
        <p className="text-sm text-graphite">Climate summary · page 4</p>
        <p className="mt-2 font-reading text-[1.0625rem] leading-relaxed">
          …it is extremely likely that{" "}
          <mark className={`rounded-sm px-0.5 text-ink transition-colors duration-150 ${active ? "bg-marker" : "bg-transparent"}`}>
            more than half of the observed increase in global average surface temperature was caused by the
            human-made increase in greenhouse gas concentrations
          </mark>
          , together with other human influences…
        </p>
      </aside>
    </div>
  );
}
