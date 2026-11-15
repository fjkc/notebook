"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createNotebook } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** Creates a notebook and opens it (the action redirects); failures (e.g. the limit) show as a toast. */
export function NewNotebookButton() {
  const [state, formAction, pending] = useActionState(createNotebook, null);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error.message);
  }, [state]);

  return (
    <form action={formAction} className="w-full sm:w-auto">
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Creating…" : "New notebook"}
      </Button>
    </form>
  );
}
