import "server-only";
import { getSupabase } from "../supabase";

/** Loads one notebook's id if it belongs to the owner, else null. Always scoped by owner_id. */
export async function findOwned(ownerId: string, id: string): Promise<{ id: string } | null> {
  const { data, error } = await getSupabase()
    .from("notebooks")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`notebooks.findOwned failed: ${error.code || "unknown"}`, { cause: error });
  return data;
}
