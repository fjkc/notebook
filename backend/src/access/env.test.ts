import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessEnv, resetAccessEnvCache } from "./env";

const valid = { APP_PASSWORD: "p".repeat(32), SESSION_SECRET: "s".repeat(44) };

describe("getAccessEnv", () => {
  beforeEach(() => resetAccessEnvCache());
  afterEach(() => vi.restoreAllMocks());

  it("returns both values when they're valid", () => {
    expect(getAccessEnv({ ...valid })).toEqual(valid);
  });

  it.each([
    [{ SESSION_SECRET: valid.SESSION_SECRET }, "APP_PASSWORD"],
    [{ APP_PASSWORD: valid.APP_PASSWORD }, "SESSION_SECRET"],
    [{ ...valid, APP_PASSWORD: "p".repeat(23) }, "APP_PASSWORD"],
    [{ ...valid, SESSION_SECRET: "s".repeat(31) }, "SESSION_SECRET"],
    [{}, "APP_PASSWORD, SESSION_SECRET"],
  ])("returns null for %j and logs the name, never the value", (source, names) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getAccessEnv(source)).toBeNull();
    expect(log).toHaveBeenCalledOnce();
    const text = String(log.mock.calls[0]?.[0]);
    expect(text).toContain(names);
    expect(text).not.toMatch(/ppp|sss/);
  });

  it("trims values pasted with a trailing newline", () => {
    expect(getAccessEnv({ APP_PASSWORD: valid.APP_PASSWORD + "\n", SESSION_SECRET: " " + valid.SESSION_SECRET })).toEqual(valid);
  });

  it("never throws, even for odd input", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => getAccessEnv({ APP_PASSWORD: undefined, SESSION_SECRET: undefined })).not.toThrow();
  });

  it("caches the result and logs only once", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    getAccessEnv({});
    expect(getAccessEnv({ ...valid })).toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });
});
