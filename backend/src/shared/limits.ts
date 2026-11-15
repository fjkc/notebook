// All product limits (docs/ARCHITECTURE.md → "Limits"). Client-safe: the UI shows them, the backend enforces them.

/** Largest PDF upload, in bytes (10 MB). */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Most pages a PDF may have. */
export const MAX_PDF_PAGES = 300;

/** Most notebooks one owner may have. */
export const MAX_NOTEBOOKS_PER_OWNER = 50;

/** Most sources one notebook may hold. */
export const MAX_SOURCES_PER_NOTEBOOK = 10;

/** Most new sources one owner may add per hour. */
export const MAX_NEW_SOURCES_PER_OWNER_PER_HOUR = 20;

/**
 * Longest pasted text, in characters. Set by the embedding free tier (30,000 tokens/min, NB-007 R16):
 * 80,000 characters are about 23,000 tokens with chunk overlap and reached ready in 34 s.
 */
export const MAX_PASTED_TEXT_CHARS = 80_000;

/** Longest source title, in characters (given or derived from the text). */
export const MAX_SOURCE_TITLE_CHARS = 80;

// Ingestion (docs/ARCHITECTURE.md §6).

/** New text per chunk, in characters (paragraphs and sentences are packed up to this). */
export const CHUNK_TARGET_CHARS = 1_000;

/** Overlap carried over from the previous chunk of the same page, in characters (plus one space). */
export const CHUNK_OVERLAP_CHARS = 150;

/** A page's last chunk with less new text than this is merged into the previous chunk. */
export const CHUNK_MIN_CHARS = 200;

/** Upper bound for a chunk: overlap + space + target, plus a merged tail ("\n\n" + up to CHUNK_MIN_CHARS - 1). */
export const MAX_CHUNK_CHARS = CHUNK_OVERLAP_CHARS + 1 + CHUNK_TARGET_CHARS + 2 + (CHUNK_MIN_CHARS - 1);

/** Texts per embedding call, and rows per chunk-insert batch. */
export const EMBED_BATCH_SIZE = 100;

/** Characters of a source sent to the summary prompt. */
export const SUMMARY_INPUT_CHARS = 30_000;

/** A source in pending or processing whose updated_at is older than this counts as failed ("Processing timed out."). */
export const STUCK_SOURCE_MS = 5 * 60 * 1000;

/** How often the Shelf refreshes while a source is pending or processing, in ms. */
export const SOURCE_POLL_MS = 2_000;

// Timeouts (docs/ARCHITECTURE.md → "Runtime configuration").

/** Default cap for one server Supabase request, in ms. Long operations pass their own signal (see supabase.ts). */
export const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;

/** Time budget for one process call after the claim, in ms; well below the route's 60 s maxDuration. */
export const PROCESS_BUDGET_MS = 45_000;

/** Cap for one chunk-insert batch during ingestion, in ms. */
export const INGEST_DB_TIMEOUT_MS = 30_000;

/**
 * Cap for markReady and markFailed, which run after the budget: 45 s + 5 s + 5 s stays under the
 * route's 60 s maxDuration, so a failure is always written before the platform ends the call.
 */
export const FINALIZE_DB_TIMEOUT_MS = 5_000;

/** Cap for the health check's database query, in ms (docs/ARCHITECTURE.md → "Keep-alive and health"). */
export const HEALTH_CHECK_TIMEOUT_MS = 5_000;

// Access gate (docs/ARCHITECTURE.md → "Access gate").

/** How long a login lasts, in seconds (30 days), so reviewers can come back days later. */
export const ACCESS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Wait before answering a wrong password, in ms. Slows sequential guessing only. */
export const FAILED_LOGIN_DELAY_MS = 1_000;

/** Longest accepted password input, in characters. */
export const MAX_PASSWORD_INPUT_CHARS = 200;
