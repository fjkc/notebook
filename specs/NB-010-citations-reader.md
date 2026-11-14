# NB-010 · Citation hooks, the Reader and chat controls

**Type:** feat   **Milestone:** M5   **Depends on:** NB-009

The second half of M5 (NB-009 explains the cut). It adds the product's one bold element (DESIGN.md principle 1): a citation hook that, when pressed, shows the passage it came from.

## Goal
Every citation in an answer is a hook. Pressing it opens the Reader with the source, the page and the cited passage highlighted, and marks that source on the Shelf. Users can also start from suggested questions, limit the chat to some sources, and clear the conversation. After this spec M5 is complete and `v1.0-mvp` can be tagged.

## Scope
- **In:**
  - Citation hooks in answers, the Reader content (desktop pane, tablet and mobile sheets), the Shelf highlight.
  - Suggested question chips (stored by NB-007) in the empty chat.
  - Including and excluding sources for the chat (client state, sent as `sourceIds`).
  - "Clear chat" (`clearChat` Server Action, ARCHITECTURE §10).
  - PROGRESS updates for M5 and the release tag after the production check.
- **Out:**
  - Scrolling to the passage inside the full source, or opening the PDF page: the Reader shows only what a `Citation` carries plus the source summary (DESIGN.md → "Layout").
  - Persisting the source selection (it resets on reload, ARCHITECTURE §7).
  - Copy, share or export of answers.

## Requirements
- **R1** **Hooks.** In answers, every citation segment from `parseCitations` (NB-009 R2) renders as a hook: a pill (the only pill in the UI, DESIGN.md → "Shape") with the number in Plex Sans tabular numerals, in `hook`, after the sentence. `[1][3]` renders two hooks side by side.
  - Each hook is a `<button>` with the accessible name "Passage n: <source title>, page p" (no page part when null), and a tooltip with the same text on hover and focus.
  - Hooks inside Markdown are produced by a `react-markdown` component override for text nodes, so headings, lists and tables keep their markers working; numbers inside code stay plain (as in NB-009's parser tests).
  - While an answer streams, hooks appear as their numbers arrive (the citation map comes on `start`).
- **R2** **Active citation state.** One client state for the notebook page: the active citation (`{ messageId, n }` → the `Citation`). Pressing a hook sets it; pressing the same hook again or "Close" clears it. A history message carries its citations from the database (NB-009 R7), so hooks in old answers work the same as new ones.
- **R3** **Reader** (`components/notebook/reader.tsx`, the NB-006 empty state stays when nothing is active):
  - Content: the source title (Plex Sans 500), "Page p" or the type ("Text", "Web page"), then the excerpt in Newsreader with the `marker` highlight behind the whole excerpt (DESIGN.md principle 1; `<mark>`), then a rule and "About this source" with the source summary from the Shelf's data (or "No summary yet." while processing).
  - Desktop (≥ 1024 px): in the right pane, replacing the empty state, with a "Close" button.
  - Tablet (640–1023 px): a sheet from the right, opened by the hook.
  - Mobile (< 640 px): a bottom sheet, opened by the hook.
  - Focus moves into the sheet when it opens and back to the hook when it closes (Radix). On desktop focus stays on the hook, and the pane is a labelled region ("Reader") with `aria-live="polite"` on its heading, so screen readers hear the change.
  - If the cited source was deleted after the answer, the Reader still shows the stored title and excerpt, with "This source was deleted." instead of the summary.
- **R4** **Shelf highlight.** The active citation's source chip gets the `marker` background and is scrolled into view in the strip (`scrollIntoView({ block: "nearest", inline: "nearest" })`, instant with reduced motion). On mobile the "Sources (n)" button shows nothing extra. Clearing the active citation removes the highlight.
- **R5** **Suggested questions.** When the chat is empty and at least one source is ready, the Ask empty state shows up to 5 questions from `notebooks.suggested_questions` as buttons (outline, 4 px radius, Plex Sans, wrapping). Pressing one sends it as the question. With no ready source they're hidden (the NB-006 copy stays). The list refreshes with the page (polling in NB-007), so it appears once the first source is ready.
- **R6** **Source selection.**
  - Each ready source gets a toggle "Use in answers" (on by default), a `<button aria-pressed>` in its source popover (NB-007), which on mobile is inside the Shelf sheet. Excluded chips are shown at reduced emphasis (`graphite` text, no dot fill) and say "not used in answers" in their accessible name.
  - The selection lives in client state for the notebook page and resets on reload. It's sent as `sourceIds` only when at least one ready source is excluded (else omitted, meaning "all ready sources", NB-009 R7).
  - If every ready source is excluded, the input is `aria-disabled` with "Pick at least one source to ask about."
  - A line above the input says "Answering from 2 of 3 sources" while some are excluded.
- **R7** **Clear chat.** A "Clear chat" button in the Ask header (ghost, shown only when there are messages) opens a confirmation dialog ("Clear this conversation?", "The questions and answers go away. Your sources stay.", "Clear chat" destructive, "Cancel"). The `clearChat({ notebookId })` Server Action (via `runAction`) calls a new `clearChat(ownerId, input)` service that deletes the notebook's messages, scoped by `owner_id`. On success the client calls `setMessages([])`, clears the active citation and shows the suggested questions again.
- **R8** **Quality floor:** hooks, toggles and the Reader work by keyboard with the focus ring; tooltips open on focus; hook contrast in both themes is the `hook` token's (8.1 / 8.7); no horizontal scroll at 360 px; light and dark; reduced motion stops the sheet and scroll animations.
- **R9** **Docs:**
  - `docs/ARCHITECTURE.md` §7 "Rendering": hooks use a `react-markdown` component override; the Reader's deleted-source case; the selection rule (R6).
  - `docs/PROGRESS.md`: no change in the implementing PR. After merge and the production check (M5 "Done when"), a short docs PR marks M5 done, and `v1.0-mvp` is tagged on that `main` commit (both on the user's request).

## Design

**Files**
- Backend: `services/chat.ts` (`clearChat`), `db/messages.ts` (`removeByNotebook`), `index.ts`.
- Frontend: `app/notebook/[id]/actions.ts` (`clearChat`), `components/notebook/{citation-hook,answer-markdown,reader,shelf,source-chip,source-popover,suggested-questions,ask,notebook-state}.tsx`. `notebook-state.tsx` is a small client context for the active citation and the source selection, shared by Shelf, Ask and Reader, placed in the notebook layout component; the page stays a Server Component.
- No schema change.

**Rejected alternatives**
- **A popover on the hook** (ARCHITECTURE's first draft): replaced by the Reader in NB-005 (DESIGN.md → "Layout").
- **Highlighting the passage inside the full source text:** needs a source viewer (and a PDF renderer) that the spec scope and the weekend don't have; the 400-character excerpt is the cited passage.
- **Storing the source selection per notebook in the database:** a schema change for a preference that rarely matters across sessions.

**Dependencies.** None new.

**Size.** About 450–550 changed lines (hooks and Markdown override ~120, Reader ~120, state and Shelf highlight ~80, selection ~100, suggested questions ~40, clear chat ~60).

## Implementation

- [ ] **Implemented** (`feat/NB-010-citations-reader`)
  - No user steps before merge. After merge: the production check below; then, on request, a docs PR for PROGRESS and the `v1.0-mvp` tag.
  - Acceptance:
    - CI passes.
    - On the preview, logged in, in a notebook with the three fixture sources ready:
      - Answers show plum hooks; pressing one opens the Reader with the title, page (for the PDF) and the highlighted excerpt, and the source's chip on the Shelf is highlighted and scrolled into view. Pressing it again closes it.
      - The excerpt matches the passage the sentence relies on, for three different questions (listed in the PR).
      - Hooks in answers loaded from history (after a reload) work the same.
      - Deleting a cited source, then pressing its hook, shows the excerpt and "This source was deleted."
      - The empty chat shows 3–5 suggested questions; pressing one sends it.
      - Excluding the PDF and asking about it gives a "not in your sources" style answer; "Answering from 2 of 3 sources" shows; excluding all disables the input with the R6 message.
      - "Clear chat" asks, then empties the conversation; after a reload it stays empty and the suggested questions are back.
      - At 1280 px the Reader is the right pane; at 800 px a right sheet; at 360 px a bottom sheet, with focus returning to the hook on close. Light and dark.
      - Keyboard only: tab to a hook, Enter opens the Reader, Escape closes the sheet.
    - Docs updated as in R9.
    - **After merge, on production (M5 "Done when"):** answers cite the right passages, a citation shows source, page and excerpt, an unanswerable question gets an honest "not in your sources" reply, and a German question gets a German answer.

## Open questions
None.

## Notes
Deviations found during implementation, one line each.
