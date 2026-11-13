import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";
import { SUPABASE_REQUEST_TIMEOUT_MS } from "./shared/limits";

let client: SupabaseClient | undefined;

/**
 * Default cap for short queries: aborts a request that hangs (e.g. a paused free-tier project).
 * It covers the whole request including the body, and Storage uses this fetch too. Long operations
 * (PDF downloads, bulk chunk inserts) must pass their own longer signal, which takes precedence:
 * `.abortSignal(AbortSignal.timeout(…))` for queries, the `signal` option for Storage.
 */
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS) });

/**
 * Server client with the secret key, created on first use. It bypasses RLS, so every query
 * must be scoped by owner_id (CLAUDE.md rule 5). Never import this outside the backend.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = getSupabaseEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout },
    });
  }
  return client;
}
