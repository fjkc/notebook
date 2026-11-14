import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, hasValidSession } from "@repo/backend/access";
import { ERROR_CODES, isUuid, type ErrorBody } from "@repo/backend/shared";
import { OWNER_COOKIE, OWNER_COOKIE_MAX_AGE } from "@/lib/owner-cookie";

const LOGIN_PATH = "/login";

/**
 * Access gate first, then the owner cookie (docs/ARCHITECTURE.md → "Access gate", "Ownership").
 * The proxy is a first layer only: getOwnerId() checks the session again.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;

  if (!isLogin && !(await hasValidSession(request.cookies.get(ACCESS_COOKIE)?.value))) {
    if (pathname.startsWith("/api/")) return unauthorized();
    // Server Actions pass through: getOwnerId() rejects them with UNAUTHORIZED, which the UI shows.
    // A redirect would re-send the POST to /login, where the action doesn't exist.
    const isServerAction = request.method === "POST" && request.headers.has("next-action");
    if (!isServerAction) {
      if (request.method !== "GET" && request.method !== "HEAD") return unauthorized();
      const login = new URL(LOGIN_PATH, request.url);
      login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login, 307);
    }
  }

  return withOwnerCookie(request);
}

function unauthorized(): Response {
  const body: ErrorBody = { error: { code: "UNAUTHORIZED", message: ERROR_CODES.UNAUTHORIZED.message } };
  return Response.json(body, { status: ERROR_CODES.UNAUTHORIZED.status });
}

/**
 * Gives every visitor an anonymous owner_id. A missing or malformed cookie is replaced, and the
 * new value is also put on the forwarded request, so getOwnerId() sees it on the very first visit.
 */
function withOwnerCookie(request: NextRequest) {
  if (isUuid(request.cookies.get(OWNER_COOKIE)?.value)) return NextResponse.next();

  const ownerId = crypto.randomUUID();
  request.cookies.set(OWNER_COOKIE, ownerId);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(OWNER_COOKIE, ownerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_COOKIE_MAX_AGE,
  });
  return response;
}

export const config = {
  // Server Actions post to page routes, so they stay covered. The health cron needs no cookie.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
