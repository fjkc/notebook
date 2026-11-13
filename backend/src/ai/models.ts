// The only place with Gemini model IDs. Checked against https://ai.google.dev/gemini-api/docs/models on 2026-11-13.

/** Latest stable Flash model: chat, summaries, notes. */
export const TEXT_MODEL = "gemini-3.8-flash";

/**
 * Current stable embedding model. Reduced dimensions are renormalised by the model.
 * It takes no `task_type`; queries and documents get a task prefix in the text instead (see the Gemini embeddings docs).
 */
export const EMBEDDING_MODEL = "gemini-embedding-2";

/** Must match `vector(768)` in infra/supabase/migrations/0001_init.sql. Passed as `outputDimensionality`. */
export const EMBEDDING_DIMENSIONS = 768;
