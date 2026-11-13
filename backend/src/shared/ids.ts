// Client-safe ID checks. The proxy uses this too, so it must stay dependency-free (no server-only).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True for an RFC 9562 UUID (versions 1–8), the format of owner_id and every table id. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
