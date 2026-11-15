"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ERROR_CODES, MAX_PASTED_TEXT_CHARS, MAX_SOURCE_TITLE_CHARS } from "@repo/backend/shared";
import { createTextSource } from "@/app/notebook/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { processInBackground } from "./process-source";

const formatCount = (n: number) => n.toLocaleString("en-US");

type TextSourceFormProps = {
  notebookId: string;
  onPendingChange: (pending: boolean) => void;
  onDone: () => void;
};

/** The "Paste text" tab (NB-007 R14). Checks the same rules as the server before the round trip. */
export function TextSourceForm({ notebookId, onPendingChange, onDone }: TextSourceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<{ field: "title" | "text"; message: string } | null>(null);
  const tooLong = text.length > MAX_PASTED_TEXT_CHARS;

  function validate(): typeof error {
    if (title.trim().length > MAX_SOURCE_TITLE_CHARS) {
      return { field: "title", message: `Titles can be up to ${MAX_SOURCE_TITLE_CHARS} characters.` };
    }
    const trimmed = text.trim();
    if (!trimmed) return { field: "text", message: "Paste some text first." };
    if (trimmed.length > MAX_PASTED_TEXT_CHARS) {
      return { field: "text", message: `Pasted text can be up to ${formatCount(MAX_PASTED_TEXT_CHARS)} characters.` };
    }
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validate();
    setError(invalid);
    if (invalid) return;

    onPendingChange(true);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createTextSource>>;
      try {
        result = await createTextSource({ notebookId, title: title.trim() || undefined, text });
      } catch {
        // The call itself failed (network, or an older page after a deploy). Keep the text and say so.
        onPendingChange(false);
        toast.error(ERROR_CODES.INTERNAL.message);
        return;
      }
      onPendingChange(false);
      if (!result.ok) {
        if (result.error.code === "VALIDATION" || result.error.code === "LIMIT_REACHED") {
          setError({ field: "text", message: result.error.message });
        } else {
          toast.error(result.error.message);
        }
        return;
      }
      onDone();
      // Not awaited: the chip shows the progress (pending chip from revalidatePath, then polling).
      void processInBackground(result.data.sourceId, router.refresh);
    });
  }

  const errorFor = (field: "title" | "text") => (error?.field === field ? error.message : null);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="source-title" className="text-sm font-medium">
          Title <span className="font-normal text-graphite">(optional)</span>
        </label>
        <Input
          id="source-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Uses the first line if empty"
          autoComplete="off"
          disabled={pending}
          aria-invalid={errorFor("title") ? true : undefined}
          aria-describedby={errorFor("title") ? "source-title-error" : undefined}
        />
        {errorFor("title") && (
          <p id="source-title-error" role="alert" className="text-sm text-danger">
            {errorFor("title")}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="source-text" className="text-sm font-medium">
            Text
          </label>
          <span
            id="source-text-count"
            className={cn("text-xs tabular-nums", tooLong ? "text-danger" : "text-graphite")}
          >
            {formatCount(text.length)} / {formatCount(MAX_PASTED_TEXT_CHARS)}
          </span>
        </div>
        <Textarea
          id="source-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          className="max-h-[50dvh] min-h-40 resize-y"
          disabled={pending}
          aria-invalid={errorFor("text") || tooLong ? true : undefined}
          aria-describedby={errorFor("text") ? "source-text-count source-text-error" : "source-text-count"}
        />
        {errorFor("text") && (
          <p id="source-text-error" role="alert" className="text-sm text-danger">
            {errorFor("text")}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add source"}
        </Button>
      </div>
    </form>
  );
}
