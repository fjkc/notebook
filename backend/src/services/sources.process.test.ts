import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertMany } from "../db/chunks";
import { claim, markFailed, markReady } from "../db/sources";
import { AppError } from "../errors";
import { embedDocuments } from "../rag/embed";
import { extractPdf, extractUrl } from "../rag/extract";
import { summarizeSource } from "../rag/summarize";
import { processSource } from "./sources";

vi.mock("../db/sources", () => ({ claim: vi.fn(), getOwned: vi.fn(), markReady: vi.fn(), markFailed: vi.fn() }));
vi.mock("../db/chunks", () => ({ insertMany: vi.fn() }));
vi.mock("../rag/embed", () => ({ embedDocuments: vi.fn() }));
vi.mock("../rag/extract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../rag/extract")>()),
  extractUrl: vi.fn(),
  extractPdf: vi.fn(),
}));
vi.mock("../db/storage", () => ({ download: vi.fn(), removeQuietly: vi.fn(), pdfPath: vi.fn() }));
vi.mock("../rag/summarize", () => ({ summarizeSource: vi.fn() }));
vi.mock("./ownership", () => ({ assertSourceOwner: vi.fn(), assertNotebookOwner: vi.fn() }));

const owner = "0f8e2c4a-1111-4222-8333-444455556666";
const sourceId = "3c2b1a00-eeee-4fff-9aaa-bbbbccccdddd";
const claimed = {
  id: sourceId,
  notebookId: "7b1d9e20-aaaa-4bbb-8ccc-dddd00001111",
  type: "text",
  inputText: "A short text about tide mills.",
} as NonNullable<Awaited<ReturnType<typeof claim>>>;

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

  it("stores a web page's own title, cut to 80 characters", async () => {
    vi.mocked(claim).mockResolvedValue({ ...claimed, type: "url", inputText: null, url: "https://example.com/a" });
    vi.mocked(extractUrl).mockResolvedValue({ pages: [{ page: null, text: "Body text." }], title: "T".repeat(100) });
    await processSource(owner, sourceId);
    expect(markReady).toHaveBeenCalledWith(
      owner,
      sourceId,
      expect.objectContaining({ title: "T".repeat(80), pageCount: null, charCount: 10 }),
    );
  });

  it("stores a PDF's total page count, blank pages included", async () => {
    vi.mocked(claim).mockResolvedValue({ ...claimed, type: "pdf", inputText: null, storagePath: `${owner}/x.pdf` });
    vi.mocked(extractPdf).mockResolvedValue({
      pages: [
        { page: 1, text: "Page one." },
        { page: 2, text: "" },
      ],
      pageCount: 2,
    });
    vi.mocked(embedDocuments).mockResolvedValue([Array(768).fill(0)]);
    await processSource(owner, sourceId);
    expect(markReady).toHaveBeenCalledWith(owner, sourceId, expect.objectContaining({ pageCount: 2 }));
  });

  it.each([
    ["url", "This page has more than 80,000 characters of text. Paste the part you need instead."],
    ["pdf", "This PDF has more than 80,000 characters of text. Split it, or paste the part you need."],
  ] as const)("fails a %s source over the text cap before embedding", async (type, message) => {
    vi.mocked(claim).mockResolvedValue({
      ...claimed,
      type,
      inputText: null,
      url: "https://example.com/",
      storagePath: `${owner}/x.pdf`,
    });
    const extracted = { pages: [{ page: 1, text: "x".repeat(80_001) }] };
    vi.mocked(type === "url" ? extractUrl : extractPdf).mockResolvedValue(extracted);
    await expect(processSource(owner, sourceId)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect(embedDocuments).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(owner, sourceId, message);
  });
});
