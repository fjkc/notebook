// Shared by proxy.ts and owner.ts. No server-only imports: the proxy can't load @repo/backend.

export const OWNER_COOKIE = "owner_id";

/** One year, in seconds. */
export const OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
