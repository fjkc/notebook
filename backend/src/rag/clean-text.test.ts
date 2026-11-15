import { describe, expect, it } from "vitest";
import { stripControlChars } from "./clean-text";

describe("stripControlChars", () => {
  it("removes NUL and other control characters but keeps tabs and line breaks", () => {
    expect(stripControlChars("a\u0000b\u0007c\td\ne\r\nf\u007f")).toBe("abc\td\ne\r\nf");
  });

  it("leaves nothing of text made only of control characters", () => {
    expect(stripControlChars("\u0000\u0001".repeat(200))).toBe("");
  });
});
