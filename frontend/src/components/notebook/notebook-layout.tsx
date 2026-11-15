import type { ChatMessage, SourceListItem } from "@repo/backend";
import type { ChatUIMessage } from "@/lib/chat";
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
type NotebookLayoutProps = { notebookId: string; sources: SourceListItem[] | null; history: ChatMessage[] };

/** Stored messages as the chat's initial UI messages: one text part, citations as metadata. */
function toUIMessages(history: ChatMessage[]): ChatUIMessage[] {
  return history.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
    metadata: { citations: message.citations },
  }));
}

export function NotebookLayout({ notebookId, sources, history }: NotebookLayoutProps) {
  // A failed source load (null) keeps the input disabled; the Shelf keeps polling.
  const hasReadySource = (sources ?? []).some((source) => source.status === "ready");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Shelf notebookId={notebookId} sources={sources} />
      <div className="flex min-h-0 flex-1">
        <Ask notebookId={notebookId} initialMessages={toUIMessages(history)} hasReadySource={hasReadySource} />
        <Reader />
      </div>
    </div>
  );
}
