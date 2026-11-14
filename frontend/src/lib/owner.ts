import { cookies } from "next/headers";
import { AppError, isUuid } from "@repo/backend";
import { ACCESS_COOKIE, hasValidSession } from "@repo/backend/access";
import { OWNER_COOKIE } from "./owner-cookie";

/**
 * The only place that decides who the owner is (docs/ARCHITECTURE.md → "Ownership").
 * Also the second layer of the access gate: without a valid session it throws UNAUTHORIZED,
 * even if the proxy matcher missed the path. The proxy sets the owner cookie, also on the
 * forwarded request, so this works on the first visit.
 */
export async function getOwnerId(): Promise<string> {
  const store = await cookies();
  if (!(await hasValidSession(store.get(ACCESS_COOKIE)?.value))) throw new AppError("UNAUTHORIZED");
  const value = store.get(OWNER_COOKIE)?.value;
  if (!isUuid(value)) throw new AppError("UNAUTHORIZED");
  return value;
}
