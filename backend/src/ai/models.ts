// The only place with Gemini model IDs. Checked against https://ai.google.dev/gemini-api/docs/models on 2026-11-13.

/**
 * Chat answers (chosen in NB-009 on 2026-11-15). Measured on the same question and passages:
 * gemini-3.8-flash took 102 s (past the route's 60 s maxDuration), gemini-3.5-flash 5 s,
 * gemini-3.5-flash-lite under 1 s but with thinner answers and the summaries' quota.
 */
export const TEXT_MODEL = "gemini-3.5-flash";

/**
 * Source summaries (NB-007): latest stable Flash-Lite, checked against the models list on 2026-11-15
 * (there is no 3.8 Flash-Lite text model). ~1-2 s per summary without thinking, and its own
 * free-tier quota, so summaries don't use up the chat model's daily requests.
 */
export const SUMMARY_MODEL = "gemini-3.5-flash-lite";

/**
 * Stable embedding model that accepts `taskType` (RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY, docs/ARCHITECTURE.md §6–7).
 * The newer gemini-embedding-2 drops `taskType` in favour of text prefixes, so it would change the RAG design.
 * 768-dim output isn't renormalised by this model; match_chunks uses cosine distance, which ignores length.
 */
export const EMBEDDING_MODEL = "gemini-embedding-001";

/** Must match `vector(768)` in infra/supabase/migrations/0001_init.sql. Passed as `outputDimensionality`. */
export const EMBEDDING_DIMENSIONS = 768;
