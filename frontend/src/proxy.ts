import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@repo/backend/shared";
import { OWNER_COOKIE, OWNER_COOKIE_MAX_AGE } from "@/lib/owner-cookie";

/**
 * Gives every visitor an anonymous owner_id (docs/ARCHITECTURE.md → "Ownership").
 * A missing or malformed cookie is replaced, and the new value is also put on the forwarded
 * request, so getOwnerId() sees it on the very first visit.
 */
export function proxy(request: NextRequest) {
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
