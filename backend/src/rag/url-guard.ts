import { isIP } from "node:net";
import { AppError } from "../errors";
import { MAX_URL_CHARS } from "../shared/limits";

// SSRF protection (docs/ARCHITECTURE.md §6 "SSRF protection"). Pure: DNS is injected, so all of it is unit-tested.

export const URL_MESSAGES = {
  tooLong: `Links can be up to ${MAX_URL_CHARS.toLocaleString("en-US")} characters.`,
  scheme: "Enter a link that starts with http:// or https://.",
  credentials: "Links with a user name or password aren't supported.",
  port: "Links with a port number aren't supported.",
  privateAddress: "That link points to a private address.",
} as const;

// IPv4 ranges that are not public: [network, prefix length].
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3], // multicast, reserved and broadcast
];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
}

function isPublicV4(ip: string): boolean {
  const value = v4ToInt(ip);
  return !BLOCKED_V4.some(([network, bits]) => {
    const size = 2 ** (32 - bits);
    const start = v4ToInt(network);
    return value >= start && value < start + size;
  });
}

/** Expands an IPv6 address (no brackets, possibly with an embedded IPv4 tail) to eight 16-bit groups. */
function v6Groups(ip: string): number[] | null {
  let address = ip.toLowerCase().split("%")[0]!;
  const v4Tail = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Tail) {
    const n = v4ToInt(v4Tail[1]!);
    address = `${address.slice(0, -v4Tail[1]!.length)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail].map((g) =>
    parseInt(g, 16),
  );
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

function isPublicV6(ip: string): boolean {
  const g = v6Groups(ip);
  if (!g) return false;
  // IPv4-mapped ::ffff:a.b.c.d is judged by its IPv4 part.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return isPublicV4(`${g[6]! >> 8}.${g[6]! & 0xff}.${g[7]! >> 8}.${g[7]! & 0xff}`);
  }
  if ((g[0]! & 0xe000) !== 0x2000) return false; // only global unicast 2000::/3
  if (g[0] === 0x2001 && g[1] === 0) return false; // Teredo 2001::/32
  if (g[0] === 0x2001 && g[1] === 0xdb8) return false; // documentation 2001:db8::/32
  if (g[0] === 0x2002) return false; // 6to4 2002::/16
  return true;
}

/** True only for a public unicast address. Accepts IPv6 with or without brackets. */
export function isPublicAddress(ip: string): boolean {
  const bare = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  const version = isIP(bare);
  if (version === 4) return isPublicV4(bare);
  if (version === 6) return isPublicV6(bare);
  return false;
}

function isLocalhostName(hostname: string): boolean {
  const name = hostname.toLowerCase().replace(/\.$/, "");
  return name === "localhost" || name.endsWith(".localhost");
}

/**
 * Checks a user-entered link without DNS (R2). Each failure is a VALIDATION error with its message.
 * Literal IPs are checked here because Node skips `lookup` for them.
 */
export function parsePublicUrl(input: string): URL {
  if (input.length > MAX_URL_CHARS) throw new AppError("VALIDATION", URL_MESSAGES.tooLong);
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("VALIDATION", URL_MESSAGES.scheme);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new AppError("VALIDATION", URL_MESSAGES.scheme);
  if (url.username || url.password) throw new AppError("VALIDATION", URL_MESSAGES.credentials);
  // `new URL` drops the scheme's default port, so any port left is a non-default one.
  if (url.port && url.port !== "80" && url.port !== "443") throw new AppError("VALIDATION", URL_MESSAGES.port);
  const host = url.hostname;
  const bare = host.startsWith("[") ? host.slice(1, -1) : host;
  if (isLocalhostName(host) || (isIP(bare) !== 0 && !isPublicAddress(bare))) {
    throw new AppError("VALIDATION", URL_MESSAGES.privateAddress);
  }
  return url;
}

/**
 * Resolves a redirect's Location against the current URL and checks it like a user link. Fails with
 * URL_FETCH_FAILED (not VALIDATION), because it happens during processing.
 */
export function resolveRedirect(currentUrl: URL, location: string): URL {
  try {
    return parsePublicUrl(new URL(location, currentUrl).href);
  } catch (error) {
    throw new AppError("URL_FETCH_FAILED", { cause: error });
  }
}

export type ResolvedAddress = { address: string; family: 4 | 6 };
/** Resolves a hostname to all its A and AAAA records. Injected so tests need no network. */
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

const EMPTY_ANSWER_CODES = new Set(["ENODATA", "ENOTFOUND"]);

/**
 * Builds a Resolver from A and AAAA queries run in parallel (R3). ENODATA or ENOTFOUND for one family
 * counts as an empty list; any other error (e.g. a timeout) fails the whole lookup.
 */
export function createResolver(
  resolve4: (hostname: string) => Promise<string[]>,
  resolve6: (hostname: string) => Promise<string[]>,
): Resolver {
  const orEmpty = (error: unknown): string[] => {
    if (EMPTY_ANSWER_CODES.has((error as NodeJS.ErrnoException | null)?.code ?? "")) return [];
    throw error;
  };
  return async (hostname) => {
    const [v4, v6] = await Promise.all([
      resolve4(hostname).catch(orEmpty),
      resolve6(hostname).catch(orEmpty),
    ]);
    return [
      ...v4.map((address) => ({ address, family: 4 as const })),
      ...v6.map((address) => ({ address, family: 6 as const })),
    ];
  };
}

type LookupOptions ={ all?: boolean; family?: number | string };
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | ResolvedAddress[],
  family?: number,
) => void;

/**
 * A function with `dns.lookup`'s signature for `http(s).request({ lookup })` (R2). Fails if any resolved
 * address isn't public, so the socket only ever connects to a checked address (no DNS rebinding).
 */
export function createGuardedLookup(resolve: Resolver) {
  return (hostname: string, options: LookupOptions | number | LookupCallback, maybeCallback?: LookupCallback) => {
    const callback = (typeof options === "function" ? options : maybeCallback)!;
    const all = typeof options === "object" && options.all === true;
    resolve(hostname).then(
      (addresses) => {
        if (addresses.length === 0) {
          return callback(Object.assign(new Error(`No addresses for ${hostname}`), { code: "ENOTFOUND" }), "");
        }
        if (addresses.some((a) => !isPublicAddress(a.address))) {
          return callback(Object.assign(new Error("Resolved to a non-public address"), { code: "EBLOCKED" }), "");
        }
        if (all) return callback(null, addresses);
        const first = addresses[0]!;
        return callback(null, first.address, first.family);
      },
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), ""),
    );
  };
}
