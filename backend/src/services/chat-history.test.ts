import { describe, expect, it } from "vitest";
import { buildHistory, collapseResends, isEmptyAnswer } from "./chat-history";

const user = (content: string) => ({ role: "user" as const, content });
const assistant = (content: string) => ({ role: "assistant" as const, content });

describe("buildHistory", () => {
  it("keeps alternating pairs and strips markers from answers", () => {
    expect(buildHistory([user("q1"), assistant("a1 [1]."), user("q2"), assistant("a2 [2][3].")])).toEqual([
      user("q1"),
      assistant("a1."),
      user("q2"),
      assistant("a2."),
    ]);
  });

  it("drops an unanswered user message in the middle", () => {
    expect(buildHistory([user("q1"), user("q1 again"), assistant("a1")])).toEqual([user("q1 again"), assistant("a1")]);
  });

  it("drops a trailing unanswered message and a leading answer", () => {
    expect(buildHistory([assistant("old"), user("q1"), assistant("a1"), user("q2")])).toEqual([
      user("q1"),
      assistant("a1"),
    ]);
  });
});

describe("collapseResends", () => {
  it("shows a resent question once", () => {
    const messages = [user("q"), user(" q "), assistant("a")];
    expect(collapseResends(messages)).toEqual([user(" q "), assistant("a")]);
  });

  it("keeps different consecutive questions and repeated answered ones", () => {
    const messages = [user("q1"), user("q2"), assistant("a"), user("q2"), assistant("b")];
    expect(collapseResends(messages)).toEqual(messages);
  });
});

describe("isEmptyAnswer", () => {
  it("is true for empty and whitespace-only text, false otherwise", () => {
    expect(isEmptyAnswer("")).toBe(true);
    expect(isEmptyAnswer(" \n\t ")).toBe(true);
    expect(isEmptyAnswer("Yes.")).toBe(false);
  });
});
