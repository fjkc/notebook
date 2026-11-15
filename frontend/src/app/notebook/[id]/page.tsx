import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppError, getNotebook, listSources, type Notebook, type SourceListItem } from "@repo/backend";
import { NotebookLayout } from "@/components/notebook/notebook-layout";
import { NotebookMenu } from "@/components/notebook/notebook-menu";
import { TopBar } from "@/components/shell/top-bar";
import { APP_NAME } from "@/lib/config";
import { toLoggedErrorBody } from "@/lib/http";
import { getOwnerId } from "@/lib/owner";

/** The owner's notebook, or null for a malformed, unknown or foreign ID. Deduplicated per request. */
const loadNotebook = cache(async (id: string): Promise<Notebook | null> => {
  try {
    return await getNotebook(await getOwnerId(), id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps<"/notebook/[id]">): Promise<Metadata> {
  const notebook = await loadNotebook((await params).id);
  return { title: notebook ? `${notebook.title} · ${APP_NAME}` : APP_NAME };
}

// No loading.tsx and no <Suspense> around the lookup: streaming would start with status 200, and
// notFound() could no longer set the 404 (NB-006 R7). Slow parts added later get their own
// <Suspense> below the notFound() check.
export default async function NotebookPage({ params }: PageProps<"/notebook/[id]">) {
  const notebook = await loadNotebook((await params).id);
  if (!notebook) notFound();
  // Polled with router.refresh() while a source is processing (NB-007 R14). A failed source list
  // doesn't swap the notebook for the error page mid-poll: the Shelf shows it inline and keeps
  // polling. A failed notebook load (above) still shows the error page, with its "Try again".
  let sources: SourceListItem[] | null = null;
  try {
    sources = await listSources(await getOwnerId(), notebook.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound(); // deleted meanwhile
    toLoggedErrorBody(error, "notebookPage.listSources");
  }

  return (
    <div className="flex h-dvh flex-col">
      <TopBar title={notebook.title} actions={<NotebookMenu id={notebook.id} title={notebook.title} />} />
      <NotebookLayout notebookId={notebook.id} sources={sources} />
    </div>
  );
}
