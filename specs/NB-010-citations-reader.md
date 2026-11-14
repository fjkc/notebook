# NB-010 · Citation hooks, the Reader and chat controls

**Type:** feat   **Milestone:** M5   **Depends on:** NB-009

The second half of M5 (NB-009 explains the cut). It adds the product's one bold element (DESIGN.md principle 1): a citation hook that, when pressed, shows the passage it came from. It also takes over the notebook's suggested questions (ARCHITECTURE §6 step 8), which NB-007 left out to stay under the size limit.

## Goal
Every citation in an answer is a hook. Pressing it opens the Reader with the source, the page and the cited passage highlighted, and marks that source on the Shelf. Users can also start from suggested questions, limit the chat to some sources, and clear the conversation. After this spec M5 is complete and `v1.0-mvp` can be tagged.

## Scope
- **In:**
  - Citation hooks in answers, the Reader content (desktop pane, tablet and mobile sheets), the Shelf highlight.
  - Suggested questions: generated when a source becomes ready or is deleted, shown as chips in the empty chat.
  - Including and excluding sources for the chat (client state, sent as `sourceIds`).
  - "Clear chat" (`clearChat` Server Action, ARCHITECTURE §10).
  - The release step for M5 (R10).
- **Out:**
  - Scrolling to the passage inside the full source, or opening the PDF page: the Reader shows the cited excerpt plus the source's summary.
  - Persisting the source selection (it resets on reload, ARCHITECTURE §7).
  - Copy, share or export of answers.

## Requirements

### Hooks and the Reader
- **R1** **Hooks.** The `cite` nodes from NB-009's `remarkCitations` plugin render as hooks instead of superscripts (one `components` entry changes; the plugin stays). `[1][3]` renders two hooks side by side. Because the plugin works on Markdown text nodes, hooks work inside paragraphs, lists, headings and tables, and numbers inside code stay plain.
  - **Look:** a pill (the only pill in the UI, DESIGN.md → "Shape"), 1 px `hook` border, the number in `hook` on `paper` in Plex Sans tabular numerals. The active hook is filled: `hook` background, `paper` text. Hover changes colour only (DESIGN.md → "Motion").
  - **Semantics:** a `<button>` with the accessible name "Passage n: <source title>, page p" (no page part when `page` is null), `aria-pressed` true on the active hook, and a tooltip with the same text on hover and focus.
  - While an answer streams, hooks appear as their numbers arrive (the citation map comes on `start`).
- **R2** **Notebook state.** A small client context `notebook-state.tsx`, provided by the notebook layout component, shared by Shelf, Ask and Reader. The page stays a Server Component and passes the sources list in. It holds:
  - the **active citation** (`{ messageId, n }` → its `Citation`);
  - the **excluded source IDs** (R6).
  - Pressing a hook sets the active citation; pressing the active hook again, the Reader's "Close" button, or closing a Reader sheet in any way (Escape, the scrim, swiping) clears it.
  - A history message carries its citations from the database (NB-009 R7), so hooks in old answers work the same as new ones.
- **R3** **Reader** (`components/notebook/reader.tsx`). It uses the `Citation` plus the source's `type` and `summary` from the notebook's sources list (passed in through R2's provider); no new API.
  - **Content:** the source title (Plex Sans 500); then "Page p" when `page` is set, otherwise the type ("Text", "Web page"); then the excerpt in Newsreader inside `<mark>` with the `marker` background (DESIGN.md principle 1); then a rule and "About this source" with the summary, or "The summary appears when processing is done." (NB-007's wording) when there's none yet.
  - **Deleted source:** if the cited `sourceId` is no longer in the sources list, the Reader shows the stored title, page (if any) and excerpt, leaves out the type line, and shows "This source was deleted." instead of the summary.
  - **Desktop (≥ 1024 px):** in the right pane, replacing the NB-006 empty state, with a "Close" button. The pane is a labelled region ("Reader") and contains an always-rendered, visually hidden status line with `aria-live="polite"`, whose text changes to "Showing passage n from <title>" when a hook is pressed. Focus stays on the hook.
  - **Tablet (640–1023 px):** a sheet from the right, opened by a hook. NB-006's "Reader" button in the Ask header is removed: the sheet opens only from hooks, so it never shows an empty state.
  - **Mobile (< 640 px):** a bottom sheet, opened by a hook.
  - In sheets, focus moves into the sheet when it opens and back to the hook when it closes (Radix).
- **R4** **Shelf highlight.** The active citation's source chip gets the `marker` background and is scrolled into view in the strip (`scrollIntoView({ block: "nearest", inline: "nearest" })`, instant with reduced motion). On mobile the "Sources (n)" button shows nothing extra. Clearing the active citation removes the highlight.

### Suggested questions
- **R5** **Generating** (backend, ARCHITECTURE §6 step 8):
  - `suggestedQuestionsPrompt(summaries)` in `ai/prompts.ts`, from ARCHITECTURE §12, with the summaries inside `<summaries>…</summaries>` marked as data whose instructions are ignored. Called with `generateText` and `output: Output.object({ schema: z.object({ questions: z.array(z.string()) }) })` (the AI SDK's current structured-output API; check the installed version), `maxRetries: 2`.
  - The result is cleaned, not rejected: items trimmed, empty ones and ones over 120 characters dropped, the first 5 kept. 1–5 questions are stored; 0 after cleaning keeps the old ones.
  - `refreshSuggestedQuestions(ownerId, notebookId)` in `services/notebooks.ts`: loads the summaries of all ready sources (owner-scoped); none → stores `[]` without a Gemini call; otherwise generates and stores with `db/notebooks.setSuggestedQuestions(ownerId, id, questions)`.
  - Called at the end of `processSource` after `markReady`, **before** the process route responds, and at the end of `deleteSource`. A failure is logged and swallowed: it never fails the source or the delete.
  - Because NB-007's client refreshes the page when the process call settles, the chips appear without a reload.
  - **Test:** the cleaning rules (empty, too long, more than 5, all invalid).
- **R6** **Showing.** When the chat is empty and at least one source is ready, the ready-but-empty Ask state (NB-009 R12) shows up to 5 questions from `notebooks.suggested_questions` under its copy, as outline buttons (4 px radius, Plex Sans, wrapping). Pressing one sends it through the same path as the input, with the same `sourceIds` rule (R7). With no ready source they're hidden. While every ready source is excluded they're `aria-disabled` with the R7 message.

### Source selection and clearing
- **R7** **Source selection.**
  - State: the set of **excluded** source IDs (R2), empty on load. A source that becomes ready later is therefore included by default.
  - Each ready source gets a toggle "Use in answers" (on by default): a `<button aria-pressed>` in its source popover (NB-007), which on mobile is inside the Shelf sheet. Excluded chips are shown with `graphite` text and an unfilled dot, and their accessible name ends with ", not used in answers".
  - The request sends `sourceIds` = ready sources minus excluded ones, but only when at least one ready source is excluded; otherwise it's omitted ("all ready sources", NB-009 R7).
  - A line above the input says "Answering from n of m sources" while some are excluded (m = ready sources).
  - If every ready source is excluded, the input is `aria-disabled` and `readOnly` with "Pick at least one source to ask about.", and the suggested questions are disabled the same way.
- **R8** **Clear chat.**
  - A "Clear chat" button (ghost) in the Ask header, shown only when there are messages and hidden while an answer is `submitted` or `streaming` (so an answer can't be saved after the clear).
  - It opens a confirmation dialog: "Clear this conversation?", "The questions and answers go away. Your sources stay.", "Clear chat" (destructive) and "Cancel". While pending: "Clearing…", buttons disabled, the dialog can't be closed.
  - Server Action `clearChat({ notebookId })` via `runAction` → `clearChat(ownerId, input)` in `services/chat.ts`: zod (`notebookId` a UUID), `assertNotebookOwner` (foreign → `NOT_FOUND`), then `db/messages.removeByNotebook(ownerId, notebookId)`, owner-scoped.
  - On success the client calls `setMessages([])`, clears the active citation, closes the dialog, and the suggested questions show again. On failure the dialog stays open and a toast shows the action's message.
  - **Known limitation:** clearing deletes the rows the per-minute chat throttle counts (NB-009 R7), so it resets the throttle. Accepted: the app is behind the password gate, and Gemini's own 429 still caps use. Recorded in PROGRESS "Known limitations".
- **R9** **Quality floor:** hooks, toggles, suggested questions and the Reader work by keyboard with the focus ring; tooltips open on focus; hook contrast is the `hook` token's (8.1 / 8.7); no horizontal scroll at 360 px; light and dark; reduced motion turns off the sheet animations and makes the chip scroll instant.

### Docs and release
- **R10** **Docs:**
  - `docs/ARCHITECTURE.md` §6 step 8: suggested questions are refreshed after ready and after delete, before the process route responds. §7 "Rendering": hooks come from the remark plugin's `cite` nodes; the Reader uses `Citation` plus the source's type and summary from the notebook's sources list (correcting "only the data in `Citation`"); the deleted-source case; the selection rule (R7). §12: the suggested-questions prompt uses `<summaries>` delimiters.
  - `docs/DESIGN.md` → "Layout": the tablet "Reader" button is gone; the Reader opens from hooks.
  - `docs/PROGRESS.md` "Known limitations": the clear-chat throttle reset (R8). M5 itself isn't marked done in the implementing PR.
  - **Release, after merge and the production check** (M5 "Done when"), on the user's request: a docs PR marks M5 done in PROGRESS; after it merges, Claude tags that `main` commit with `git tag -a v1.0-mvp -m "M5: grounded chat with citations"` and pushes the tag (`git push origin v1.0-mvp`).

## Design

**Files**
- Backend: `ai/prompts.ts` (+ test), `services/{notebooks,sources,chat}.ts`, `db/{notebooks,messages}.ts`, `index.ts`.
- Frontend: `app/notebook/[id]/actions.ts` (`clearChat`), `components/notebook/{notebook-state,citation-hook,answer-markdown,reader,shelf,source-chip,source-popover,suggested-questions,ask,notebook-layout}.tsx`.
- No schema change (`notebooks.suggested_questions` exists).

**Rejected alternatives**
- **A popover on the hook** (ARCHITECTURE's first draft): replaced by the Reader in NB-005 (DESIGN.md → "Layout").
- **Highlighting the passage inside the full source text:** needs a source viewer (and a PDF renderer) that the scope and the weekend don't have; the 400-character excerpt is the cited passage.
- **Storing included instead of excluded IDs:** a source that becomes ready later would silently be left out.
- **Storing the source selection per notebook in the database:** a schema change for a preference that rarely matters across sessions.
- **Keeping a tablet "Reader" button:** with closing clearing the active citation, it could only ever open an empty sheet.
- **A separate throttle table so clearing can't reset it:** a schema change for a limit that only protects quota behind the password gate.

**Dependencies.** None new.

**Size.** About 600–700 changed lines (hook component and state ~150, Reader ~130, Shelf highlight and selection ~120, suggested questions backend with test and chips ~130, clear chat ~70).

## Implementation

- [ ] **Implemented** (`feat/NB-010-citations-reader`)
  - No user steps before merge. After merge: the production check below; then, on request, the release step in R10.
  - Acceptance:
    - CI passes, including the R5 cleaning test.
    - On the preview, logged in, in a notebook with three ready sources: `fixtures/sample-text.txt` pasted, the fixture PDF, and the article URL used in NB-008's acceptance:
      - **Suggested questions:** in a new notebook, adding the first source makes 3–5 suggested questions appear in the empty chat when it turns ready, **without a reload**; pressing one sends it. Deleting all sources hides them.
      - **Hooks:** answers show plum hooks; pressing one opens the Reader with the title, page (for the PDF) and the highlighted excerpt, the hook turns filled, and the source's chip on the Shelf is highlighted and scrolled into view. Pressing it again closes the Reader and removes both highlights.
      - The excerpt matches the passage the sentence relies on, for three different questions (listed in the PR).
      - Asking for a bulleted list gives hooks inside the list items; `[1]` inside inline code stays text.
      - Hooks in answers loaded from history (after a reload) work the same.
      - Deleting a cited source, then pressing its hook, shows the excerpt without a type line and "This source was deleted."
      - **Accessibility:** the accessibility tree (DevTools) shows a hook as "Passage 1: <title>, page 4" with `aria-pressed`; its tooltip opens on keyboard focus; on desktop the hidden status line changes to "Showing passage 1 from <title>".
      - **Selection:** after "Clear chat", excluding the PDF (Space on its "Use in answers" toggle flips `aria-pressed`; the chip's name ends with ", not used in answers") and asking about the PDF's content gives a "not in your sources" style answer; "Answering from 2 of 3 sources" shows; excluding all disables the input and the suggested questions with the R7 message.
      - **Clear chat:** the button is hidden while an answer streams; "Cancel" keeps the messages; "Clear chat" empties the conversation, and after a reload it stays empty and the suggested questions are back.
      - **Layouts:** at 1280 px the Reader is the right pane; at 800 px a right sheet (no "Reader" button in the Ask header); at 360 px a bottom sheet. Closing a sheet with Escape returns focus to the hook and clears the chip highlight. Light and dark.
      - With OS reduced motion on, the sheets open without animation and the Shelf jumps instead of scrolling.
      - Keyboard only: tab to a hook, Enter opens the Reader, Escape closes the sheet.
    - Docs updated as in R10.
    - **After merge, on production (M5 "Done when"):** answers cite the right passages, a citation shows source, page and excerpt, an unanswerable question gets an honest "not in your sources" reply, and a German question gets a German answer.

## Open questions
None.

## Notes
Deviations found during implementation, one line each.
