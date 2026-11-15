import { listNotebooks } from "@repo/backend";
import { NewNotebookButton } from "@/components/home/new-notebook-button";
import { NotebookRow } from "@/components/home/notebook-row";
import { getOwnerId } from "@/lib/owner";

/** "12 Nov", or "12 Nov 2025" outside the current year. UTC, so the server render is stable. */
function formatEdited(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Home (DESIGN.md → "Layout", home): the owner's notebooks, newest first, or the empty state.
export default async function Home() {
  const notebooks = await listNotebooks(await getOwnerId());

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[1.75rem] leading-tight font-semibold">Your notebooks</h1>
        <NewNotebookButton />
      </div>

      {notebooks.length === 0 ? (
        <section className="mt-10 border-t border-rule pt-10">
          <h2 className="font-reading text-[1.375rem] leading-snug font-medium">No notebooks yet</h2>
          <p className="mt-2 text-graphite">A notebook holds your sources and the questions you ask about them.</p>
        </section>
      ) : (
        <ul className="mt-10 border-t border-rule">
          {notebooks.map((notebook) => (
            <NotebookRow
              key={notebook.id}
              href={`/notebook/${notebook.id}`}
              title={notebook.title}
              sourceCount={notebook.sourceCount}
              edited={formatEdited(notebook.updatedAt)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
