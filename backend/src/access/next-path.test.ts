import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each(["/", "/notebook/123", "/notebook/123?tab=chat", "/a/b#c", "/login-help"])("keeps %j", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["not a string", undefined],
    ["an array (repeated query param)", ["/a", "/b"]],
    ["empty", ""],
    ["relative", "notebook/1"],
    ["protocol-relative", "//evil.example"],
    ["protocol-relative with path", "//evil.example/login"],
    ["backslash", "/\\evil.example"],
    ["tab before slash", "/\t/evil.example"],
    ["newline", "/\n/evil.example"],
    ["space", "/ /evil.example"],
    ["null byte", "/\u0000/evil.example"],
    ["absolute http", "http://evil.example/"],
    ["absolute https", "https://evil.example/"],
    ["javascript", "javascript:alert(1)"],
    ["login", "/login"],
    ["login with slash", "/login/"],
    ["login with query", "/login?next=/login"],
  ])("returns / for %s", (_, input) => {
    expect(safeNextPath(input)).toBe("/");
  });
});
