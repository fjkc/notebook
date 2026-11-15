"use client"; // Error boundaries must be Client Components.

import { ErrorView } from "@/components/shell/error-view";
import { TopBar } from "@/components/shell/top-bar";

// The notebook route renders its own top bar, so the error page does too, without a title.
// `error` is never shown (CLAUDE.md rule 4).
export default function NotebookError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <TopBar />
      <ErrorView retry={retry} />
    </>
  );
}
