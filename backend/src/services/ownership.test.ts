import { beforeEach, describe, expect, it, vi } from "vitest";
import { findOwned } from "../db/notebooks";
import { AppError } from "../errors";
import { assertNotebookOwner } from "./ownership";

vi.mock("../db/notebooks", () => ({ findOwned: vi.fn() }));

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
    expect(findOwned).not.toHaveBeenCalled();
  });
});
