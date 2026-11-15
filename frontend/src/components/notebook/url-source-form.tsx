"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ERROR_CODES } from "@repo/backend/shared";
import { createUrlSource } from "@/app/notebook/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { processInBackground } from "./process-source";

type UrlSourceFormProps = {
  notebookId: string;
  onPendingChange: (pending: boolean) => void;
  onDone: () => void;
};

/** The "Web page" tab (NB-008 R13). The server checks the link (R2); its message shows under the field. */
export function UrlSourceForm({ notebookId, onPendingChange, onDone }: UrlSourceFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) {
      setError("Enter a link that starts with http:// or https://.");
      return;
    }
    setError(null);
    onPendingChange(true);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createUrlSource>>;
      try {
        result = await createUrlSource({ notebookId, url: url.trim() });
      } catch {
        onPendingChange(false);
        toast.error(ERROR_CODES.INTERNAL.message);
        return;
      }
      onPendingChange(false);
      if (!result.ok) {
        if (result.error.code === "VALIDATION" || result.error.code === "LIMIT_REACHED") setError(result.error.message);
        else toast.error(result.error.message);
        return;
      }
      onDone();
      void processInBackground(result.data.sourceId, router.refresh);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="source-url" className="text-sm font-medium">
          Link
        </label>
        <Input
          id="source-url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "source-url-error source-url-hint" : "source-url-hint"}
        />
        <p id="source-url-hint" className="text-xs text-graphite">
          A public article or page. Pages that need a login or load their text with JavaScript won&apos;t work.
        </p>
        {error && (
          <p id="source-url-error" role="alert" className="text-sm text-danger">
            {error}
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
