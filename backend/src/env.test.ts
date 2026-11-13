import { beforeEach, describe, expect, it } from "vitest";
import { getGeminiEnv, getSupabaseEnv, resetEnvCache } from "./env";

const supabase = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
};

describe("env", () => {
  beforeEach(() => resetEnvCache());

  it("getSupabaseEnv succeeds without the Gemini key", () => {
    expect(getSupabaseEnv({ ...supabase })).toEqual(supabase);
  });

  it("a missing variable throws an Error naming it, not a ZodError", () => {
    const run = () => getSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: supabase.NEXT_PUBLIC_SUPABASE_URL });
    expect(run).toThrow("SUPABASE_SECRET_KEY");
    try {
      run();
    } catch (error) {
      expect((error as Error).constructor).toBe(Error);
    }
  });

  it("names every missing variable and never includes values", () => {
    const run = () => getSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url", SUPABASE_SECRET_KEY: "" });
    expect(run).toThrow(/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY/);
    expect(run).not.toThrow(/not a url/);
  });

  it("getGeminiEnv throws naming its variable when missing", () => {
    expect(() => getGeminiEnv({})).toThrow("GOOGLE_GENERATIVE_AI_API_KEY");
  });

  it("caches the parsed values", () => {
    const first = getGeminiEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "key-1" });
    expect(getGeminiEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "key-2" })).toBe(first);
  });
});
