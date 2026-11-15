import "server-only";
import { FINALIZE_DB_TIMEOUT_MS } from "../shared/limits";
import { getSupabase } from "../supabase";

// Every query here is scoped by owner_id (CLAUDE.md rule 5). Supabase errors become a plain Error
// with the PostgREST code only, so they map to INTERNAL.
function fail(operation: string, error: { code?: string }): never {
  throw new Error(`sources.${operation} failed: ${error.code || "unknown"}`, { cause: error });
}

export type SourceType = "text" | "url" | "pdf";
export type SourceStatus = "pending" | "processing" | "ready" | "failed";

export type SourceRow = {
  id: string;
  notebookId: string;
  type: SourceType;
  title: string;
  status: SourceStatus;
  error: string | null;
  pageCount: number | null;
  charCount: number | null;
  summary: string | null;
  /** The link of a web page source, else null. */
  url: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A row with the stored input, for processing. */
export type SourceForProcessing = SourceRow & { inputText: string | null; storagePath: string | null };

const LIST_COLUMNS =
  "id, notebook_id, type, title, status, error, page_count, char_count, summary, url, created_at, updated_at";

type RawRow = Record<string, unknown>;

function toRow(raw: RawRow): SourceRow {
  return {
    id: raw.id as string,
    notebookId: raw.notebook_id as string,
    type: raw.type as SourceType,
    title: raw.title as string,
    status: raw.status as SourceStatus,
    error: (raw.error as string | null) ?? null,
    pageCount: (raw.page_count as number | null) ?? null,
    charCount: (raw.char_count as number | null) ?? null,
    summary: (raw.summary as string | null) ?? null,
    url: (raw.url as string | null) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

function toProcessingRow(raw: RawRow): SourceForProcessing {
  return {
    ...toRow(raw),
    inputText: (raw.input_text as string | null) ?? null,
    storagePath: (raw.storage_path as string | null) ?? null,
  };
}

export async function insert(
  ownerId: string,
  fields: {
    /** Set by the caller when another field depends on it (a PDF's storage path). */
    id?: string;
    notebookId: string;
    type: SourceType;
    title: string;
    inputText?: string;
    url?: string;
    storagePath?: string;
  },
): Promise<{ id: string }> {
  const { data, error } = await getSupabase()
    .from("sources")
    .insert({
      ...(fields.id ? { id: fields.id } : {}),
      owner_id: ownerId,
      notebook_id: fields.notebookId,
      type: fields.type,
      title: fields.title,
      input_text: fields.inputText ?? null,
      url: fields.url ?? null,
      storage_path: fields.storagePath ?? null,
    })
    .select("id")
    .single();
  if (error) fail("insert", error);
  return { id: data.id as string };
}

/** The notebook's sources, oldest first. */
export async function listByNotebook(ownerId: string, notebookId: string): Promise<SourceRow[]> {
  const { data, error } = await getSupabase()
    .from("sources")
    .select(LIST_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("notebook_id", notebookId)
    .order("created_at", { ascending: true });
  if (error) fail("listByNotebook", error);
  return (data ?? []).map(toRow);
}

/** One source with its input, or null if it isn't the owner's. */
export async function getOwned(ownerId: string, id: string): Promise<SourceForProcessing | null> {
  const { data, error } = await getSupabase()
    .from("sources")
    .select(`${LIST_COLUMNS}, input_text, storage_path`)
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getOwned", error);
  return data ? toProcessingRow(data) : null;
}

export async function countInNotebook(ownerId: string, notebookId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("notebook_id", notebookId);
  if (error) fail("countInNotebook", error);
  return count ?? 0;
}

/** How many sources the owner created since `since` (ISO timestamp), across all notebooks. */
export async function countCreatedSince(ownerId: string, since: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .gte("created_at", since);
  if (error) fail("countCreatedSince", error);
  return count ?? 0;
}

/**
 * Atomically moves the source to processing and deletes its old chunks (claim_source, migration
 * 0002, scoped by owner inside the function). Returns the claimed row, or null if nothing was claimed.
 */
export async function claim(ownerId: string, id: string): Promise<SourceForProcessing | null> {
  const { data, error } = await getSupabase().rpc("claim_source", { p_id: id, p_owner_id: ownerId });
  if (error) fail("claim", error);
  const first = (data as RawRow[] | null)?.[0];
  return first ? toProcessingRow(first) : null;
}

/**
 * Runs after the processing budget with its own short timeout (FINALIZE_DB_TIMEOUT_MS): an abort of
 * the budget after the server committed would otherwise turn a finished source into failed.
 * Returns false if no row was updated (the source was deleted meanwhile).
 */
export async function markReady(
  ownerId: string,
  id: string,
  /** `summary` is null when the summary call failed (best-effort); `title` replaces the provisional one. */
  fields: { summary: string | null; pageCount: number | null; charCount: number; title?: string },
): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("sources")
    .update({
      status: "ready",
      error: null,
      summary: fields.summary,
      page_count: fields.pageCount,
      char_count: fields.charCount,
      ...(fields.title ? { title: fields.title } : {}),
    })
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select("id")
    .abortSignal(AbortSignal.timeout(FINALIZE_DB_TIMEOUT_MS));
  if (error) fail("markReady", error);
  return (data ?? []).length > 0;
}

/**
 * Runs after the budget may have expired, with its own short timeout (FINALIZE_DB_TIMEOUT_MS).
 * Only a processing row is updated, so a markReady that committed despite a client-side abort is
 * never overwritten. Returns false if nothing was updated (deleted meanwhile, or already ready).
 */
export async function markFailed(ownerId: string, id: string, message: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("sources")
    .update({ status: "failed", error: message })
    .eq("owner_id", ownerId)
    .eq("id", id)
    .eq("status", "processing")
    .select("id")
    .abortSignal(AbortSignal.timeout(FINALIZE_DB_TIMEOUT_MS));
  if (error) fail("markFailed", error);
  return (data ?? []).length > 0;
}

/** Storage paths of the owner's PDF sources in a notebook, for removing the files after a delete. */
export async function listStoragePaths(ownerId: string, notebookId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("sources")
    .select("storage_path")
    .eq("owner_id", ownerId)
    .eq("notebook_id", notebookId)
    .not("storage_path", "is", null);
  if (error) fail("listStoragePaths", error);
  return (data ?? []).map((row) => row.storage_path as string);
}

/** Deletes the owner's source; its chunks go with it (on delete cascade). */
export async function remove(ownerId: string, id: string): Promise<void> {
  const { error } = await getSupabase().from("sources").delete().eq("owner_id", ownerId).eq("id", id);
  if (error) fail("remove", error);
}

/** How many of `ids` are ready sources of the owner's notebook (checks a chat's sourceIds). */
export async function countReadyInNotebook(ownerId: string, notebookId: string, ids: string[]): Promise<number> {
  const { count, error } = await getSupabase()
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("notebook_id", notebookId)
    .eq("status", "ready")
    .in("id", ids);
  if (error) fail("countReadyInNotebook", error);
  return count ?? 0;
}

/** Titles of the owner's sources among `ids`, by id (one query, for citations). */
export async function titlesByIds(ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const { data, error } = await getSupabase().from("sources").select("id, title").eq("owner_id", ownerId).in("id", ids);
  if (error) fail("titlesByIds", error);
  return new Map((data ?? []).map((row) => [row.id as string, row.title as string]));
}
