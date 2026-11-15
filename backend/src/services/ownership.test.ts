import { beforeEach, describe, expect, it, vi } from "vitest";
import { findOwned } from "../db/notebooks";
import { getOwned } from "../db/sources";
import { AppError } from "../errors";
import { assertNotebookOwner, assertSourceOwner } from "./ownership";

vi.mock("../db/notebooks", () => ({ findOwned: vi.fn() }));
vi.mock("../db/sources", () => ({ getOwned: vi.fn() }));

const owner = "0f8e2c4a-1111-4222-8333-444455556666";
const notebook = "7b1d9e20-aaaa-4bbb-8ccc-dddd00001111";

describe("assertNotebookOwner", () => {
  beforeEach(() => vi.mocked(findOwned).mockReset());

  it("resolves when the notebook belongs to the owner", async () => {
    vi.mocked(findOwned).mockResolvedValue({ id: notebook });
    await expect(assertNotebookOwner(owner, notebook)).resolves.toBeUndefined();
    expect(findOwned).toHaveBeenCalledWith(owner, notebook);
  });

  it("throws NOT_FOUND when no row comes back", async () => {
    vi.mocked(findOwned).mockResolvedValue(null);
    await expect(assertNotebookOwner(owner, notebook)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND for a malformed notebook ID without querying", async () => {
    const error = await assertNotebookOwner(owner, "not-a-uuid").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });
    expect(findOwned).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND for a malformed owner ID without querying", async () => {
    await expect(assertNotebookOwner("abc", notebook)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assertNotebookOwner(undefined, notebook)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // The nil UUID is reserved for the health check (R23) and is never a real owner.
    await expect(assertNotebookOwner("00000000-0000-0000-0000-000000000000", notebook)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(findOwned).not.toHaveBeenCalled();
  });
});

describe("assertSourceOwner", () => {
  const source = "3c2b1a00-eeee-4fff-9aaa-bbbbccccdddd";
  beforeEach(() => vi.mocked(getOwned).mockReset());

  it("returns the row when the source belongs to the owner", async () => {
    const row = { id: source } as Awaited<ReturnType<typeof getOwned>>;
    vi.mocked(getOwned).mockResolvedValue(row);
    await expect(assertSourceOwner(owner, source)).resolves.toBe(row);
    expect(getOwned).toHaveBeenCalledWith(owner, source);
  });

  it("throws NOT_FOUND for an unknown or foreign source", async () => {
    vi.mocked(getOwned).mockResolvedValue(null);
    await expect(assertSourceOwner(owner, source)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND for malformed IDs without querying", async () => {
    await expect(assertSourceOwner(owner, "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assertSourceOwner("abc", source)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getOwned).not.toHaveBeenCalled();
  });
});
