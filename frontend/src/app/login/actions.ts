"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  createSessionToken,
  getAccessEnv,
  parsePasswordInput,
  passwordFingerprint,
  passwordMatches,
  safeNextPath,
} from "@repo/backend/access";
import { ACCESS_SESSION_MAX_AGE_SECONDS, FAILED_LOGIN_DELAY_MS } from "@repo/backend/shared";

export type LoginState = { error: string | null };

/**
 * The only Server Action that doesn't call getOwnerId(): it runs without a session by design
 * (docs/ARCHITECTURE.md → "Access gate").
 */
export async function logIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const env = getAccessEnv();
  if (!env) return { error: "Login isn't set up yet." };

  const password = parsePasswordInput(formData.get("password"));
  if (password === null) return { error: "Enter the password." };

  if (!passwordMatches(password, env.APP_PASSWORD)) {
    // Slows sequential guessing; the password's entropy is the real protection.
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return { error: "That password isn't right." };
  }

  const token = await createSessionToken(env.SESSION_SECRET, await passwordFingerprint(env.APP_PASSWORD), Date.now());
  (await cookies()).set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNextPath(formData.get("next")));
}
