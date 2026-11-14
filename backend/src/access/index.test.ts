import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessEnv, resetAccessEnvCache } from "./env";
import { createSession, hasValidSession, isAppPassword } from "./index";

const PASSWORD = "p".repeat(32);

describe("access entry", () => {
  beforeEach(() => {
    resetAccessEnvCache();
    vi.stubEnv("APP_PASSWORD", PASSWORD);
    vi.stubEnv("SESSION_SECRET", "s".repeat(44));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("a session created for the current env is valid", async () => {
    const env = getAccessEnv();
    if (!env) throw new Error("env not set");
    expect(isAppPassword(env, PASSWORD)).toBe(true);
    expect(isAppPassword(env, "wrong")).toBe(false);
    expect(await hasValidSession(await createSession(env))).toBe(true);
    expect(await hasValidSession(undefined)).toBe(false);
  });

  it("no session is valid when login isn't set up", async () => {
    const env = getAccessEnv();
    if (!env) throw new Error("env not set");
    const token = await createSession(env);
    resetAccessEnvCache();
    vi.stubEnv("SESSION_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await hasValidSession(token)).toBe(false);
  });
});
