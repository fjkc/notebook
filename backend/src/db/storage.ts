import "server-only";
import { describeError } from "../errors";
import { INGEST_DB_TIMEOUT_MS } from "../shared/limits";
import { getSupabase } from "../supabase";

// The private "sources" bucket (0001_init.sql). Paths are always "{owner_id}/{source_id}.pdf";
// callers build them from an owner-scoped row, and downloads check the owner prefix again.

const BUCKET = "sources";

export function pdfPath(ownerId: string, sourceId: string): string {
  return `${ownerId}/${sourceId}.pdf`;
}

/** A signed token the browser uses with uploadToSignedUrl (NB-008 R8). */
export async function createUploadToken(path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error("storage.createUploadToken failed", { cause: error });
  return { path: data.path, token: data.token };
}

/** The file's bytes, or null if no object exists at the path (the upload never finished). */
export async function download(path: string): Promise<ArrayBuffer | null> {
  const { data, error } = await getSupabase()
    .storage.from(BUCKET)
    .download(path, {}, { signal: AbortSignal.timeout(INGEST_DB_TIMEOUT_MS) });
  if (error) {
    const { status, statusCode } = error as { status?: number; statusCode?: string };
    // Storage answers a missing object with 404, or with 400 and statusCode "404" on older versions.
    if (status === 404 || statusCode === "404") return null;
    throw new Error("storage.download failed", { cause: error });
  }
  return data.arrayBuffer();
}

/**
 * Removes files after their rows are gone (NB-008 R12). Never throws: an orphaned file in the private
 * bucket is harmless, and a delete the user asked for must not fail because of it.
 */
export async function removeQuietly(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const { error } = await getSupabase().storage.from(BUCKET).remove(paths);
    if (error) throw error;
  } catch (error) {
    console.error("[storage.remove] failed", JSON.stringify({ count: paths.length, error: describeError(error) }));
  }
}
