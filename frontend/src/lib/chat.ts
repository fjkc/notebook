import type { UIMessage } from "ai";
import { ERROR_CODES, type Citation } from "@repo/backend/shared";

/** A chat message in the Ask pane: answers carry their citation map as metadata (NB-009 R9). */
export type ChatUIMessage = UIMessage<{ citations: Citation[] }>;

const KNOWN_MESSAGES: ReadonlySet<string> = new Set(Object.values(ERROR_CODES).map((entry) => entry.message));

/**
 * The text the Ask pane shows for a failed request (NB-009 R12). A non-2xx response carries our JSON
 * error body as the error message; a stream error carries the mapped text. Anything else (an HTML
 * error page, a network error, an unexpected text) shows INTERNAL's message.
 */
export function chatErrorMessage(error: Error): string {
  try {
    const body: unknown = JSON.parse(error.message);
    const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
    if (typeof message === "string" && message.trim()) return message;
  } catch {
    // Not JSON: a stream error text, or something unexpected.
  }
  return KNOWN_MESSAGES.has(error.message) ? error.message : ERROR_CODES.INTERNAL.message;
}
