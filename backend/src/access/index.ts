// Entry "@repo/backend/access": the access gate (docs/ARCHITECTURE.md → "Access gate").
// Deliberately without the server guard of the main entry, because the proxy imports it. Import it
// only from proxy.ts, lib/owner.ts and the login page and action, never from a Client Component.
// Imports nothing from Next.js; its only env reads are in env.ts.
import { getAccessEnv, type AccessEnv } from "./env";
import { passwordMatches } from "./password";
import { createSessionToken, passwordFingerprint, verifySessionToken } from "./session";

export { getAccessEnv, resetAccessEnvCache, type AccessEnv } from "./env";
export { createSessionToken, passwordFingerprint, verifySessionToken } from "./session";
export { parsePasswordInput, passwordMatches } from "./password";
export { safeNextPath } from "./next-path";

/** Name of the session cookie. */
export const ACCESS_COOKIE = "access";

/** True if `input` is the app password. */
export function isAppPassword(env: AccessEnv, input: string): boolean {
  return passwordMatches(input, env.APP_PASSWORD);
}

/** A new session token for the current password and secret. */
export async function createSession(env: AccessEnv, now: number = Date.now()): Promise<string> {
  return createSessionToken(env.SESSION_SECRET, await passwordFingerprint(env.APP_PASSWORD), now);
}

/** True if `token` is a valid session for the current password and secret. False when login isn't set up. */
export async function hasValidSession(token: unknown, now: number = Date.now()): Promise<boolean> {
  const env = getAccessEnv();
  if (!env) return false;
  return verifySessionToken(token, env.SESSION_SECRET, await passwordFingerprint(env.APP_PASSWORD), now);
}
