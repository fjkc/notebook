// Error codes, HTTP statuses and user-facing messages (docs/ARCHITECTURE.md → "Errors").
// Client-safe: the UI can show the message for a code it receives.
import { MAX_PDF_BYTES } from "./limits";

export const ERROR_CODES = {
  RATE_LIMITED: { status: 429, message: "Lots of requests right now. Try again in a minute." },
  NOT_FOUND: { status: 404, message: "This notebook or source doesn't exist." },
  UNAUTHORIZED: { status: 401, message: "Your session has expired. Reload the page." },
  // VALIDATION and LIMIT_REACHED usually carry a specific message; these are the fallbacks.
  VALIDATION: { status: 400, message: "Some of the input isn't valid." },
  LIMIT_REACHED: { status: 400, message: "You've reached a limit." },
  FILE_TOO_LARGE: { status: 400, message: `PDFs can be up to ${MAX_PDF_BYTES / (1024 * 1024)} MB.` },
  NO_TEXT_FOUND: {
    status: 422,
    message: "This PDF has no selectable text. Scanned PDFs aren't supported yet.",
  },
  URL_FETCH_FAILED: {
    status: 422,
    message: "We couldn't read that page. Check the link or paste the text instead.",
  },
  ALREADY_PROCESSING: { status: 409, message: "This source is already being processed." },
  INTERNAL: { status: 500, message: "Something went wrong on our side. Try again." },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERROR_CODES;

/** The codes whose message may be replaced by a specific one (e.g. "A notebook can have up to 10 sources."). */
export const CODES_WITH_SPECIFIC_MESSAGE = ["VALIDATION", "LIMIT_REACHED"] as const satisfies readonly ErrorCode[];

/** Shape of every error response body. */
export type ErrorBody = { error: { code: ErrorCode; message: string } };
