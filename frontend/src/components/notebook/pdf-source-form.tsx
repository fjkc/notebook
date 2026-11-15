"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ERROR_CODES, MAX_PDF_BYTES, MAX_PDF_PAGES } from "@repo/backend/shared";
import { deleteSource } from "@/app/notebook/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isErrorBody, processInBackground } from "./process-source";

const NOT_A_PDF = "Choose a PDF file.";
const UPLOAD_FAILED = "The upload didn't work. Try again.";
/** The route accepts names up to 200 characters; the title uses only the first 80 anyway. */
const MAX_FILE_NAME_CHARS = 200;

/**
 * The name sent to the route: always ends in ".pdf" (a PDF picked by its type may lack it) and is cut
 * to 200 characters, so a valid file is never refused for its name.
 */
function sendableName(name: string): string {
  const base = name.trim().replace(/\.pdf$/i, "");
  return `${base.slice(0, MAX_FILE_NAME_CHARS - 4).trimEnd()}.pdf`;
}

type Phase = "idle" | "preparing" | "uploading";
type UploadTarget = { sourceId: string; path: string; token: string };

function isUploadTarget(value: unknown): value is UploadTarget {
  const v = value as Partial<UploadTarget> | null;
  return typeof v?.sourceId === "string" && typeof v.path === "string" && typeof v.token === "string";
}

type PdfSourceFormProps = {
  notebookId: string;
  onPendingChange: (pending: boolean) => void;
  onDone: () => void;
};

/**
 * The "PDF" tab (NB-008 R9): ask for a signed upload token, upload straight to Storage, then process.
 * A failed upload deletes the new source again, so no empty pending source stays behind.
 */
export function PdfSourceForm({ notebookId, onPendingChange, onDone }: PdfSourceFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = phase !== "idle";

  function checkFile(candidate: File | null): string | null {
    if (!candidate) return NOT_A_PDF;
    const isPdf = candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return NOT_A_PDF;
    if (candidate.size > MAX_PDF_BYTES) return ERROR_CODES.FILE_TOO_LARGE.message;
    return null;
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    setError(chosen ? checkFile(chosen) : null);
  }

  function finish(phaseError: string | null) {
    setPhase("idle");
    onPendingChange(false);
    setError(phaseError);
  }

  async function requestUpload(chosen: File): Promise<UploadTarget | string> {
    try {
      const response = await fetch("/api/sources/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, fileName: sendableName(chosen.name), fileSize: chosen.size }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && isUploadTarget(body)) return body;
      return isErrorBody(body) ? body.error.message : ERROR_CODES.INTERNAL.message;
    } catch {
      return ERROR_CODES.INTERNAL.message;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = checkFile(file);
    setError(invalid);
    if (invalid || !file) return;

    onPendingChange(true);
    setPhase("preparing");
    // 1. Create the source and get a signed token. Nothing exists yet if this fails.
    const target = await requestUpload(file);
    if (typeof target === "string") return finish(target);

    // 2. Upload straight to Storage (Vercel's body limit rules out our own route).
    setPhase("uploading");
    let uploaded = false;
    try {
      const { error: uploadError } = await getBrowserSupabase()
        .storage.from("sources")
        .uploadToSignedUrl(target.path, target.token, file, { contentType: "application/pdf" });
      uploaded = !uploadError;
    } catch {
      uploaded = false;
    }
    if (!uploaded) {
      await deleteSource({ id: target.sourceId }).catch(() => null);
      return finish(UPLOAD_FAILED);
    }

    // 3. Close, show the pending chip (a route created it, so nothing revalidated), then process.
    finish(null);
    onDone();
    router.refresh();
    void processInBackground(target.sourceId, router.refresh);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="source-pdf" className="text-sm font-medium">
          PDF file
        </label>
        <Input
          id="source-pdf"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={pending}
          className="h-auto py-1.5"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "source-pdf-error source-pdf-hint" : "source-pdf-hint"}
        />
        <p id="source-pdf-hint" className="text-xs text-graphite">
          Up to {MAX_PDF_BYTES / (1024 * 1024)} MB and {MAX_PDF_PAGES} pages, with selectable text.
        </p>
        {error && (
          <p id="source-pdf-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {phase === "uploading" ? "Uploading…" : phase === "preparing" ? "Adding…" : "Add source"}
        </Button>
      </div>
    </form>
  );
}
