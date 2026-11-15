import { describe, expect, it } from "vitest";
import { AppError, toUserMessage } from "../errors";
import {
  createGuardedLookup,
  createResolver,
  isPublicAddress,
  parsePublicUrl,
  resolveRedirect,
  URL_MESSAGES,
  type ResolvedAddress,
} from "./url-guard";

function errorOf(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("expected a throw");
}

describe("parsePublicUrl", () => {
  it("accepts a public link", () => {
    expect(parsePublicUrl("https://en.wikipedia.org/wiki/Lighthouse").hostname).toBe("en.wikipedia.org");
    expect(parsePublicUrl("http://example.com:80/").href).toBe("http://example.com/");
    expect(parsePublicUrl("https://example.com:443/a").href).toBe("https://example.com/a");
  });

  it.each([
    ["a 2,049-character link", `https://example.com/${"a".repeat(2049 - 20)}`, URL_MESSAGES.tooLong],
    ["text that isn't a link", "not a link", URL_MESSAGES.scheme],
    ["ftp", "ftp://example.com/file", URL_MESSAGES.scheme],
    ["javascript", "javascript:alert(1)", URL_MESSAGES.scheme],
    ["file", "file:///etc/passwd", URL_MESSAGES.scheme],
    ["credentials", "https://user:pw@example.com", URL_MESSAGES.credentials],
    ["a port", "https://example.com:8080", URL_MESSAGES.port],
    ["localhost", "http://localhost", URL_MESSAGES.privateAddress],
    ["localhost with a port 80", "http://localhost:80/", URL_MESSAGES.privateAddress],
    ["a .localhost name", "http://foo.localhost", URL_MESSAGES.privateAddress],
    ["127.0.0.1", "http://127.0.0.1", URL_MESSAGES.privateAddress],
    ["short form 127.1", "http://127.1", URL_MESSAGES.privateAddress],
    ["hex form 0x7f000001", "http://0x7f000001", URL_MESSAGES.privateAddress],
    ["decimal form 2130706433", "http://2130706433/", URL_MESSAGES.privateAddress],
    ["metadata address", "http://169.254.169.254/latest/meta-data/", URL_MESSAGES.privateAddress],
    ["IPv6 loopback", "http://[::1]/", URL_MESSAGES.privateAddress],
    ["IPv4-mapped loopback", "http://[::ffff:127.0.0.1]/", URL_MESSAGES.privateAddress],
  ])("rejects %s", (_name, input, message) => {
    const error = errorOf(() => parsePublicUrl(input));
    expect(error.code).toBe("VALIDATION");
    expect(toUserMessage(error)).toBe(message);
  });

  it("accepts a link of exactly 2,048 characters", () => {
    const link = `https://example.com/${"a".repeat(2048 - 20)}`;
    expect(link).toHaveLength(2048);
    expect(() => parsePublicUrl(link)).not.toThrow();
  });
});

describe("isPublicAddress", () => {
  it.each([
    "0.0.0.0",
    "0.255.255.255",
    "10.0.0.0",
    "10.255.255.255",
    "100.64.0.0",
    "100.127.255.255",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.0",
    "172.31.255.255",
    "192.0.0.1",
    "192.168.1.1",
    "198.18.0.0",
    "198.19.255.255",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
  ])("IPv4 %s is not public", (ip) => expect(isPublicAddress(ip)).toBe(false));

  it.each(["8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.0", "100.63.255.255", "100.128.0.0", "11.0.0.0", "198.20.0.0", "223.255.255.255", "192.0.1.1"])(
    "IPv4 %s is public",
    (ip) => expect(isPublicAddress(ip)).toBe(true),
  );

  it.each(["2606:4700::1", "[2606:4700::1]", "2a00:1450:4001:80b::200e"])("IPv6 %s is public", (ip) =>
    expect(isPublicAddress(ip)).toBe(true),
  );

  it.each([
    "::",
    "::1",
    "[::1]",
    "fe80::1",
    "fd00::1",
    "fc00::1",
    "ff02::1",
    "2002::1",
    "2001:db8::1",
    "2001::1",
    "64:ff9b::808:808",
    "::ffff:10.0.0.1",
    "::ffff:7f00:1",
    "::ffff:127.0.0.1",
  ])("IPv6 %s is not public", (ip) => expect(isPublicAddress(ip)).toBe(false));

  it("judges a mapped public IPv4 by its IPv4 part", () => {
    expect(isPublicAddress("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicAddress("::ffff:808:808")).toBe(true);
  });

  it("rejects things that aren't addresses", () => {
    expect(isPublicAddress("example.com")).toBe(false);
    expect(isPublicAddress("")).toBe(false);
  });
});

describe("resolveRedirect", () => {
  const current = new URL("https://example.com/articles/one");

  it("resolves a relative Location", () => {
    expect(resolveRedirect(current, "/articles/two").href).toBe("https://example.com/articles/two");
    expect(resolveRedirect(current, "three").href).toBe("https://example.com/articles/three");
  });

  it.each(["http://169.254.169.254/", "file:///etc/passwd", "http://localhost/", "https://example.com:8443/"])(
    "fails with URL_FETCH_FAILED for %s",
    (location) => {
      expect(errorOf(() => resolveRedirect(current, location)).code).toBe("URL_FETCH_FAILED");
    },
  );
});

describe("createGuardedLookup", () => {
  type Result = { err: NodeJS.ErrnoException | null; address: unknown; family?: number };

  function run(answer: ResolvedAddress[] | Error, options: { all?: boolean } | undefined): Promise<Result> {
    const lookup = createGuardedLookup(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    });
    return new Promise((resolve) => {
      const callback = (err: NodeJS.ErrnoException | null, address: unknown, family?: number) =>
        resolve({ err, address, family });
      if (options) lookup("example.com", options, callback);
      else lookup("example.com", callback);
    });
  }

  const v4: ResolvedAddress = { address: "93.184.215.14", family: 4 };
  const v6: ResolvedAddress = { address: "2606:2800:21f:cb07:6820:80da:af6b:8b2c", family: 6 };
  const privateV4: ResolvedAddress = { address: "10.0.0.5", family: 4 };

  it("succeeds for an IPv4-only answer", async () => {
    const result = await run([v4], { all: false });
    expect(result).toEqual({ err: null, address: v4.address, family: 4 });
  });

  it("returns exactly the resolved addresses with all: true", async () => {
    const result = await run([v4, v6], { all: true });
    expect(result.err).toBeNull();
    expect(result.address).toEqual([v4, v6]);
  });

  it("returns the first address without options", async () => {
    const result = await run([v6, v4], undefined);
    expect(result).toEqual({ err: null, address: v6.address, family: 6 });
  });

  it.each([true, false])("fails if any address is private (all: %s)", async (all) => {
    const result = await run([v4, privateV4], { all });
    expect(result.err).toBeInstanceOf(Error);
  });

  it("fails on a resolver error", async () => {
    const result = await run(new Error("ETIMEOUT"), { all: true });
    expect(result.err?.message).toBe("ETIMEOUT");
  });

  it("fails when nothing resolved", async () => {
    const result = await run([], { all: true });
    expect(result.err?.code).toBe("ENOTFOUND");
  });
});

describe("createResolver", () => {
  const dnsError = (code: string) => Object.assign(new Error(code), { code });

  it("treats ENODATA for AAAA as no IPv6 addresses (IPv4-only host)", async () => {
    const resolve = createResolver(
      async () => ["93.184.215.14"],
      async () => {
        throw dnsError("ENODATA");
      },
    );
    await expect(resolve("example.com")).resolves.toEqual([{ address: "93.184.215.14", family: 4 }]);
  });

  it("works for an IPv6-only host through the guarded lookup", async () => {
    const resolve = createResolver(
      async () => {
        throw dnsError("ENOTFOUND");
      },
      async () => ["2606:4700::1"],
    );
    const lookup = createGuardedLookup(resolve);
    const address = await new Promise((done) =>
      lookup("example.com", { all: true }, (_err, addresses) => done(addresses)),
    );
    expect(address).toEqual([{ address: "2606:4700::1", family: 6 }]);
  });

  it("fails on any other DNS error", async () => {
    const resolve = createResolver(
      async () => ["93.184.215.14"],
      async () => {
        throw dnsError("ETIMEOUT");
      },
    );
    await expect(resolve("example.com")).rejects.toThrow("ETIMEOUT");
  });
});
