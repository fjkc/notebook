import { describe, expect, it } from "vitest";
import { htmlToText } from "./html-text";

describe("htmlToText", () => {
  it("separates paragraphs, list items and headings by a blank line", () => {
    const html = "<h2>Title</h2><p>First paragraph.</p><p>Second paragraph.</p><ul><li>One</li><li>Two</li></ul>";
    expect(htmlToText(html)).toBe("Title\n\nFirst paragraph.\n\nSecond paragraph.\n\nOne\n\nTwo");
  });

  it("doesn't add breaks for inline elements", () => {
    expect(htmlToText("<p>Some <b>bold</b>, <a href='#'>a link</a> and <em>more</em>.</p>")).toBe(
      "Some bold, a link and more.",
    );
  });

  it("emits a p inside an li once", () => {
    expect(htmlToText("<ul><li><p>Nested item</p></li></ul>")).toBe("Nested item");
  });

  it("keeps bare text directly in a div", () => {
    expect(htmlToText("<div>Loose text<p>Paragraph</p>Tail text</div>")).toBe("Loose text\n\nParagraph\n\nTail text");
  });

  it("turns br into a line break", () => {
    expect(htmlToText("<p>Line one<br>Line two</p>")).toBe("Line one\nLine two");
  });

  it("drops script and style content", () => {
    expect(htmlToText("<p>Kept</p><script>var x = 1;</script><style>p{color:red}</style>")).toBe("Kept");
  });

  it("collapses whitespace and runs of breaks", () => {
    expect(htmlToText("<div><div>\n  <p>  A \n  b  </p>\n</div></div><p></p><p>C</p>")).toBe("A b\n\nC");
  });

  it("decodes entities", () => {
    expect(htmlToText("<p>Fish &amp; chips &lt;3</p>")).toBe("Fish & chips <3");
  });
});
