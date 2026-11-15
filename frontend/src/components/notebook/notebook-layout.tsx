import type { SourceListItem } from "@repo/backend";
import { Ask } from "./ask";
import { Reader } from "./reader";
import { Shelf } from "./shelf";

/**
 * The notebook screen below the top bar (DESIGN.md → "Layout", with the M6 cut: only the Reader on
 * the right). One component tree; only CSS breakpoints change the arrangement:
 * - desktop (≥ 1024 px): Shelf strip, then Ask ≈ 60 % and the Reader ≈ 40 %, split by a rule;
 * - tablet (640–1023 px): Shelf strip, Ask full width, the Reader as a sheet from Ask's header;
 * - mobile (< 640 px): "Sources (n)" opens the Shelf as a bottom sheet, Ask fills the screen.
 */
export function NotebookLayout({ notebookId, sources }: { notebookId: string; sources: SourceListItem[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Shelf notebookId={notebookId} sources={sources} />
      <div className="flex min-h-0 flex-1">
        <Ask />
        <Reader />
      </div>
    </div>
  );
}
