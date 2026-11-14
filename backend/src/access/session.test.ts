import { describe, expect, it } from "vitest";
import { ACCESS_SESSION_MAX_AGE_SECONDS } from "../shared/limits";
import { createSessionToken, passwordFingerprint, verifySessionToken } from "./session";

const SECRET = "s".repeat(32);
const NOW = 1_800_000_000_000; // ms

async function setup(password = "correct horse battery staple") {
  const fingerprint = await passwordFingerprint(password);
  const token = await createSessionToken(SECRET, fingerprint, NOW);
  return { fingerprint, token };
}

describe("session tokens", () => {
  it("round trip: a fresh token verifies", async () => {
    const { fingerprint, token } = await setup();
    expect(token).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(await verifySessionToken(token, SECRET, fingerprint, NOW)).toBe(true);
  });

  it("expires after the session lifetime", async () => {
    const { fingerprint, token } = await setup();
    const expiry = NOW + ACCESS_SESSION_MAX_AGE_SECONDS * 1000;
    expect(await verifySessionToken(token, SECRET, fingerprint, expiry - 1000)).toBe(true);
    expect(await verifySessionToken(token, SECRET, fingerprint, expiry)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const { fingerprint, token } = await setup();
    const last = token.at(-2) === "A" ? "B" : "A";
    const tampered = token.slice(0, -2) + last + token.at(-1);
    expect(await verifySessionToken(tampered, SECRET, fingerprint, NOW)).toBe(false);
  });

  it("rejects a tampered expiry", async () => {
    const { fingerprint, token } = await setup();
    const [, expires, signature] = token.split(".");
    const later = `v1.${Number(expires) + 1000}.${signature}`;
    expect(await verifySessionToken(later, SECRET, fingerprint, NOW)).toBe(false);
  });

  it("rejects a token signed with another secret", async () => {
    const { fingerprint, token } = await setup();
    expect(await verifySessionToken(token, "t".repeat(32), fingerprint, NOW)).toBe(false);
  });

  it("rejects a wrong version", async () => {
    const { fingerprint, token } = await setup();
    expect(await verifySessionToken(token.replace(/^v1\./, "v2."), SECRET, fingerprint, NOW)).toBe(false);
  });

  it("rejects a token signed before a password change", async () => {
    const { token } = await setup("old password, old password, old");
    const newFingerprint = await passwordFingerprint("new password, new password, new");
    expect(await verifySessionToken(token, SECRET, newFingerprint, NOW)).toBe(false);
  });

  it.each([
    undefined,
    null,
    42,
    "",
    "v1",
    "v1..",
    "v1.abc.def",
    "v1.123",
    "v1.123.sig.extra",
    "v1.-5.AAAA",
    "v1.99999999999999999999.AAAA",
    "v1.1900000000.not base64!",
    "v1.1900000000.AAAA",
    `v1.1900000000.${"A".repeat(43)}=`,
  ])("rejects malformed input %j without throwing", async (input) => {
    const { fingerprint } = await setup();
    await expect(verifySessionToken(input, SECRET, fingerprint, NOW)).resolves.toBe(false);
  });
});
