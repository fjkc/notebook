# NB-007 · Text sources and the ingestion pipeline

**Type:** feat   **Milestone:** M4   **Depends on:** NB-006

M4 is cut into two specs, because one PR would be well over the ~800-line limit (`WORKFLOW.md` §1): **NB-007** builds the pipeline (claim → extract → chunk → embed → summarise → ready) and the Shelf, with pasted text as the first source type. **NB-008** adds web pages and PDFs on top of it. Generating the notebook's suggested questions (ARCHITECTURE §6 step 8) moves to NB-010, where they're shown.

## Goal
Users can paste text into a notebook and watch it go from "processing" to "ready" on the Shelf, with a summary. Failed and stuck sources show a clear message and can be retried, and sources can be deleted. Chat (NB-009) can then search the stored chunks.

## Scope
- **In:**
  - Chunker (`rag/chunk.ts`) with tests, embeddings (`rag/embed.ts`), the source summary prompt (`ai/prompts.ts`), Gemini error mapping.
  - `createTextSource` and `deleteSource` Server Actions, `POST /api/sources/[id]/process`.
  - Limits: 10 sources per notebook, 20 new sources per owner per hour, 200,000 pasted characters (checked against the Gemini free tier, R16).
  - Stuck sources (more than 5 minutes in `pending` or `processing`) shown as failed and retryable.
  - The Shelf: source chips with status, polling, a source popover (summary, error, retry, delete), the "Add source" dialog with the "Paste text" tab, and the mobile "Sources (n)" sheet.
  - `fixtures/` with a short sample text.
- **Out:**
  - Web page and PDF sources, the URL guard, storage cleanup: NB-008. Their tabs aren't in the dialog yet.
  - Suggested questions (generating and showing): NB-010.
  - A job queue or background processing (ARCHITECTURE §2: the client triggers processing).

## Requirements

### Backend
- **R1** **Dependencies:** `ai` and `@ai-sdk/google` in `backend/` (approved in CLAUDE.md). Gemini is created lazily in a `server-only` module `backend/src/ai/gemini.ts` that reads `GOOGLE_GENERATIVE_AI_API_KEY` through `env.ts`. Every AI call sets `maxRetries: 2` (ARCHITECTURE §11).
- **R2** **Gemini errors.** `toAiError(error)` in `ai/errors.ts`: an AI SDK `APICallError` with status 429 (or a `RetryError` whose last error is one) becomes `AppError("RATE_LIMITED", { cause })`; anything else becomes a plain `Error` with the cause (→ `INTERNAL`). Every function in `rag/embed.ts` and every summary call wraps its errors with it. Unit-tested with constructed errors.
- **R3** **Chunker** `rag/chunk.ts`, pure, as ARCHITECTURE §6 step 4: input `{ page: number | null; text: string }[]`, output `{ chunkIndex; page; content; overlapChars }[]`, where `overlapChars` is the length of the overlap prefix in `content` (0 for the first chunk of a page; `db/chunks` ignores it, the tests use it). Constants in `shared/limits.ts`: `CHUNK_TARGET_CHARS` 1,000, `CHUNK_OVERLAP_CHARS` 150, `CHUNK_MIN_CHARS` 200.
  - Each page separately: chunks never cross pages. Whitespace is normalised first (runs of spaces and tabs → one space, three or more newlines → two, trimmed). Empty pages are skipped.
  - **Pieces:** split into paragraphs at blank lines. A paragraph longer than the target is split into sentences: after `.`, `!`, `?` or `…` followed by whitespace, and after `。`, `！`, `？` (no whitespace needed). A sentence longer than the target is hard-split: at the last whitespace within the final 100 characters before the target, or exactly at the target if there's none (text without spaces, such as Chinese or a long URL), never inside a surrogate pair.
  - **Joining:** pieces from different paragraphs are joined with `\n\n`, sentences of one paragraph with one space. These separators count as new text.
  - **Chunks:** pieces are packed in order while the **new text** of a chunk (pieces plus their separators) stays at most the target. Every chunk after the first on a page starts with an overlap: the last up to 150 characters of the previous chunk's content, cut at whitespace when there is any within those characters (else exactly 150, never inside a surrogate pair), followed by one space. The overlap and that space count toward `overlapChars`, which is therefore at most 151, and a chunk is at most 151 + 1,000 = 1,151 characters.
  - **Tail:** if the last chunk of a page has less than 200 characters of new text, its new text is appended to the previous chunk of the same page instead, joined with `\n\n`. Such a merged chunk is at most 1,151 + 2 + 199 = **1,352** characters (`MAX_CHUNK_CHARS`, derived from the constants in `limits.ts`, the bound the tests use).
  - `chunkIndex` runs from 0 across the whole source.
- **R4** **Chunker tests:** a short text gives one chunk; a long text gives chunks of at most `MAX_CHUNK_CHARS` and new text of at most the target; no chunk crosses a page and every chunk keeps its page; the overlap is present between neighbours of the same page and absent across pages; a short tail is merged; a single 5,000-character "sentence" with spaces and a 5,000-character run without spaces are both split within the bound; empty input and whitespace-only pages give no chunks; **content is preserved:** for a German sample and a Chinese sample, the chunks' new text (`content.slice(overlapChars)`) joined in order equals the normalised input, with whitespace removed from both sides of the comparison; and every chunk's overlap equals the end of the previous chunk of the same page (plus the space).
- **R5** **Embeddings** `rag/embed.ts`: `embedDocuments(texts)` calls `embedMany` with `EMBEDDING_MODEL`, `providerOptions.google = { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" }`, in sequential batches of up to 100 (`EMBED_BATCH_SIZE` in limits), and checks every vector has 768 numbers (else a plain `Error` → `INTERNAL`). `embedQuery(text)` with `taskType: "RETRIEVAL_QUERY"` is added here too, for NB-009. Both wrap errors with `toAiError` (R2).
- **R6** **Summary prompt** `sourceSummaryPrompt(text)` in `ai/prompts.ts`, from ARCHITECTURE §12: the first 30,000 characters (`SUMMARY_INPUT_CHARS`) inside `<document>…</document>` delimiters, marked as data whose instructions are ignored. Called with `generateText`, `TEXT_MODEL`, `maxRetries: 2`.
- **R7** **Ownership of sources.** `assertSourceOwner(ownerId, sourceId)` in `services/ownership.ts` (the name `backend/README.md` already uses): validates both as UUIDs and loads the source with an `owner_id` filter; a malformed, unknown or foreign ID throws `NOT_FOUND`. It returns the source row, so callers don't load it twice.
- **R8** **DB helpers** `db/sources.ts` and `db/chunks.ts`:
  - sources, every query with `.eq("owner_id", ownerId)`: `insert`, `listByNotebook(ownerId, notebookId)`, `getOwned(ownerId, id)`, `countInNotebook(ownerId, notebookId)`, `countCreatedSince(ownerId, since)`, `claim(ownerId, id)` (calls R9's function), `markReady(ownerId, id, fields)`, `markFailed(ownerId, id, message)`, `remove(ownerId, id)`. `markReady` and `markFailed` return whether a row was updated.
  - chunks: only `insertMany(rows)`, in batches of 100 with a longer abort signal (`INGEST_DB_TIMEOUT_MS`, 30 s, in limits; `supabase.ts` already lets callers pass their own). `chunks` has no `owner_id` column. This is the one **documented exception** to "every query is scoped by `owner_id`" (CLAUDE.md rule 5): `insertMany` is called only by `processSource` with rows built from a source it has just claimed for the owner, and it never reads or deletes. Chunks are deleted only inside the owner-scoped `claim_source` (R9) and by the cascade from `sources`.
- **R9** **Claim (atomic, ARCHITECTURE §6 step 2)** as a SQL function `claim_source(p_id uuid, p_owner_id uuid)` in a new migration `infra/supabase/migrations/0002_claim_source.sql`. In one statement block (one transaction) it:
  It is `returns setof public.sources`, `language sql`, one statement with data-modifying CTEs (`with claimed as (update … returning *), removed as (delete from public.chunks where source_id in (select id from claimed)) select * from claimed`), so it runs in one transaction:
  1. Updates the source to `status = 'processing', error = null` where `id = p_id and owner_id = p_owner_id and (status in ('pending', 'failed') or (status = 'processing' and updated_at < now() - interval '5 minutes'))`, returning the row.
  2. If a row was claimed, deletes that source's existing chunks (a retry never leaves duplicates).
  3. Returns the claimed row, or an empty set. `db/sources.claim()` returns the first element of the RPC's array, or `null` when it is empty (never a row of nulls).
  - `security definer` is not needed (the service role calls it); `set search_path = public`; execute granted to `service_role` only and revoked from `public, anon, authenticated`, like `match_chunks`.
  - No row claimed: if the source exists for the owner → `ALREADY_PROCESSING` (409; this also covers a `ready` source, which the UI never offers to process, so the message is acceptable), else `NOT_FOUND`.
- **R10** **Service** `services/sources.ts`:
  - `listSources(ownerId, notebookId)`: `assertNotebookOwner`, then `id, type, title, status, error, page_count, char_count, summary, created_at`, oldest first, with the status passed through `effectiveStatus(row, now)`: a source in `pending` or `processing` whose `updated_at` is more than 5 minutes old (`STUCK_SOURCE_MS`) is returned as `failed` with the error "Processing timed out." (computed, not written; the claim in R9 accepts it).
  - `createTextSource(ownerId, input)` with `{ notebookId, title?, text }`, in this order:
    1. Validate with zod: `text` trimmed, 1–200,000 characters (`VALIDATION`: "Paste some text first." / "Pasted text can be up to 200,000 characters."); `title` trimmed, max 80 characters.
    2. `assertNotebookOwner(ownerId, notebookId)` (foreign or malformed → `NOT_FOUND`).
    3. Limits: 10 per notebook (`LIMIT_REACHED`: "A notebook can have up to 10 sources."), 20 per owner per hour, counted from `sources.created_at` (`LIMIT_REACHED`: "You've added 20 sources in the last hour. Try again later."). Both messages are built from the constants.
    4. Title: the given one, or else `textTitle(text)`: the first non-empty line, leading `#` characters and whitespace removed, cut to 80 characters at a word boundary (or at 80 if there's none, never inside a surrogate pair) with "…" when cut.
    5. Insert `pending`, return `{ sourceId, notebookId }`.
  - `processSource(ownerId, sourceId)`: `assertSourceOwner` → claim (R9) → extract (text: one page `{ page: null, text: input_text }`) → chunk → embed → insert chunks → summary → `markReady` with `summary`, `page_count` (null for text) and `char_count`. Returns `{ status: "ready" }`.
    - **Time budget:** the whole run shares one `AbortSignal.timeout(PROCESS_BUDGET_MS)` (45 s, in limits), passed to every AI call and every DB call after the claim. A run that hits it ends like any other failure (`markFailed`, with INTERNAL's message), well before the route's 60 s limit, so the source never sits in `processing` until the stuck window. NB-010 adds a 10 s step after `markReady`, which still fits.
    - **Failure:** any error after the claim calls `markFailed` with the user message of the error's code (`toUserMessage`; unknown errors get INTERNAL's message), then rethrows, so the route answers with the error shape. A process call never returns 200 for a failed source.
    - **Source deleted mid-run:** if the chunk insert fails with a foreign-key violation (Postgres `23503`) or `markReady`/`markFailed` updates no row, the source was deleted while processing: `processSource` throws `NOT_FOUND` and logs nothing else. The client ignores `NOT_FOUND` from a process call (R14).
    - The extractor is a function per type in `rag/extract.ts` (`extractText` here); NB-008 adds `url` and `pdf`, and `processSource` picks by `type`.
  - `deleteSource(ownerId, input)` with `{ id }`: `assertSourceOwner`, delete the row (chunks cascade). Allowed in any status. Returns `{ notebookId }`.
- **R11** **Tests** besides R4: `toAiError` (R2), `textTitle` (plain first line, a Markdown heading, a long line cut at a word, a text starting with blank lines), and `effectiveStatus` (fresh and stuck `pending` and `processing`, `failed`, `ready`).

### Frontend
- **R12** **Process route** `frontend/src/app/api/sources/[id]/process/route.ts`: `POST`, `runtime = "nodejs"`, `maxDuration = 60`, wrapped in `withRoute`. `getOwnerId()` → `processSource` → `200 { status: "ready" }`; thrown errors → the error shape (`NOT_FOUND` → 404, `ALREADY_PROCESSING` → 409, `RATE_LIMITED` → 429, others as in ARCHITECTURE §11). No request body. `maxDuration` stays well below the 5-minute stuck window, so a running call is never re-claimed.
- **R13** **Server Actions** in `notebook/[id]/actions.ts` via `runAction` (NB-006):
  - `createTextSource` → `{ sourceId }`, and `revalidatePath("/notebook/<notebookId>")`, so the new `pending` chip appears and polling starts.
  - `deleteSource` → `revalidatePath` of the same page.
  - There is no `retrySource`: retry is the process call.
- **R14** **Shelf** (`components/notebook/shelf.tsx` and children), from DESIGN.md → "Layout":
  - The notebook page loads the sources in the Server Component and passes them down. Chips in creation order: a status dot, the title (truncated, full title in a tooltip), then "Text" (NB-008 adds "Web page" and "n p.").
  - **Status dot:** `pending`/`processing` a small spinner (reduced motion: a static hollow dot; DESIGN.md's "○" in the wireframe is schematic) with the label "Processing"; `ready` a filled `ink` dot; `failed` a `danger` dot. The status is also in the chip's accessible name ("Climate notes, ready"), not only in colour.
  - **Polling:** while any source is `pending` or `processing`, a client leaf calls `router.refresh()` every 2 s (`SOURCE_POLL_MS`) and stops when none is; it pauses while the tab is hidden.
  - **Process calls:** after a create or a "Try again", the client calls the process route with `fetch` (the UI doesn't wait for it; the chip shows "Processing" through the refresh). When the call settles, the client calls `router.refresh()` once more. A `NOT_FOUND` answer is ignored (the source was deleted); any other error shows a toast with its message; a network error or a body that isn't the error shape (e.g. a platform 504 page) shows INTERNAL's message. The chip shows failed after the refresh.
  - **Source popover** on pressing a chip (desktop and tablet; on mobile the same content inside the Shelf sheet): title, type and size ("Text · 12,400 characters"), the summary (Newsreader) or "The summary appears when processing is done.", the error in `danger` for failed sources with a "Try again" button, and "Delete source" in every status (confirmation dialog: "Delete <title>?", "Its passages won't be used in answers any more.", "Delete source" destructive, "Cancel"; "Deleting…" while pending; errors as a toast).
  - **Add source** button at the end of the strip: opens a dialog with tabs (shadcn `tabs`, one tab "Paste text" for now) holding the form: optional title, a textarea with a live "n / 200,000" counter (turns `danger` above the limit), and an "Add source" button ("Adding…" while pending). Validation errors show under the field; on success the dialog closes and the process call starts.
  - At 10 sources the Add button is `aria-disabled` with the tooltip "A notebook can have up to 10 sources."
  - **Mobile:** the "Sources (n)" button from NB-006 shows the count and opens the bottom sheet with the same chips as a vertical list, and the Add button.
  - The NB-006 empty state stays for a notebook with no sources; its Add button is now enabled.
- **R15** **Ask empty state** (NB-006 R12) is unchanged: chat comes in NB-009.
- **R16** **Free-tier check.** Before merge, the implementer records the current free-tier limits for `gemini-embedding-001` and `TEXT_MODEL` (requests and tokens per minute, requests per day) from the AI Studio rate-limit page in ARCHITECTURE §6 "Limits" with the date, and runs the near-limit acceptance check below. If a 200,000-character paste can't reach `ready` within those limits, `MAX_PASTED_TEXT_CHARS` is lowered to a size that does, and the change is noted under "Notes".
- **R17** **Fixtures:** `fixtures/README.md` (what each file is, its licence) and `fixtures/sample-text.txt`, an original text of about 2,000 words written for this project (so no licence issue), with a plain first line as its title and a few facts that make good test questions.
- **R18** **Docs:**
  - ARCHITECTURE §5: stuck applies to `pending` too. §6 step 2: the claim is `claim_source` (migration 0002) and deletes old chunks; step 8 (suggested questions) moves to NB-010. §6 "Client behaviour": the client doesn't wait for the process call; it refreshes on create, while polling, and when the call settles. §6 "Limits": chunk constants, batch size, poll interval, the recorded free-tier limits (R16). §10: `retrySource` isn't needed; `/process` returns `{ status: "ready" }` or the error shape.
  - `backend/README.md`: Layout gets `ai/gemini.ts`, `ai/errors.ts` and the `rag/` and `db/` files added; under "Best practices" the chunk-insert exception from R8.
  - `infra/README.md`: setup step 3 runs every migration in order; Layout lists `0002_claim_source.sql`.
  - `docs/PROGRESS.md`: M4's bullet "Source summaries and notebook suggested questions" becomes "Source summaries"; M5 gets "Notebook suggested questions from ready summaries (moved from M4, NB-010)". "Known limitations": the hourly source limit counts existing sources, so deleting frees room, and "Try again" isn't limited; acceptable behind the password gate.

## Design

**Files**
- Backend: `ai/{gemini,errors,prompts}.ts`, `rag/{chunk,chunk.test,embed,extract}.ts`, `db/{sources,chunks}.ts`, `services/{sources,ownership}.ts` (+ tests), `shared/limits.ts`, `index.ts`.
- Infra: `infra/supabase/migrations/0002_claim_source.sql`.
- Frontend: `app/api/sources/[id]/process/route.ts`, `app/notebook/[id]/page.tsx`, `app/notebook/[id]/actions.ts`, `components/notebook/{shelf,source-chip,source-popover,add-source-dialog,text-source-form,source-poller}.tsx`, shadcn `tabs` (added now, so NB-008 only adds tabs to it).
- `fixtures/README.md`, `fixtures/sample-text.txt`.

**Data.** No table changes. One new SQL function (R9). The text stays in `sources.input_text` so a retry can re-run the pipeline.

**Process call and limits.** 200,000 characters is about 230 chunks: three embedding batches and one summary call, which fit in the 45 s budget when the quota allows. A 429 marks the source failed with `RATE_LIMITED`'s message, and "Try again" retries it. R16 makes sure the advertised paste limit actually works on the free tier.

**Rejected alternatives**
- **Processing inside the create action:** the action would run for up to a minute, and a closed tab would leave nothing to retry. A separate claimable process call is what ARCHITECTURE §6 describes and what retry reuses.
- **Deleting old chunks with a separate query by `source_id`:** an unscoped delete outside the claim. Doing it inside `claim_source` keeps it owner-scoped and atomic.
- **Writing `failed` for stuck sources from a cron:** a second moving part. Computing it on read and accepting it in the claim needs no writer.
- **Supabase Realtime instead of polling:** another client channel and key exposure for a 2 s refresh that ends within a minute.
- **Blocking delete while processing:** a stuck source couldn't be removed for 5 minutes. Allowing it and treating the vanished row as `NOT_FOUND` is simpler for the user.

**Dependencies.** `ai`, `@ai-sdk/google` (approved). shadcn `tabs` (approved, a shadcn component).

**Size.** About 700–780 changed lines of code and tests (chunker and tests ~260, AI and embed ~90, ownership, DB and service ~190, route ~30, Shelf, dialog, popover and poller ~200), plus the migration and fixtures. Suggested questions moved to NB-010 to keep room under the ~800 limit.

## Implementation

- [ ] **Implemented** (`feat/NB-007-text-sources`)
  - **User steps before merge** (`/implement` asks for both in one message):
    - Run `infra/supabase/migrations/0002_claim_source.sql` in the Supabase SQL editor (copied with `pbcopy`). The preview needs it too, since preview and production share the database.
    - Read the free-tier limits for the two models from the AI Studio rate-limit page (R16) and tell Claude the numbers.
  - Acceptance:
    - CI passes, including every case in R4 and R11.
    - Every query in `backend/src/db/sources.ts` has `.eq("owner_id", ownerId)`; `db/chunks.ts` has only `insertMany` (R8, by reading).
    - By reading: `createTextSource` calls `assertNotebookOwner` before any count or insert (a Server Action can't be called from curl).
    - With `curl` and the session cookies copied from the browser: `POST /api/sources/<another owner's source id>/process` and `POST /api/sources/not-a-uuid/process` return 404.
    - On the preview, logged in, in a new notebook:
      - Pasting `fixtures/sample-text.txt` without a title adds a chip named after its first line right away; it shows "Processing", then "ready" within about 30 s without a reload; the popover shows "Text · n characters" and a 3–4 sentence summary.
      - In Supabase: the source has `status = ready` and `char_count` set; its chunks have `page = null`, 768-dimension embeddings, and none is longer than 1,352 characters.
      - An empty paste shows "Paste some text first."; 200,001 characters show the length message (the counter turns `danger` first).
      - **Near limit (R16):** a paste of about 195,000 characters reaches `ready` (or the limit is lowered as R16 says).
      - The 11th source is refused with "A notebook can have up to 10 sources.", and the Add button is disabled with that tooltip.
      - **Retry without duplicates:** take a ready source, note `select count(*) from chunks where source_id = '<id>'`, set it to failed (`update sources set status = 'failed' where id = '<id>'`), reload the page, press "Try again": it becomes ready again and the count is the same.
      - **Stuck:** in the SQL editor run
        `alter table public.sources disable trigger sources_updated_at; update public.sources set status = 'processing', updated_at = now() - interval '6 minutes' where id = '<id>'; alter table public.sources enable trigger sources_updated_at;`
        After a reload the chip shows "Processing timed out." and "Try again" processes it. Calling the process route twice at once on a pending source gives one `200` and one `409`.
      - Deleting a source while it shows "Processing" removes the chip, shows no error toast, and leaves no chunks for it.
      - Deleting a ready source removes its chip and its chunks.
      - Reloading the page mid-processing keeps polling until ready; at 360 px the "Sources (n)" sheet lists the chips and the Add button, with no horizontal scroll; light and dark.
    - Docs updated as in R18, including the recorded free-tier limits.

## Open questions
None.

## Notes
Deviations found during implementation, one line each.
