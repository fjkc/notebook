import type { ChatMessage, SourceListItem } from "@repo/backend";
import type { ChatUIMessage } from "@/lib/chat";
import { Ask } from "./ask";
import { NotebookStateProvider } from "./notebook-state";
import { Reader } from "./reader";
import { Shelf } from "./shelf";

/**
 * The notebook screen below the top bar (DESIGN.md → "Layout", with the M6 cut: only the Reader on
 * the right). One component tree; only CSS breakpoints change the arrangement:
 * - desktop (≥ 1024 px): Shelf strip, then Ask ≈ 60 % and the Reader ≈ 40 %, split by a rule;
 * - tablet (640–1023 px): Shelf strip, Ask full width, the Reader as a sheet from the right, opened by a hook;
 * - mobile (< 640 px): "Sources (n)" opens the Shelf as a bottom sheet, Ask fills the screen, the
 *   Reader is a bottom sheet opened by a hook.
 * Shelf, Ask and Reader share the active citation and the source selection (NB-010 R2).
 */
type NotebookLayoutProps = {
  notebookId: string;
  sources: SourceListItem[] | null;
  /** Null when loading the conversation failed. */
  history: ChatMessage[] | null;
  suggestedQuestions: string[];
};

/** Stored messages as the chat's initial UI messages: one text part, citations as metadata. */
function toUIMessages(history: ChatMessage[]): ChatUIMessage[] {
  return history.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: message.content }],
    metadata: { citations: message.citations },
  }));
}

const NO_SOURCES: SourceListItem[] = [];

export function NotebookLayout({ notebookId, sources, history, suggestedQuestions }: NotebookLayoutProps) {
  // A failed source load (null) counts as no ready source, so the input stays disabled; the Shelf keeps polling.
  return (
    <NotebookStateProvider sources={sources ?? NO_SOURCES}>
      <div className="flex min-h-0 flex-1 flex-col">
        <Shelf notebookId={notebookId} sources={sources} />
        <div className="flex min-h-0 flex-1">
          <Ask
            notebookId={notebookId}
            initialMessages={toUIMessages(history ?? [])}
            historyFailed={history === null}
            suggestedQuestions={suggestedQuestions}
          />
          <Reader />
        </div>
      </div>
    </NotebookStateProvider>
  );
}
