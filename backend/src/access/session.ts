import { ACCESS_SESSION_MAX_AGE_SECONDS } from "../shared/limits";

// Signed session tokens for the access gate. Pure: no env reads, the caller passes secret and time.
// Format: v1.<expiresAt>.<signature>, signature = HMAC-SHA256(secret, "v1.<expiresAt>.<fingerprint>").
// Units: expiresAt in Unix seconds, `now` in milliseconds; bytes are base64url without padding.

const VERSION = "v1";
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const DIGITS = /^[0-9]{1,12}$/;
const SIGNATURE_BYTES = 32;
const encoder = new TextEncoder();

function toBase64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function signedPayload(expiresAt: number, fingerprint: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${VERSION}.${expiresAt}.${fingerprint}`);
}

/** base64url SHA-256 of the password. Signed into every token, so a new password logs everyone out. */
export async function passwordFingerprint(password: string): Promise<string> {
  return toBase64url(await crypto.subtle.digest("SHA-256", encoder.encode(password)));
}

/** A token that expires ACCESS_SESSION_MAX_AGE_SECONDS after `now` (ms). */
export async function createSessionToken(secret: string, fingerprint: string, now: number): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + ACCESS_SESSION_MAX_AGE_SECONDS;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), signedPayload(expiresAt, fingerprint));
  return `${VERSION}.${expiresAt}.${toBase64url(signature)}`;
}

/**
 * True only for a v1 token with a valid signature that hasn't expired. The signature check is
 * crypto.subtle.verify, which compares in constant time. Anything malformed gives false; never throws.
 */
export async function verifySessionToken(
  token: unknown,
  secret: string,
  fingerprint: string,
  now: number,
): Promise<boolean> {
  try {
    if (typeof token !== "string") return false;
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [version, expires, signature] = parts as [string, string, string];
    if (version !== VERSION || !DIGITS.test(expires) || !BASE64URL.test(signature)) return false;
    const expiresAt = Number(expires);
    if (expiresAt <= Math.floor(now / 1000)) return false;
    // Buffer's decoder is lenient; require the canonical encoding of exactly 32 bytes.
    const bytes = Buffer.from(signature, "base64url");
    if (bytes.length !== SIGNATURE_BYTES || bytes.toString("base64url") !== signature) return false;
    return await crypto.subtle.verify("HMAC", await hmacKey(secret), bytes, signedPayload(expiresAt, fingerprint));
  } catch {
    return false;
  }
}
