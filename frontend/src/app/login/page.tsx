import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, getAccessEnv, hasValidSession, safeNextPath } from "@repo/backend/access";
import { Wordmark } from "@/components/shell/wordmark";
import { LoginForm } from "./login-form";

// Per request, so the "set up" check reflects the running deployment's env, not the build's.
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);

  if (await hasValidSession((await cookies()).get(ACCESS_COOKIE)?.value)) redirect(next);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[360px] flex-col gap-6">
        <h1>
          <Wordmark />
        </h1>
        {getAccessEnv() ? (
          <>
            <p className="text-graphite">This demo is private. Enter the password you were sent.</p>
            <LoginForm next={next} />
          </>
        ) : (
          <p className="text-graphite">Login isn&apos;t set up yet.</p>
        )}
      </div>
    </main>
  );
}
