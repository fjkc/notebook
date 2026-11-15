import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSuggestedQuestions } from "../ai/suggestions";
import { getSuggestedQuestions, setSuggestedQuestions } from "../db/notebooks";
import { listReadySummaries } from "../db/sources";
import { refreshSuggestedQuestions } from "./notebooks";

vi.mock("../ai/suggestions", () => ({ generateSuggestedQuestions: vi.fn() }));
vi.mock("../db/notebooks", () => ({ getSuggestedQuestions: vi.fn(), setSuggestedQuestions: vi.fn() }));
vi.mock("../db/sources", () => ({ listReadySummaries: vi.fn() }));
vi.mock("../db/storage", () => ({}));

const owner = "0f8e2c4a-1111-4222-8333-444455556666";
const notebook = "7b1d9e20-aaaa-4bbb-8ccc-dddd00001111";
const questions = ["How did the mill work?"];

/** The summaries the first and the second (re-)read return. */
function reads(first: string[], second: string[]) {
  vi.mocked(listReadySummaries).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
}

describe("refreshSuggestedQuestions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(generateSuggestedQuestions).mockResolvedValue(questions);
    vi.mocked(getSuggestedQuestions).mockResolvedValue([]);
  });

  it("stores [] without a Gemini call when no ready source has a summary", async () => {
    vi.mocked(listReadySummaries).mockResolvedValueOnce([]);
    await refreshSuggestedQuestions(owner, notebook);
    expect(generateSuggestedQuestions).not.toHaveBeenCalled();
    expect(setSuggestedQuestions).toHaveBeenCalledWith(owner, notebook, [], undefined);
  });

  it("writes when the set didn't change", async () => {
    reads(["A"], ["A"]);
    await refreshSuggestedQuestions(owner, notebook);
    expect(setSuggestedQuestions).toHaveBeenCalledWith(owner, notebook, questions, undefined);
  });

  it("keeps the old questions when cleaning left none", async () => {
    reads(["A"], ["A"]);
    vi.mocked(generateSuggestedQuestions).mockResolvedValue([]);
    await refreshSuggestedQuestions(owner, notebook);
    expect(setSuggestedQuestions).not.toHaveBeenCalled();
  });

  it("leaves a grown set to the newer refresh when questions are stored", async () => {
    reads(["A"], ["A", "B"]);
    vi.mocked(getSuggestedQuestions).mockResolvedValue(["Older question?"]);
    await refreshSuggestedQuestions(owner, notebook);
    expect(setSuggestedQuestions).not.toHaveBeenCalled();
  });

  it("still writes a grown set when nothing is stored yet", async () => {
    reads(["A"], ["A", "B"]);
    await refreshSuggestedQuestions(owner, notebook);
    expect(setSuggestedQuestions).toHaveBeenCalledWith(owner, notebook, questions, undefined);
  });

  it.each([
    ["shrank", ["A", "B"], ["B"]],
    ["became empty", ["A"], []],
  ])("never writes when the set %s (a source was deleted), even with nothing stored", async (_, first, second) => {
    reads(first, second);
    await refreshSuggestedQuestions(owner, notebook);
    expect(setSuggestedQuestions).not.toHaveBeenCalled();
  });
});
