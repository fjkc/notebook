// The only place with Gemini model IDs. Checked against https://ai.google.dev/gemini-api/docs/models on 2026-11-13.

/** Latest stable Flash model: chat, summaries, notes. */
export const TEXT_MODEL = "gemini-3.8-flash";

/**
 * Stable embedding model that accepts `taskType` (RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY, docs/ARCHITECTURE.md §6–7).
 * The newer gemini-embedding-2 drops `taskType` in favour of text prefixes, so it would change the RAG design.
 * 768-dim output isn't renormalised by this model; match_chunks uses cosine distance, which ignores length.
 */
export const EMBEDDING_MODEL = "gemini-embedding-001";

/** Must match `vector(768)` in infra/supabase/migrations/0001_init.sql. Passed as `outputDimensionality`. */
export const EMBEDDING_DIMENSIONS = 768;
