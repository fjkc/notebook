import { describe, expect, it } from "vitest";
import { cutExcerpt, parseCitations, stripCitationMarkers, usedCitationNumbers } from "./citations";

const valid = [1, 2, 3];

describe("parseCitations", () => {
  it("finds a single marker", () => {
    expect(parseCitations("Warming is real [1].", valid)).toEqual([
      { type: "text", text: "Warming is real " },
      { type: "cite", numbers: [1] },
      { type: "text", text: "." },
    ]);
  });

  it("finds comma lists with and without spaces", () => {
    expect(parseCitations("a [1, 3] b [1,2]", valid)).toEqual([
      { type: "text", text: "a " },
      { type: "cite", numbers: [1, 3] },
      { type: "text", text: " b " },
      { type: "cite", numbers: [1, 2] },
    ]);
  });

  it("merges adjacent markers and keeps spaced ones apart", () => {
    expect(parseCitations("x [1][3]", valid)).toEqual([
      { type: "text", text: "x " },
      { type: "cite", numbers: [1, 3] },
    ]);
    expect(parseCitations("[1] [3]", valid)).toEqual([
      { type: "cite", numbers: [1] },
      { type: "text", text: " " },
      { type: "cite", numbers: [3] },
    ]);
  });

  it("leaves a marker with only unknown numbers as text", () => {
    expect(parseCitations("see [9].", valid)).toEqual([{ type: "text", text: "see [9]." }]);
  });

  it("drops unknown numbers from a mixed marker", () => {
    expect(parseCitations("a [2, 9][7]", valid)).toEqual([
      { type: "text", text: "a " },
      { type: "cite", numbers: [2] },
    ]);
  });

  it("leaves footnotes and other brackets alone", () => {
    expect(parseCitations("note[^1] and [a]", valid)).toEqual([{ type: "text", text: "note[^1] and [a]" }]);
  });

  it("handles an empty string and text without markers", () => {
    expect(parseCitations("", valid)).toEqual([]);
    expect(parseCitations("plain text", valid)).toEqual([{ type: "text", text: "plain text" }]);
  });
});

describe("usedCitationNumbers", () => {
  it("collects markers in normal text and in a list", () => {
    expect(usedCitationNumbers("First [3].\n\n- item [1, 2]\n- other", valid)).toEqual([1, 2, 3]);
  });

  it("ignores markers in inline code and fenced blocks", () => {
    const md = "Use `arr[1]` here [2].\n\n```js\nconst x = a[3];\n```\n\n~~~\n[1]\n~~~";
    expect(usedCitationNumbers(md, valid)).toEqual([2]);
  });

  it("ignores unknown numbers and Markdown links", () => {
    expect(usedCitationNumbers("a [7] b [text](https://x.test) c [1](https://y.test) d [3]", valid)).toEqual([3]);
  });
});

describe("stripCitationMarkers", () => {
  it("removes markers of each form and keeps the sentence intact", () => {
    expect(stripCitationMarkers("Warming is real [1][3].")).toBe("Warming is real.");
    expect(stripCitationMarkers("A [1, 2] and B [4].\n- C [5]")).toBe("A and B.\n- C");
  });

  it("keeps footnotes and links", () => {
    expect(stripCitationMarkers("x[^1] [docs](https://x.test)")).toBe("x[^1] [docs](https://x.test)");
  });
});

describe("cutExcerpt", () => {
  it("keeps short text and cuts long text at a word boundary", () => {
    expect(cutExcerpt("  short  ", 10)).toBe("short");
    expect(cutExcerpt("one two three four", 10)).toBe("one two…");
  });
});
