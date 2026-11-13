// All product limits (docs/ARCHITECTURE.md → "Limits"). Client-safe: the UI shows them, the backend enforces them.

/** Largest PDF upload, in bytes (10 MB). */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Most pages a PDF may have. */
export const MAX_PDF_PAGES = 300;

/** Most sources one notebook may hold. */
export const MAX_SOURCES_PER_NOTEBOOK = 10;

/** Most new sources one owner may add per hour. */
export const MAX_NEW_SOURCES_PER_OWNER_PER_HOUR = 20;

/** Longest pasted text, in characters. */
export const MAX_PASTED_TEXT_CHARS = 200_000;

// Timeouts (docs/ARCHITECTURE.md → "Runtime configuration").

/** Default cap for one server Supabase request, in ms. Long operations pass their own signal (see supabase.ts). */
export const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;
