"use client";

import { toast } from "sonner";
import { ERROR_CODES, type ErrorBody } from "@repo/backend/shared";

function isErrorBody(value: unknown): value is ErrorBody {
  const error = (value as ErrorBody | null)?.error;
  return typeof error?.code === "string" && typeof error.message === "string";
}

/**
 * Calls the process route for a source without blocking the UI (NB-007 R14). The chip follows the
 * status through refreshes; when the call settles, `refresh` runs once more.
 * NOT_FOUND is ignored (the source was deleted meanwhile). Any other error shows a toast, and a
 * network error or a non-JSON body (e.g. a platform 504 page) shows INTERNAL's message.
 */
export async function processInBackground(sourceId: string, refresh: () => void): Promise<void> {
  try {
    const response = await fetch(`/api/sources/${encodeURIComponent(sourceId)}/process`, { method: "POST" });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      if (!isErrorBody(body)) toast.error(ERROR_CODES.INTERNAL.message);
      else if (body.error.code !== "NOT_FOUND") toast.error(body.error.message);
    }
  } catch {
    toast.error(ERROR_CODES.INTERNAL.message);
  } finally {
    refresh();
  }
}
