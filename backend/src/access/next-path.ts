const BASE = "http://localhost";
// Any whitespace or control character, including tab and newline, which URL parsing would strip.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\s\u0000-\u001f\u007f]/;
const LOGIN_PATH = /^\/login\/?$/;

/**
 * Where to go after login. Returns `next` only if it's a same-origin path: a string without control
 * or whitespace characters, starting with a single "/", that stays on the base origin and isn't the
 * login page. Anything else gives "/". Blocks "//evil.example", "/\evil.example", absolute URLs and loops.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || UNSAFE_CHARS.test(next)) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return "/";
  if (LOGIN_PATH.test(url.pathname)) return "/";
  return next;
}
