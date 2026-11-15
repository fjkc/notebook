import { describe, expect, it } from "vitest";
import { decodeHtml, htmlToText } from "./html-text";

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

describe("decodeHtml", () => {
  const latin1 = new Uint8Array([0x3c, 0x70, 0x3e, 0x63, 0x61, 0x66, 0xe9, 0x3c, 0x2f, 0x70, 0x3e]); // <p>café</p>
  const utf8 = (s: string) => new TextEncoder().encode(s);

  it("uses the charset from the Content-Type header", () => {
    expect(decodeHtml(latin1, "text/html; charset=ISO-8859-1")).toBe("<p>café</p>");
  });

  it("accepts a quoted charset label", () => {
    expect(decodeHtml(latin1, 'text/html; charset="iso-8859-1"')).toBe("<p>café</p>");
  });

  it("falls back to a meta charset in the first 2 KB", () => {
    const body = new Uint8Array([...utf8('<meta charset="windows-1252">'), ...latin1]);
    expect(decodeHtml(body, "text/html")).toBe('<meta charset="windows-1252"><p>café</p>');
  });

  it("defaults to UTF-8", () => {
    expect(decodeHtml(utf8("<p>café</p>"), "text/html")).toBe("<p>café</p>");
  });

  it("falls back to UTF-8 for an unknown label", () => {
    expect(decodeHtml(utf8("<p>café</p>"), "text/html; charset=klingon")).toBe("<p>café</p>");
  });
});
