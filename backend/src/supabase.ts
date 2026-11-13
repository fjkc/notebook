import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let client: SupabaseClient | undefined;

/**
 * Server client with the secret key, created on first use. It bypasses RLS, so every query
 * must be scoped by owner_id (CLAUDE.md rule 5). Never import this outside the backend.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = getSupabaseEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
