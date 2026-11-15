import "server-only";
import { getSupabase } from "../supabase";

// Every query here is scoped by owner_id (CLAUDE.md rule 5). Supabase errors become a plain Error
// with the PostgREST code only, so they map to INTERNAL.
function fail(operation: string, error: { code?: string }): never {
  throw new Error(`notebooks.${operation} failed: ${error.code || "unknown"}`, { cause: error });
}

export type NotebookListItem = { id: string; title: string; updatedAt: string; sourceCount: number };
export type Notebook = { id: string; title: string; suggestedQuestions: unknown; updatedAt: string };

/** Loads one notebook's id if it belongs to the owner, else null. Always scoped by owner_id. */
export async function findOwned(ownerId: string, id: string): Promise<{ id: string } | null> {
  const { data, error } = await getSupabase()
    .from("notebooks")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("findOwned", error);
  return data;
}

/** The owner's notebooks with their source counts (one query), newest updated_at first. */
export async function listByOwner(ownerId: string): Promise<NotebookListItem[]> {
  const { data, error } = await getSupabase()
    .from("notebooks")
    .select("id, title, updated_at, sources(count)")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) fail("listByOwner", error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    updatedAt: row.updated_at as string,
    sourceCount: (row.sources as { count: number }[] | null)?.[0]?.count ?? 0,
  }));
}

/** One notebook with the fields the notebook page needs, or null if it isn't the owner's. */
export async function getOwned(ownerId: string, id: string): Promise<Notebook | null> {
  const { data, error } = await getSupabase()
    .from("notebooks")
    .select("id, title, suggested_questions, updated_at")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getOwned", error);
  if (!data) return null;
  return {
    id: data.id as string,
    title: data.title as string,
    suggestedQuestions: data.suggested_questions,
    updatedAt: data.updated_at as string,
  };
}

/** How many notebooks the owner has. */
export async function countByOwner(ownerId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("notebooks")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  if (error) fail("countByOwner", error);
  return count ?? 0;
}

/** Creates a notebook for the owner. Without a title the schema default "Untitled notebook" applies. */
export async function insert(ownerId: string, title?: string): Promise<{ id: string }> {
  const { data, error } = await getSupabase()
    .from("notebooks")
    .insert(title === undefined ? { owner_id: ownerId } : { owner_id: ownerId, title })
    .select("id")
    .single();
  if (error) fail("insert", error);
  return { id: data.id as string };
}

/** Renames the owner's notebook. Returns null if no row matched (deleted meanwhile). */
export async function updateTitle(ownerId: string, id: string, title: string): Promise<{ id: string } | null> {
  const { data, error } = await getSupabase()
    .from("notebooks")
    .update({ title })
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) fail("updateTitle", error);
  return data;
}

/** Deletes the owner's notebook; sources, chunks and messages go with it (on delete cascade). */
export async function remove(ownerId: string, id: string): Promise<void> {
  const { error } = await getSupabase().from("notebooks").delete().eq("owner_id", ownerId).eq("id", id);
  if (error) fail("remove", error);
}
