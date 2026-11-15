"use client"; // Error boundaries must be Client Components.

import { ErrorView } from "@/components/shell/error-view";

// The (app) layout keeps rendering the top bar above this. `error` is never shown (CLAUDE.md rule 4).
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorView retry={retry} />;
}
