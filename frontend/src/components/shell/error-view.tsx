"use client";

import { ERROR_CODES } from "@repo/backend/shared";
import { Button } from "@/components/ui/button";

/**
 * The body of the error pages (NB-006 R8): never error.message or a stack trace, only INTERNAL's
 * message and a way to try again.
 */
export function ErrorView({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:py-14">
      <h1 className="font-reading text-[1.75rem] leading-tight font-medium">Something went wrong</h1>
      <p className="mt-2 text-graphite">{ERROR_CODES.INTERNAL.message}</p>
      <Button type="button" onClick={() => retry()} className="mt-6">
        Try again
      </Button>
    </main>
  );
}
