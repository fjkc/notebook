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

/** Cap for the health check's database query, in ms (docs/ARCHITECTURE.md → "Keep-alive and health"). */
export const HEALTH_CHECK_TIMEOUT_MS = 5_000;

// Access gate (docs/ARCHITECTURE.md → "Access gate").

/** How long a login lasts, in seconds (30 days), so reviewers can come back days later. */
export const ACCESS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Wait before answering a wrong password, in ms. Slows sequential guessing only. */
export const FAILED_LOGIN_DELAY_MS = 1_000;

/** Longest accepted password input, in characters. */
export const MAX_PASSWORD_INPUT_CHARS = 200;
