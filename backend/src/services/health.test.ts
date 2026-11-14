import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabase } from "../supabase";
import { checkDatabase } from "./health";

vi.mock("../supabase", () => ({ getSupabase: vi.fn() }));

/** A fake query builder that records the chain and settles with the given result. */
function fakeClient(result: { error: unknown } | Error) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["from", "select", "eq", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.abortSignal = (...args: unknown[]) => {
    calls.push(["abortSignal", args]);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve({ data: [], ...result });
  };
  return { client: builder, calls };
}

describe("checkDatabase", () => {
  beforeEach(() => {
    vi.mocked(getSupabase).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns true and scopes the query to the nil owner with a timeout", async () => {
    const { client, calls } = fakeClient({ error: null });
    vi.mocked(getSupabase).mockReturnValue(client as never);
    await expect(checkDatabase()).resolves.toBe(true);
    expect(calls).toContainEqual(["from", ["notebooks"]]);
    expect(calls).toContainEqual(["eq", ["owner_id", "00000000-0000-0000-0000-000000000000"]]);
    expect(calls.find(([method]) => method === "abortSignal")?.[1][0]).toBeInstanceOf(AbortSignal);
  });

  it("returns false and logs when the query returns an error", async () => {
    const { client } = fakeClient({ error: { code: "PGRST301", message: "JWT invalid" } });
    vi.mocked(getSupabase).mockReturnValue(client as never);
    await expect(checkDatabase()).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("returns false when the request rejects (e.g. a timeout)", async () => {
    const { client } = fakeClient(new Error("The operation was aborted due to timeout"));
    vi.mocked(getSupabase).mockReturnValue(client as never);
    await expect(checkDatabase()).resolves.toBe(false);
  });

  it("returns false when env is missing", async () => {
    vi.mocked(getSupabase).mockImplementation(() => {
      throw new Error("Missing or invalid env: SUPABASE_SECRET_KEY");
    });
    await expect(checkDatabase()).resolves.toBe(false);
  });
});
