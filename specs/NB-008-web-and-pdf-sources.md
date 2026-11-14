# NB-008 · Web page and PDF sources

**Type:** feat   **Milestone:** M4   **Depends on:** NB-007

The second half of M4 (NB-007 explains the cut). It plugs two new extractors into NB-007's pipeline and adds their tabs to the "Add source" dialog.

## Goal
Users can add a web article by its link and upload a PDF of up to 10 MB and 300 pages. Both go through the same pipeline as pasted text and end up `ready` with page-exact chunks (PDF) or `failed` with a clear message: a scanned PDF says it has no selectable text, and a link to `localhost` or a private address is refused.

## Scope
- **In:**
  - URL guard (`rag/url-guard.ts`) with tests, and a guarded fetch that re-checks every redirect and every resolved address.
  - URL extraction with `@mozilla/readability` on `linkedom`.
  - PDF upload: `POST /api/sources/upload-url`, direct upload to Supabase Storage with the signed token, extraction per page with `unpdf`, `NO_TEXT_FOUND`.
  - Storage cleanup when a PDF source or its notebook is deleted (left out of NB-006).
  - The "Web page" and "PDF" tabs in the Add source dialog, chip labels "Web page" and "n p.".
  - Fixtures: a public-domain PDF of about 50 pages and an image-only PDF.
- **Out:**
  - OCR for scanned PDFs (a known limitation, PROGRESS).
  - Other file types (Word, EPUB, images), JavaScript-rendered pages, pages behind a login or paywall.
  - Changes to the chunker, embeddings or summaries (NB-007).

## Requirements

### URL sources
- **R1** **Dependencies:** `@mozilla/readability`, `linkedom` and `unpdf` in `backend/` (approved in CLAUDE.md).
- **R2** **URL guard** `rag/url-guard.ts`, pure apart from an injected resolver (ARCHITECTURE §6 "SSRF protection"):
  - `parsePublicUrl(input)`: `http:` or `https:` only, no username or password in the URL, default port only (none, 80 or 443), hostname not `localhost` or ending in `.localhost`, max 2,048 characters. Otherwise `VALIDATION` with "Enter a link that starts with http:// or https://." (bad scheme or syntax) or "That link points to a private address." (host rules).
  - `isPublicAddress(ip)`: false for 0.0.0.0/8, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 100.64.0.0/10 (carrier-grade NAT), 224.0.0.0/4 and above, `::`, `::1`, fc00::/7, fe80::/10, and IPv4-mapped IPv6 (`::ffff:a.b.c.d`) of any of those. Literal IPs in the URL are checked the same way.
  - `assertPublicHost(hostname, resolve)`: resolves all A and AAAA records with the injected `resolve` and throws `URL_FETCH_FAILED` if any address isn't public.
- **R3** **Guarded fetch** `rag/fetch-page.ts`: uses `node:http`/`node:https` `request` with a custom `lookup` that resolves the name, rejects non-public addresses (R2) and connects to the checked address, so a DNS answer can't change between check and connect (DNS rebinding). Rules:
  - Total timeout 10 s (`URL_FETCH_TIMEOUT_MS`), `AbortSignal` based.
  - At most 3 redirects (`URL_MAX_REDIRECTS`), each `Location` resolved against the current URL and checked with R2 and the lookup again.
  - Only `200` with `Content-Type: text/html` or `application/xhtml+xml` (else `URL_FETCH_FAILED`).
  - The body is read as a stream and aborted past 5 MB (`MAX_URL_BYTES`), decoded with the charset from the header (default UTF-8).
  - A plain `User-Agent` naming the app ("Notehooked/1.0 (+source reader)"), no cookies, no other headers.
  - Every failure throws `URL_FETCH_FAILED` with the underlying error as `cause` (logged, never shown).
- **R4** **Tests** for R2 and R3's pure parts (resolver injected, no network): each blocked range including IPv4-mapped IPv6, `localhost`, `foo.localhost`, `http://127.1`, `http://[::1]`, `http://0x7f000001`, a public IP, credentials in the URL, a non-default port, `ftp:`, `javascript:`, a host resolving to one public and one private address (blocked), and a redirect target check (`Location` to a private address is blocked).
- **R5** **Extract** `extractUrl(url)` in `rag/extract.ts`: guarded fetch → `linkedom` `parseHTML` → `new Readability(document).parse()`. Result: one page `{ page: null, text: textContent }` and the article title. Less than 200 characters of text (`MIN_URL_TEXT_CHARS`) → `URL_FETCH_FAILED` (the page is empty or rendered by JavaScript). Readability's HTML output is never used or stored, only its text.
- **R6** **Create:** `createUrlSource(ownerId, { notebookId, url })` validates with R2's `parsePublicUrl` (no DNS yet), applies NB-007's limits, inserts a `pending` source with `url` and a provisional title (hostname plus path, cut to 80 characters). After extraction, `processSource` sets the title to readability's title (trimmed, max 80) when it has one. Server Action `createUrlSource` via `runAction`.

### PDF sources
- **R7** **Upload URL route** `POST /api/sources/upload-url` (`runtime = "nodejs"`, `withRoute`): body `{ notebookId, fileName, fileSize }` (zod: name ends in `.pdf`, case-insensitive, max 200 characters; size a positive integer). Then:
  - `fileSize > MAX_PDF_BYTES` → `FILE_TOO_LARGE`; NB-007's source limits apply.
  - Insert a `pending` source with `type = 'pdf'`, title = file name without `.pdf` (max 80 characters), `storage_path = {owner_id}/{source_id}.pdf`.
  - `createSignedUploadUrl(path)` on the `sources` bucket; return `{ sourceId, path, token }`.
- **R8** **Client upload:** the PDF tab takes one file (`accept="application/pdf"`, client-side check of type and size first, with the same messages), calls R7, then `uploadToSignedUrl(path, token, file)` with the browser client (`lib/supabase/browser.ts`, publishable key), then calls the process route. The button shows "Uploading…" and then the chip shows "Processing". If the upload fails, the client calls `deleteSource` for the new source and shows "The upload didn't work. Try again." (so no empty `pending` source stays behind).
- **R9** **Extract** `extractPdf(storagePath, ownerId)`:
  - Check the path starts with `{ownerId}/` (defence in depth), download from the `sources` bucket with `INGEST_DB_TIMEOUT_MS`, reject more than `MAX_PDF_BYTES` (`FILE_TOO_LARGE`).
  - `unpdf`: `getDocumentProxy(new Uint8Array(buffer))`, more than `MAX_PDF_PAGES` → `LIMIT_REACHED` "PDFs can have up to 300 pages."; then `extractText(pdf, { mergePages: false })`, giving one string per page, so page `n` gets `page = n` (1-based). Check the installed unpdf version's API.
  - Total text under 100 characters (`MIN_PDF_TEXT_CHARS`) → `NO_TEXT_FOUND`.
  - A PDF that can't be parsed (encrypted, corrupt) → `NO_TEXT_FOUND` too, with the cause logged. `processSource` sets `page_count`.
- **R10** **Storage cleanup:** `deleteSource` removes the source's file from the bucket after deleting the row; `deleteNotebook` (NB-006) lists the notebook's `storage_path`s before deleting and removes them after. A storage error is logged and never fails the delete (an orphaned file is harmless; the bucket is private).

### UI and fixtures
- **R11** **Add source dialog** gets three tabs in this order: "PDF", "Web page", "Paste text" (keyboard: arrow keys between tabs, Radix). The "Web page" tab has one URL input and "Add source"; a validation error shows under the field. Chip labels: "Web page" for URLs, "n p." for PDFs. The source popover shows "Web page · example.org" with the link (`rel="noopener noreferrer"`, `target="_blank"`) or "PDF · n pages".
- **R12** **Fixtures** in `fixtures/` with a line each in `fixtures/README.md` (source URL and licence):
  - A text PDF of about 40–60 pages, under 10 MB, from a public-domain source (a US federal government publication; the implementer picks one and records the link).
  - `scanned.pdf`: an image-only PDF of one or two pages (made from a fixture page rendered to an image), so `NO_TEXT_FOUND` can be tested.
- **R13** **Docs:**
  - ARCHITECTURE §6: the guarded fetch with the pinned lookup (R3), the extra blocked ranges (R2), `MIN_URL_TEXT_CHARS`, and the upload clean-up on failure (R8).
  - `docs/PROGRESS.md`: M4 is still checked on production after merge (its "Done when"); the implementing PR doesn't mark it done.

## Design

**Files**
- Backend: `rag/{url-guard,url-guard.test,fetch-page,extract}.ts`, `services/sources.ts`, `services/notebooks.ts`, `db/sources.ts`, `shared/limits.ts`.
- Frontend: `app/api/sources/upload-url/route.ts`, `app/notebook/[id]/actions.ts`, `components/notebook/{add-source-dialog,url-source-form,pdf-source-form,source-chip,source-popover}.tsx`.
- `fixtures/` (two PDFs, README lines).

**No schema change.** The `sources` bucket (private, 10 MB, `application/pdf`) exists from `0001_init.sql` and enforces size and type on upload too.

**Rejected alternatives**
- **Global `fetch` with a DNS check before the call:** the name is resolved again on connect, so a rebinding DNS server could answer differently. Pinning the checked address in `lookup` closes that without a new dependency (`undici`'s `Agent` would need one).
- **Uploading PDFs through our route:** Vercel's 4.5 MB body limit (ARCHITECTURE §2).
- **Keeping readability's HTML for nicer formatting:** stored HTML would need sanitising before it could ever be shown; the Reader only needs text.

**Function time.** A 50-page PDF is about 150–250 chunks, so two or three embedding batches; download, parse and summary fit in the 60 s `maxDuration`. Vercel Hobby allows up to 300 s, which is the fallback if a real 300-page PDF needs it (a one-line change, noted in the PR if it happens).

**Dependencies.** `unpdf`, `@mozilla/readability`, `linkedom` (approved).

**Size.** About 650–750 changed lines of code and tests (guard and tests ~280, guarded fetch ~100, extractors ~90, upload route and service ~80, dialog tabs and upload client ~150, cleanup ~30), plus fixtures.

## Implementation

- [ ] **Implemented** (`feat/NB-008-web-pdf-sources`)
  - No user steps.
  - Acceptance:
    - CI passes, including every case in R4.
    - `grep -rn "fetch(" backend/src/rag` finds no direct `fetch` of user URLs: URL sources only go through `fetch-page.ts`.
    - On the preview, logged in:
      - An article link (e.g. a Wikipedia article) reaches `ready`; the chip says "Web page", the title is the article's title, the popover links to it.
      - `http://localhost:3000`, `http://127.0.0.1`, `http://169.254.169.254/latest/meta-data/` and `http://[::1]/` are refused with "That link points to a private address." (or fail with `URL_FETCH_FAILED` after DNS), and nothing is fetched.
      - A link to a PDF or an image fails with "We couldn't read that page. Check the link or paste the text instead."
      - The fixture PDF (~50 pages) reaches `ready`; the chip shows "n p."; in Supabase its chunks have `page` from 1 to n, and `page_count = n`.
      - `scanned.pdf` fails with "This PDF has no selectable text. Scanned PDFs aren't supported yet."
      - An 11 MB file is refused in the browser and, with the client check bypassed (curl to R7 with `fileSize` 11 MB), by the route with `FILE_TOO_LARGE`.
      - Deleting a PDF source and deleting a notebook with a PDF remove the files from the `sources` bucket (Storage browser).
      - The dialog's tabs work by keyboard; at 360 px the dialog fits without horizontal scroll.
    - **After merge, on production (M4 "Done when"):** a ~50-page PDF, an article URL and a pasted text all reach `ready`, a scanned PDF fails with the right message, and a `localhost` URL is rejected.

## Open questions
None. (The fixture PDF is picked during implementation from US federal public-domain publications, R12; say if you'd rather choose it.)

## Notes
Deviations found during implementation, one line each.
