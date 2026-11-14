import { z } from "zod";

// The access gate's two secrets (CLAUDE.md rule 2). Deliberately not "server-only": the proxy
// imports this module. Never import it from a Client Component, and never prefix these with NEXT_PUBLIC_.

const AccessEnv = z.object({
  APP_PASSWORD: z.string().min(24),
  SESSION_SECRET: z.string().min(32),
});

export type AccessEnv = z.infer<typeof AccessEnv>;

let cached: { value: AccessEnv | null } | undefined;

/**
 * The password and session secret, parsed on first call. Fails closed: returns null (never throws)
 * if either is missing or invalid, and logs the variable names once, never their values.
 */
export function getAccessEnv(source: NodeJS.ProcessEnv = process.env): AccessEnv | null {
  if (cached) return cached.value;
  const result = AccessEnv.safeParse({
    APP_PASSWORD: source.APP_PASSWORD,
    SESSION_SECRET: source.SESSION_SECRET,
  });
  if (result.success) {
    cached = { value: result.data };
  } else {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    console.error(`[access] login is disabled, missing or invalid env: ${names.join(", ")}`);
    cached = { value: null };
  }
  return cached.value;
}

/** Test helper: forget the cached values. */
export function resetAccessEnvCache(): void {
  cached = undefined;
}
