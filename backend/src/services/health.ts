import "server-only";
import { describeError } from "../errors";
import { HEALTH_CHECK_TIMEOUT_MS } from "../shared/limits";
import { getSupabase } from "../supabase";

/**
 * The health query's owner: the nil UUID, which no real owner has (isUuid rejects it). The query
 * is scoped like every other (CLAUDE.md rule 5), reaches the database and returns no rows.
 */
const HEALTH_OWNER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * True if the database answers one cheap, owner-scoped query within HEALTH_CHECK_TIMEOUT_MS.
 * Never throws: a failure, a timeout or missing env gives false, and the reason is only logged.
 */
export async function checkDatabase(): Promise<boolean> {
  try {
    const { error } = await getSupabase()
      .from("notebooks")
      .select("id")
      .eq("owner_id", HEALTH_OWNER_ID)
      .limit(1)
      .abortSignal(AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS));
    if (error) throw new Error(`health query failed: ${error.code || "unknown"}`, { cause: error });
    return true;
  } catch (error) {
    console.error("[health] database check failed", JSON.stringify(describeError(error)));
    return false;
  }
}
