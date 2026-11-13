import { cookies } from "next/headers";
import { AppError, isUuid } from "@repo/backend";
import { OWNER_COOKIE } from "./owner-cookie";

/**
 * The only place that decides who the owner is (docs/ARCHITECTURE.md → "Ownership").
 * The proxy sets the cookie, also on the forwarded request, so this works on the first visit.
 */
export async function getOwnerId(): Promise<string> {
  const value = (await cookies()).get(OWNER_COOKIE)?.value;
  if (!isUuid(value)) throw new AppError("UNAUTHORIZED");
  return value;
}
