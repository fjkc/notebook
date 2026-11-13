import "server-only";
import { z } from "zod";

// Env is validated lazily, per group, on first use: importing a module never needs env vars,
// and the health check works without the Gemini key. A missing variable throws a plain Error
// naming it (never its value), which the frontend logs and maps to INTERNAL. A ZodError must
// not escape from here, because toErrorBody would show it to the user as VALIDATION.

const SupabaseEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

const GeminiEnv = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof SupabaseEnv>;
export type GeminiEnv = z.infer<typeof GeminiEnv>;

function parseEnv<T>(schema: z.ZodType<T>, group: string, source: NodeJS.ProcessEnv): T {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  throw new Error(`Missing or invalid ${group} env: ${names.join(", ")}`);
}

let supabaseEnv: SupabaseEnv | undefined;
let geminiEnv: GeminiEnv | undefined;

/** Supabase URL and secret key, parsed on first call. Throws an Error naming any missing variable. */
export function getSupabaseEnv(source: NodeJS.ProcessEnv = process.env): SupabaseEnv {
  supabaseEnv ??= parseEnv(SupabaseEnv, "Supabase", source);
  return supabaseEnv;
}

/** Gemini API key, parsed on first call. Throws an Error naming the variable if it's missing. */
export function getGeminiEnv(source: NodeJS.ProcessEnv = process.env): GeminiEnv {
  geminiEnv ??= parseEnv(GeminiEnv, "Gemini", source);
  return geminiEnv;
}

/** Test helper: forget the cached values. */
export function resetEnvCache(): void {
  supabaseEnv = undefined;
  geminiEnv = undefined;
}
