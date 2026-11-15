import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertMany } from "../db/chunks";
import { claim, markFailed, markReady } from "../db/sources";
import { AppError } from "../errors";
import { embedDocuments } from "../rag/embed";
import { summarizeSource } from "../rag/summarize";
import { processSource } from "./sources";

vi.mock("../db/sources", () => ({ claim: vi.fn(), getOwned: vi.fn(), markReady: vi.fn(), markFailed: vi.fn() }));
vi.mock("../db/chunks", () => ({ insertMany: vi.fn() }));
vi.mock("../rag/embed", () => ({ embedDocuments: vi.fn() }));
vi.mock("../rag/summarize", () => ({ summarizeSource: vi.fn() }));
vi.mock("./ownership", () => ({ assertSourceOwner: vi.fn(), assertNotebookOwner: vi.fn() }));

const owner = "0f8e2c4a-1111-4222-8333-444455556666";
const sourceId = "3c2b1a00-eeee-4fff-9aaa-bbbbccccdddd";
const claimed = {
  id: sourceId,
  notebookId: "7b1d9e20-aaaa-4bbb-8ccc-dddd00001111",
  type: "text",
  inputText: "A short text about tide mills.",
} as Awaited<ReturnType<typeof claim>>;

describe("processSource", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(claim).mockResolvedValue(claimed);
    vi.mocked(embedDocuments).mockResolvedValue([Array(768).fill(0)]);
    vi.mocked(markReady).mockResolvedValue(true);
    vi.mocked(markFailed).mockResolvedValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("marks the source ready with its summary", async () => {
    vi.mocked(summarizeSource).mockResolvedValue("A summary.");
    await expect(processSource(owner, sourceId)).resolves.toEqual({ status: "ready" });
    expect(insertMany).toHaveBeenCalledOnce();
    expect(markReady).toHaveBeenCalledWith(owner, sourceId, expect.objectContaining({ summary: "A summary." }));
  });

  it("still marks the source ready, without a summary, when the summary call fails", async () => {
    vi.mocked(summarizeSource).mockRejectedValue(new AppError("RATE_LIMITED"));
    await expect(processSource(owner, sourceId)).resolves.toEqual({ status: "ready" });
    expect(markReady).toHaveBeenCalledWith(owner, sourceId, expect.objectContaining({ summary: null }));
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("marks the source failed with the code's message when embedding fails", async () => {
    vi.mocked(embedDocuments).mockRejectedValue(new AppError("RATE_LIMITED"));
    await expect(processSource(owner, sourceId)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(markFailed).toHaveBeenCalledWith(owner, sourceId, "Lots of requests right now. Try again in a minute.");
    expect(markReady).not.toHaveBeenCalled();
  });
});
