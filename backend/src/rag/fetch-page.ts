import "server-only";
import { promises as dns } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { AppError } from "../errors";
import { MAX_URL_BYTES, URL_FETCH_TIMEOUT_MS, URL_MAX_REDIRECTS } from "../shared/limits";
import { createGuardedLookup, createResolver, resolveRedirect } from "./url-guard";

// Guarded fetch for web page sources (NB-008 R3, docs/ARCHITECTURE.md §6 "SSRF protection").
// node:http(s) instead of the global fetch: `lookup` pins the socket to the address the guard checked.

const USER_AGENT = "Notehooked/1.0 (+source reader)";
const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const META_SNIFF_BYTES = 2_048;

const lookup = createGuardedLookup(
  createResolver(
    (hostname) => dns.resolve4(hostname),
    (hostname) => dns.resolve6(hostname),
  ),
);

function request(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT },
      lookup,
      signal,
    });
    req.on("response", resolve);
    req.on("error", reject);
    req.end();
  });
}

async function readBody(response: IncomingMessage): Promise<Buffer> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of response) {
    const chunk = part as Buffer;
    size += chunk.length;
    if (size > MAX_URL_BYTES) {
      response.destroy();
      throw new Error(`Body larger than ${MAX_URL_BYTES} bytes`);
    }
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}

function decoderFor(label: string | undefined): TextDecoder {
  try {
    if (label) return new TextDecoder(label.trim().replace(/^["']|["']$/g, ""));
  } catch {
    // Unknown label: fall back to UTF-8.
  }
  return new TextDecoder("utf-8");
}

/** Charset from the Content-Type header, else a <meta charset> in the first 2 KB, else UTF-8. */
export function decodeHtml(body: Buffer, contentType: string): string {
  const fromHeader = /charset\s*=\s*([^;\s]+)/i.exec(contentType)?.[1];
  const head = body.subarray(0, META_SNIFF_BYTES).toString("latin1");
  const fromMeta =
    /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head)?.[1];
  return decoderFor(fromHeader ?? fromMeta).decode(body);
}

/**
 * Fetches an HTML page that parsePublicUrl has already accepted: 10 s in total, at most 3 redirects
 * (each checked again), only 200 with an HTML type, at most 5 MB. Every failure is URL_FETCH_FAILED
 * with the underlying error as `cause` (logged, never shown).
 */
export async function fetchPage(start: URL): Promise<{ url: URL; html: string }> {
  const signal = AbortSignal.timeout(URL_FETCH_TIMEOUT_MS);
  let url = start;
  try {
    for (let redirects = 0; ; redirects++) {
      const response = await request(url, signal);
      const status = response.statusCode ?? 0;
      if (REDIRECT_STATUSES.has(status)) {
        response.resume();
        const location = response.headers.location;
        if (!location) throw new Error(`Redirect ${status} without Location`);
        if (redirects >= URL_MAX_REDIRECTS) throw new Error("Too many redirects");
        url = resolveRedirect(url, location);
        continue;
      }
      if (status !== 200) {
        response.resume();
        throw new Error(`HTTP ${status}`);
      }
      const contentType = response.headers["content-type"] ?? "";
      const mediaType = contentType.split(";")[0]!.trim().toLowerCase();
      if (!HTML_TYPES.has(mediaType)) {
        response.resume();
        throw new Error(`Unsupported content type ${mediaType || "(none)"}`);
      }
      return { url, html: decodeHtml(await readBody(response), contentType) };
    }
  } catch (error) {
    if (error instanceof AppError && error.code === "URL_FETCH_FAILED") throw error;
    throw new AppError("URL_FETCH_FAILED", { cause: error });
  }
}
