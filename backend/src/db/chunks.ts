import "server-only";
import { AppError } from "../errors";
import { EMBED_BATCH_SIZE, INGEST_DB_TIMEOUT_MS } from "../shared/limits";
import { getSupabase } from "../supabase";

/** Postgres foreign_key_violation: the source (or notebook) was deleted while processing. */
const FOREIGN_KEY_VIOLATION = "23503";

export type ChunkRow = {
  sourceId: string;
  notebookId: string;
  chunkIndex: number;
  page: number | null;
  content: string;
  embedding: number[];
};

/**
 * Inserts chunks in batches of EMBED_BATCH_SIZE, each with its own INGEST_DB_TIMEOUT_MS cap combined
 * with the caller's signal. A deleted source surfaces as NOT_FOUND.
 *
 * The documented exception to "every query is scoped by owner_id" (NB-007 R8): `chunks` has no
 * owner_id column. Only processSource calls this, with rows built from a source it has just claimed
 * for the owner, and this module never reads or deletes chunks (claim_source and the cascade do that).
 */
export async function insertMany(rows: ChunkRow[], signal?: AbortSignal): Promise<void> {
  for (let start = 0; start < rows.length; start += EMBED_BATCH_SIZE) {
    const batch = rows.slice(start, start + EMBED_BATCH_SIZE).map((row) => ({
      source_id: row.sourceId,
      notebook_id: row.notebookId,
      chunk_index: row.chunkIndex,
      page: row.page,
      content: row.content,
      embedding: JSON.stringify(row.embedding),
    }));
    const timeout = AbortSignal.timeout(INGEST_DB_TIMEOUT_MS);
    const { error } = await getSupabase()
      .from("chunks")
      .insert(batch)
      .abortSignal(signal ? AbortSignal.any([signal, timeout]) : timeout);
    if (error?.code === FOREIGN_KEY_VIOLATION) throw new AppError("NOT_FOUND", { cause: error });
    if (error) throw new Error(`chunks.insertMany failed: ${error.code || "unknown"}`, { cause: error });
  }
}
