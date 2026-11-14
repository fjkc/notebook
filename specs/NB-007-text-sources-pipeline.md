# NB-007 · Text sources and the ingestion pipeline

**Type:** feat   **Milestone:** M4   **Depends on:** NB-006

M4 is cut into two specs, because one PR would be well over the ~800-line limit (`WORKFLOW.md` §1): **NB-007** builds the whole pipeline (claim → extract → chunk → embed → summarise → ready → suggested questions) and the Shelf, with pasted text as the first source type. **NB-008** adds web pages and PDFs on top of it.

## Goal
Users can paste text into a notebook and watch it go from "processing" to "ready" on the Shelf, with a summary, while the notebook gets suggested questions. Failed sources show a clear message and can be retried, and sources can be deleted. Chat (NB-009) can then search the stored chunks.

## Scope
- **In:**
  - Chunker (`rag/chunk.ts`) with tests, embeddings (`rag/embed.ts`), the source summary and suggested-questions prompts (`ai/prompts.ts`), Gemini error mapping.
  - `createTextSource` and `deleteSource` Server Actions, `POST /api/sources/[id]/process`.
  - Limits: 10 sources per notebook, 20 new sources per owner per hour, 200,000 pasted characters.
  - Stuck sources (more than 5 minutes in `pending` or `processing`) shown as failed and retryable.
  - The Shelf: source chips with status, polling, a source popover (summary, error, retry, delete), the "Add source" dialog with the "Paste text" tab, and the mobile "Sources (n)" sheet.
  - `fixtures/` with a short sample text.
- **Out:**
  - Web page and PDF sources, the URL guard, storage cleanup: NB-008. Their tabs aren't in the dialog yet.
  - Showing suggested questions in Ask: NB-010 (this spec only generates and stores them).
  - A job queue or background processing (ARCHITECTURE §2: the client triggers processing).

## Requirements

### Backend
- **R1** **Dependencies:** `ai` and `@ai-sdk/google` in `backend/` (approved in CLAUDE.md). Gemini is created lazily in a `server-only` module `backend/src/ai/gemini.ts` that reads `GOOGLE_GENERATIVE_AI_API_KEY` through `env.ts`. Every AI call sets `maxRetries: 2` (ARCHITECTURE §11).
- **R2** **Gemini errors.** `toAiError(error)` in `ai/errors.ts`: an AI SDK `APICallError` with status 429 (or a `RetryError` whose last error is one) becomes `AppError("RATE_LIMITED", { cause })`; anything else becomes a plain `Error` with the cause (→ `INTERNAL`). Unit-tested with constructed errors.
- **R3** **Chunker** `rag/chunk.ts`, pure, as ARCHITECTURE §6 step 4: input `{ page: number | null; text: string }[]`, output `{ chunkIndex; page; content }[]`.
  - Each page separately: chunks never cross pages.
  - Whitespace normalised (runs of spaces and tabs → one space, three or more newlines → two). Empty pages are skipped.
  - Split into paragraphs (blank line), a paragraph over the target into sentences (`.`, `!`, `?`, `…` followed by whitespace), a sentence over the target hard-split at a word boundary.
  - Merge pieces up to `CHUNK_TARGET_CHARS` (1,000) with `CHUNK_OVERLAP_CHARS` (150) of overlap taken from the end of the previous chunk at a word boundary; a trailing piece under `CHUNK_MIN_CHARS` (200) is merged into the previous chunk of the same page. The three constants go in `shared/limits.ts`.
  - `chunkIndex` runs from 0 across the whole source.
- **R4** **Chunker tests:** a short text gives one chunk; a long text gives chunks of at most target + overlap characters; no chunk crosses a page and every chunk keeps its page; overlap is present between neighbours of the same page; a short tail is merged; a single 5,000-character "sentence" is split; empty input and whitespace-only pages give no chunks; German and other non-Latin text survives unchanged.
- **R5** **Embeddings** `rag/embed.ts`: `embedDocuments(texts)` calls `embedMany` with `EMBEDDING_MODEL`, `providerOptions.google = { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" }`, in sequential batches of up to 100 (`EMBED_BATCH_SIZE` in limits), and checks every vector has 768 numbers (else `INTERNAL`). `embedQuery(text)` with `taskType: "RETRIEVAL_QUERY"` is added here too, for NB-009.
- **R6** **Prompts** in `ai/prompts.ts`, starting from ARCHITECTURE §12:
  - `sourceSummaryPrompt(text)`: the first 30,000 characters (`SUMMARY_INPUT_CHARS`) inside clear delimiters, marked as data.
  - `suggestedQuestionsPrompt(summaries)` with structured output `{ questions: string[] }` via `generateText` with `output: Output.object({ schema })` (the AI SDK's current structured-output API; check the installed version's docs). The schema keeps 3–5 strings of at most 120 characters; extra items are dropped, not rejected.
- **R7** **DB helpers** `db/sources.ts`, `db/chunks.ts`, all scoped by `owner_id` (chunks through their source's owner check, R8):
  - sources: `insert`, `listByNotebook(ownerId, notebookId)`, `getOwned(ownerId, id)`, `countInNotebook`, `countCreatedSince(ownerId, since)`, `claim(ownerId, id)`, `markReady`, `markFailed`, `remove`.
  - chunks: `deleteBySource(sourceId)`, `insertMany(rows)` in batches of 100 with a longer abort signal (`INGEST_DB_TIMEOUT_MS`, 30 s, in limits; `supabase.ts` already lets callers pass their own).
  - notebooks: `setSuggestedQuestions(ownerId, id, questions)`.
- **R8** **Claim (atomic, ARCHITECTURE §6 step 2), extended for stuck sources:**
  ```sql
  update sources set status = 'processing', error = null
  where id = $1 and owner_id = $2
    and (status in ('pending', 'failed')
         or (status = 'processing' and updated_at < now() - interval '5 minutes'))
  returning *
  ```
  No row: if the source exists for the owner → `ALREADY_PROCESSING`, else `NOT_FOUND`. Supabase's query builder can't express the `or` with an interval cleanly, so this is a SQL function `claim_source(p_id, p_owner_id)` in a new migration `infra/supabase/migrations/0002_claim_source.sql` (execute granted to `service_role` only, like `match_chunks`).
- **R9** **Service** `services/sources.ts`:
  - `listSources(ownerId, notebookId)`: `id, type, title, status, error, page_count, char_count, summary, created_at`, oldest first. A source in `pending` or `processing` whose `updated_at` is more than 5 minutes old (`STUCK_SOURCE_MS`) is returned as `failed` with the error "Processing timed out." (computed, not written; the claim in R8 accepts it).
  - `createTextSource(ownerId, input)` with `{ notebookId, title?, text }`: title trimmed, max 80 characters; without one, the first non-empty line of the text cut to 80 characters (at a word boundary, with "…" when cut). `text` trimmed, 1–200,000 characters (`VALIDATION`: "Paste some text first." / "Pasted text can be up to 200,000 characters."). Then the limits: 10 per notebook (`LIMIT_REACHED`: "A notebook can have up to 10 sources."), 20 per owner per hour, counted from `sources.created_at` (`LIMIT_REACHED`: "You've added 20 sources in the last hour. Try again later."). Inserts `pending`, returns `{ sourceId }`. Count-then-insert may overshoot by one under parallel requests; accepted.
  - `processSource(ownerId, sourceId)`: claim (R8) → delete old chunks → extract (text: one page `{ page: null, text: input_text }`) → chunk → embed → insert chunks → summary → `ready` with `page_count` (null for text) and `char_count` → suggested questions (R10). Errors in extract to ready: `markFailed` with the user message of the error's code (`toUserMessage`, unknown → INTERNAL's message), then rethrow so the route logs it. Returns `{ status, error? }`.
  - The extractor is a function per type in `rag/extract.ts` (`extractText` here); NB-008 adds `url` and `pdf`, and `processSource` picks by `type`.
  - `deleteSource(ownerId, input)` with `{ id }`: owner check, delete the row (chunks cascade), then regenerate suggested questions (R10). Returns `{ notebookId }`.
- **R10** **Suggested questions:** after a source becomes ready and after a delete, regenerate from the summaries of all ready sources of the notebook (no ready sources → `[]` without a Gemini call). A failure is logged and leaves the old questions; it never fails the source or the delete.
- **R11** **Tests** besides R4: `toAiError` (R2), the title fallback for text sources, and the stuck-status mapping in `listSources` (as a pure helper `effectiveStatus(row, now)`).

### Frontend
- **R12** **Process route** `frontend/src/app/api/sources/[id]/process/route.ts`: `POST`, `runtime = "nodejs"`, `maxDuration = 60`, wrapped in `withRoute`. `getOwnerId()` → `processSource` → `200 { status, error? }`; thrown errors → the error shape (`ALREADY_PROCESSING` → 409, `RATE_LIMITED` → 429 …). No request body.
- **R13** **Server Actions** in `notebook/[id]/actions.ts` via `runAction` (NB-006): `createTextSource` → `{ sourceId }`, `deleteSource` → revalidates the notebook page. A new `retrySource` isn't needed: retry is the process call.
- **R14** **Shelf** (`components/notebook/shelf.tsx` and children), from DESIGN.md → "Layout":
  - The notebook page loads the sources in the Server Component and passes them down. Chips in creation order: a status dot, the title (truncated, full title in a tooltip), then "Text" (NB-008 adds "Web page" and "n p.").
  - **Status dot:** `pending`/`processing` a small spinner (reduced motion: a static dot) with the label "Processing"; `ready` a filled `ink` dot; `failed` a `danger` dot. The status is also in the chip's accessible name ("Climate notes, ready"), not only in colour.
  - **Polling:** while any source is `pending` or `processing`, a client leaf calls `router.refresh()` every 2 s (`SOURCE_POLL_MS`) and stops when none is; it pauses while the tab is hidden.
  - **Source popover** on pressing a chip (desktop and tablet; on mobile the same content inside the Shelf sheet): title, type and size ("Text · 12,400 characters"), the summary (Newsreader) or "The summary appears when processing is done.", the error in `danger` for failed sources with a "Try again" button, and "Delete source" (confirmation dialog: "Delete <title>?", "Its passages won't be used in answers any more.").
  - **Add source** button at the end of the strip: opens a dialog with the "Paste text" form (optional title, textarea with a live "n / 200,000" counter, "Add source" button). On submit: `createTextSource`, close the dialog, then call the process route for the new source (`fetch`, not awaited by the UI; the chip shows "Processing" from the refresh). A process error shows a toast with its message; the chip then shows failed after the next refresh.
  - At 10 sources the Add button is `aria-disabled` with the tooltip "A notebook can have up to 10 sources."
  - **Mobile:** the "Sources (n)" button from NB-006 shows the count and opens the bottom sheet with the same chips as a vertical list, and the Add button.
  - The NB-006 empty state stays for a notebook with no sources; its Add button is now enabled.
- **R15** **Ask empty state** (NB-006 R12) is unchanged: chat comes in NB-009.
- **R16** **Fixtures:** `fixtures/README.md` (what each file is, its licence) and `fixtures/sample-text.md`, an original text of about 2,000 words written for this project (so no licence issue), with a few facts that make good test questions.
- **R17** **Docs:**
  - ARCHITECTURE §5 (status lifecycle: stuck applies to `pending` too), §6 step 2 (the claim is `claim_source`, migration 0002), §6 "Limits" (chunk constants, batch size, poll interval), §10 (`retrySource` isn't needed).
  - `infra/README.md`: setup step 3 runs every migration in order; Layout lists `0002_claim_source.sql`.
  - `backend/README.md` Layout: `ai/gemini.ts`, `ai/errors.ts`, the `rag/` and `db/` files added.

## Design

**Files**
- Backend: `ai/{gemini,errors,prompts}.ts`, `rag/{chunk,chunk.test,embed,extract}.ts`, `db/{sources,chunks,notebooks}.ts`, `services/sources.ts` (+ tests), `shared/limits.ts`, `index.ts`.
- Infra: `infra/supabase/migrations/0002_claim_source.sql`.
- Frontend: `app/api/sources/[id]/process/route.ts`, `app/notebook/[id]/{page,actions}.tsx`, `components/notebook/{shelf,source-chip,source-popover,add-source-dialog,text-source-form,source-poller}.tsx`, shadcn `tabs` (added now, so NB-008 only adds tabs to it).
- `fixtures/README.md`, `fixtures/sample-text.md`.

**Data.** No table changes. One new SQL function (R8). The text stays in `sources.input_text` so a retry can re-run the pipeline.

**Process call and limits.** The process call runs one embedding batch per ~100 chunks; 200,000 characters is ~230 chunks, so three batches plus one summary call fit in 60 s. Gemini free-tier limits apply per minute and per day (check the current numbers in AI Studio for `gemini-embedding-001`); a 429 marks the source failed with `RATE_LIMITED`'s message, and "Try again" retries it.

**Rejected alternatives**
- **Processing inside the create action:** the action would run for up to a minute, and a closed tab would leave nothing to retry. A separate claimable process call is what ARCHITECTURE §6 describes and what retry reuses.
- **Writing `failed` for stuck sources from a cron:** a second moving part. Computing it on read and accepting it in the claim needs no writer.
- **Supabase Realtime instead of polling:** another client channel and key exposure for a 2 s refresh that ends within a minute.

**Dependencies.** `ai`, `@ai-sdk/google` (approved). shadcn `tabs` (approved, a shadcn component).

**Size.** About 750–800 changed lines of code and tests (chunker and tests ~250, AI and embed ~100, DB and service ~200, route ~30, Shelf, dialog, popover and poller ~250), plus the migration and fixtures.

## Implementation

- [ ] **Implemented** (`feat/NB-007-text-sources`)
  - **User step before merge:** run `infra/supabase/migrations/0002_claim_source.sql` in the Supabase SQL editor (`/implement` copies it with `pbcopy` and asks in one message). The preview needs it too, since preview and production share the database.
  - Acceptance:
    - CI passes, including every case in R4 and R11.
    - Every new query in `backend/src/db/` filters by `owner_id` or goes through a function that does (read through, R7); `chunks` writes happen only after the source's owner check in `processSource`.
    - On the preview, logged in, in a new notebook:
      - Pasting `fixtures/sample-text.md` without a title adds a chip named after its first line; it shows "Processing", then "ready" within about 30 s without a reload; the popover shows "Text · n characters" and a 3–4 sentence summary.
      - In Supabase: the source has `status = ready`, `char_count` set, chunks with `page = null` and 768-dimension embeddings; `notebooks.suggested_questions` holds 3–5 questions.
      - An empty paste shows "Paste some text first."; 200,001 characters show the length message (the counter turns `danger` first).
      - The 11th source is refused with "A notebook can have up to 10 sources.", and the Add button is disabled with that tooltip.
      - Forcing a failure (e.g. a temporary wrong API key on a local run) marks the source failed with a clear message; "Try again" with the right key makes it ready, with no duplicate chunks (`select count(*)` is the same as after a clean run).
      - A source set to `processing` with `updated_at` 6 minutes ago (SQL editor) shows "Processing timed out." and "Try again" processes it; calling the process route twice at once gives one `200` and one `409`.
      - Deleting a source removes its chip and its chunks; the suggested questions are regenerated (or `[]` when none is left).
      - Reloading the page mid-processing keeps polling until ready; at 360 px the "Sources (n)" sheet lists the chips and the Add button, with no horizontal scroll; light and dark.
    - Docs updated as in R17.

## Open questions
None.

## Notes
Deviations found during implementation, one line each.
