import "server-only";
import type { Citation } from "../shared/citations";
import { getSupabase } from "../supabase";

// Every query here is scoped by owner_id (CLAUDE.md rule 5). Supabase errors become a plain Error
// with the PostgREST code only, so they map to INTERNAL.
function fail(operation: string, error: { code?: string }): never {
  throw new Error(`messages.${operation} failed: ${error.code || "unknown"}`, { cause: error });
}

export type MessageRole = "user" | "assistant";

export type MessageRow = { id: string; role: MessageRole; content: string; citations: Citation[] };

const COLUMNS = "id, role, content, citations";

function toRow(raw: Record<string, unknown>): MessageRow {
  return {
    id: raw.id as string,
    role: raw.role as MessageRole,
    content: raw.content as string,
    // Written only by saveAnswer, from the server's own citation map.
    citations: Array.isArray(raw.citations) ? (raw.citations as Citation[]) : [],
  };
}

export async function insert(
  ownerId: string,
  fields: { notebookId: string; role: MessageRole; content: string; citations?: Citation[] },
): Promise<{ id: string }> {
  const { data, error } = await getSupabase()
    .from("messages")
    .insert({
      owner_id: ownerId,
      notebook_id: fields.notebookId,
      role: fields.role,
      content: fields.content,
      citations: fields.citations ?? [],
    })
    .select("id")
    .single();
  if (error) fail("insert", error);
  return { id: data.id as string };
}

/** The notebook's newest `limit` messages, returned oldest first. */
export async function listRecent(ownerId: string, notebookId: string, limit: number): Promise<MessageRow[]> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select(COLUMNS)
    .eq("owner_id", ownerId)
    .eq("notebook_id", notebookId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("listRecent", error);
  return (data ?? []).map(toRow).reverse();
}

/** All of the notebook's messages, oldest first. */
export async function listAll(ownerId: string, notebookId: string): Promise<MessageRow[]> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select(COLUMNS)
    .eq("owner_id", ownerId)
    .eq("notebook_id", notebookId)
    .order("created_at", { ascending: true });
  if (error) fail("listAll", error);
  return (data ?? []).map(toRow);
}

/** How many questions the owner asked since `since` (ISO timestamp), across all notebooks. */
export async function countUserMessagesSince(ownerId: string, since: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("role", "user")
    .gte("created_at", since);
  if (error) fail("countUserMessagesSince", error);
  return count ?? 0;
}
