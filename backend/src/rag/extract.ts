import type { PageText } from "./chunk";

// One extractor per source type (docs/ARCHITECTURE.md §6 step 3). NB-008 adds url and pdf.

/** Pasted text: one page without a page number. */
export function extractText(inputText: string): PageText[] {
  return [{ page: null, text: inputText }];
}
