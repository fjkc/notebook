"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { SourceListItem } from "@repo/backend";
import type { Citation } from "@repo/backend/shared";

/** The hook last pressed: the answer it's in and its citation (NB-010 R2). */
export type ActiveCitation = { messageId: string; citation: Citation };

type NotebookState = {
  /** The notebook's sources as the page loaded them (empty after a failed load). */
  sources: SourceListItem[];
  active: ActiveCitation | null;
  /** Pressing a hook sets it; pressing the active hook again clears it. */
  toggleCitation: (messageId: string, citation: Citation, hook: HTMLElement) => void;
  clearCitation: () => void;
  /** The hook element pressed last, so a closing Reader sheet can return focus to it. */
  lastHook: React.RefObject<HTMLElement | null>;
  /** Ready sources left out of answers (R7); empty on load, so a newly ready source is included. */
  excluded: ReadonlySet<string>;
  toggleExcluded: (sourceId: string) => void;
};

const NotebookStateContext = createContext<NotebookState | null>(null);

/**
 * Client state shared by the Shelf, Ask and the Reader (NB-010 R2). Provided by the notebook layout;
 * the page stays a Server Component and passes the sources in. Nothing here is persisted.
 */
export function NotebookStateProvider({ sources, children }: { sources: SourceListItem[]; children: ReactNode }) {
  const [active, setActive] = useState<ActiveCitation | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const lastHook = useRef<HTMLElement | null>(null);

  const toggleCitation = useCallback((messageId: string, citation: Citation, hook: HTMLElement) => {
    lastHook.current = hook;
    setActive((current) =>
      current?.messageId === messageId && current.citation.n === citation.n ? null : { messageId, citation },
    );
  }, []);
  const clearCitation = useCallback(() => setActive(null), []);
  const toggleExcluded = useCallback((sourceId: string) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (!next.delete(sourceId)) next.add(sourceId);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ sources, active, toggleCitation, clearCitation, lastHook, excluded, toggleExcluded }),
    [sources, active, toggleCitation, clearCitation, excluded, toggleExcluded],
  );
  return <NotebookStateContext.Provider value={value}>{children}</NotebookStateContext.Provider>;
}

export function useNotebookState(): NotebookState {
  const state = useContext(NotebookStateContext);
  if (!state) throw new Error("useNotebookState needs a NotebookStateProvider");
  return state;
}

/**
 * The chat's source selection (R7): ready sources minus the excluded ones. `sourceIds` is set only
 * when at least one ready source is excluded; otherwise the request means "all ready sources".
 */
export function useSourceSelection() {
  const { sources, excluded } = useNotebookState();
  return useMemo(() => {
    const ready = sources.filter((source) => source.status === "ready");
    const included = ready.filter((source) => !excluded.has(source.id));
    return {
      readyCount: ready.length,
      includedCount: included.length,
      sourceIds: included.length < ready.length ? included.map((source) => source.id) : undefined,
    };
  }, [sources, excluded]);
}

/** The hook's accessible name and tooltip: "Passage 2: Climate report, page 4" (no page part when null). */
export function passageLabel(citation: Citation): string {
  const page = citation.page === null ? "" : `, page ${citation.page}`;
  return `Passage ${citation.n}: ${citation.sourceTitle}${page}`;
}
