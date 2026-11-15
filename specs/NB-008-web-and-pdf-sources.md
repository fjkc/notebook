# NB-008 · Web page and PDF sources

**Type:** feat   **Milestone:** M4   **Depends on:** NB-007

The second half of M4 (NB-007 explains the cut). It plugs two new extractors into NB-007's pipeline and adds their tabs to the "Add source" dialog.

## Goal
Users can add a web article by its link and upload a PDF of up to 10 MB and 100 pages. Both go through the same pipeline as pasted text and end up `ready` with page-exact chunks (PDF) or `failed` with a clear message: a scanned PDF says it has no selectable text, and a link to `localhost` or a private address is refused.

## Scope
- **In:**
  - URL guard (`rag/url-guard.ts`) with tests, and a guarded fetch that pins the checked address and re-checks every redirect.
  - URL extraction with `@mozilla/readability` on `linkedom`, keeping paragraph breaks.
  - PDF upload: `POST /api/sources/upload-url`, direct upload to Supabase Storage with the signed token, extraction per page with `unpdf`, `NO_TEXT_FOUND`.
  - The PDF page limit lowered from 300 to 100 (R10).
  - Storage cleanup when a PDF source or its notebook is deleted (left out of NB-006, recorded in PROGRESS M4 by it).
  - The "Web page" and "PDF" tabs in the Add source dialog, chip and popover labels.
  - Fixtures: a public-domain PDF of about 50 pages and an image-only PDF.
- **Out:**
  - OCR for scanned PDFs (a known limitation, PROGRESS).
  - Other file types (Word, EPUB, images), JavaScript-rendered pages, pages behind a login or paywall.
  - Changes to the chunker, embeddings or summaries (NB-007).

## Requirements

### URL sources
- **R1** **Dependencies:** `@mozilla/readability`, `linkedom` and `unpdf` in `backend/` (approved in CLAUDE.md).
- **R2** **URL guard** `rag/url-guard.ts`, pure (ARCHITECTURE §6 "SSRF protection"):
  - `parsePublicUrl(input)` checks, in this order, each failure a `VALIDATION` error with its message:
    1. Longer than 2,048 characters → "Links can be up to 2,048 characters."
    2. Not parseable by `new URL`, or a scheme other than `http:`/`https:` → "Enter a link that starts with http:// or https://."
    3. A user name or password in the URL → "Links with a user name or password aren't supported."
    4. A port other than none, 80 or 443 → "Links with a port number aren't supported."
    5. Hostname `localhost` or ending in `.localhost`, or a literal IP (also in the forms `new URL` normalises, such as `127.1` or `0x7f000001`) that isn't public → "That link points to a private address."
  - `isPublicAddress(ip)`:
    - **IPv4** is public unless in 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.0.0.0/24, 192.168.0.0/16, 198.18.0.0/15, or 224.0.0.0/3 and above (multicast, reserved, broadcast).
    - Hostnames from `new URL` keep IPv6 literals in brackets, which are stripped before checking; IPv4-mapped addresses are recognised in both the dotted (`::ffff:127.0.0.1`) and the hex form `new URL` produces (`::ffff:7f00:1`).
  - **IPv6** is public only if it's global unicast (2000::/3) and not in 2001::/32 (Teredo), 2001:db8::/32 (documentation) or 2002::/16 (6to4). An IPv4-mapped address (`::ffff:a.b.c.d`) is judged by its IPv4 part. Everything else (`::`, `::1`, fc00::/7, fe80::/10, ff00::/8, 64:ff9b::/96 …) is not public.
  - `resolveRedirect(currentUrl, location)`: resolves `Location` against the current URL and runs `parsePublicUrl` on the result (a redirect to a private address or another scheme fails with `URL_FETCH_FAILED`, not `VALIDATION`, because it happens during processing).
  - `createGuardedLookup(resolve)`: returns a function with Node's `dns.lookup` signature for `http(s).request({ lookup })`. It resolves the name with the injected `resolve` (A and AAAA), fails with an error if **any** address isn't public, and answers in the form the caller asked for: with `options.all === true` an array of `{ address, family }` (Node ≥ 20 calls it this way when `autoSelectFamily` is on, the default), otherwise `(err, address, family)` with the first address. The socket then connects only to an address that was checked, so a DNS answer can't change between check and connect (DNS rebinding).
- **R3** **Guarded fetch** `rag/fetch-page.ts`: `node:http`/`node:https` `request` with `lookup: createGuardedLookup(resolve)`, where `resolve` runs `dns.promises.resolve4` and `resolve6` in parallel: `ENODATA` or `ENOTFOUND` for one family counts as an empty list for that family; the lookup fails only if both lists are empty or a family fails with any other error (e.g. a timeout). So IPv4-only and IPv6-only hosts both work. It never uses the global `fetch`. Node skips `lookup` for a literal IP host, which is why `parsePublicUrl` and `resolveRedirect` check literal IPs themselves. Rules:
  - Total timeout 10 s (`URL_FETCH_TIMEOUT_MS`), `AbortSignal` based.
  - At most 3 redirects (`URL_MAX_REDIRECTS`), each through `resolveRedirect` and the guarded lookup again.
  - Only `200` with `Content-Type: text/html` or `application/xhtml+xml`.
  - The body is read as a stream and aborted past 5 MB (`MAX_URL_BYTES`), decoded with the charset from the `Content-Type` header, else from a `<meta charset>` in the first 2 KB, else UTF-8; an unknown label falls back to UTF-8.
  - A plain `User-Agent` naming the app ("Notehooked/1.0 (+source reader)"), no cookies, no other headers.
  - Every failure throws `URL_FETCH_FAILED` with the underlying error as `cause` (logged, never shown).
- **R4** **Tests** (no network; resolvers injected):
  - `parsePublicUrl`: each rule in R2 with its message, including `http://localhost`, `http://foo.localhost`, `http://127.1`, `http://0x7f000001`, `http://[::1]`, `http://[::ffff:127.0.0.1]`, `ftp://…`, `javascript:…`, `https://user:pw@example.com`, `https://example.com:8080`, a 2,049-character link, and a valid public link.
  - `isPublicAddress`: one address inside each blocked IPv4 range and at its edges (e.g. 172.15.255.255 public, 172.16.0.0 not), 8.8.8.8 public; IPv6 `2606:4700::1` public, `::1`, `fe80::1`, `fd00::1`, `ff02::1`, `2002::1`, `2001:db8::1`, `::ffff:10.0.0.1` not.
  - `resolveRedirect`: a relative `Location`, a `Location` to `http://169.254.169.254/` (fails), to `file:///etc/passwd` (fails).
  - `createGuardedLookup`: an IPv4-only answer (the AAAA query fails with `ENODATA`) succeeds; with `all: true` returns exactly the resolved public addresses; with `all: false` returns the first; a name resolving to one public and one private address fails in both forms; a resolver error fails.
  - `htmlToText` (R5): paragraphs, list items and headings come out separated by a blank line; inline elements don't add breaks; a `p` inside an `li` appears once; bare text directly in a `div` is kept; `br` gives a line break; script and style content is dropped.
- **R5** **Extract** `extractUrl(url)` in `rag/extract.ts`: guarded fetch → `linkedom` `parseHTML` → `new Readability(document).parse()`. `parse()` returning `null` (no article found) → `URL_FETCH_FAILED`. The page text is `htmlToText(article.content)`: a pure helper (in `rag/html-text.ts`) that parses the HTML with `linkedom` in memory and walks the tree once in document order. It emits every text node exactly once, inserts a paragraph break before and after block elements (`p`, `div`, `section`, `article`, `li`, `h1`–`h6`, `blockquote`, `pre`, `table`, `tr`, `td`, `th`, `dt`, `dd`, `figcaption`) and a newline for `br`, skips `script` and `style`, then collapses runs of breaks into one blank line. So NB-007's chunker sees paragraphs, nested blocks aren't repeated, and text outside the listed elements isn't lost. Readability's HTML is never stored or shown, only this text. Less than 200 characters of text (`MIN_URL_TEXT_CHARS`) → `URL_FETCH_FAILED` (the page is empty or rendered by JavaScript).
- **R6** **Extractor contract.** This spec changes NB-007's extractors, which return only pages, to return `Extracted = { pages: { page: number | null; text: string }[]; title?: string; pageCount?: number }` (text returns `{ pages }`). `processSource` passes `title` (trimmed, max 80, when present) and `pageCount` to `markReady`, which gets two optional fields for them. `pageCount` is the PDF's total number of pages, including blank ones. `char_count` is the total length of the extracted text for every type.
- **R6a** **Text cap.** Extracted URL and PDF text has the same cap as pasted text, `MAX_PASTED_TEXT_CHARS` (200,000, or the lower value NB-007 R16 may set), because the same quota and time budget apply to every source. Over the cap → `LIMIT_REACHED` with a message built from the constant: for a web page "This page has more than 200,000 characters of text. Paste the part you need instead."; for a PDF "This PDF has more than 200,000 characters of text. Split it, or paste the part you need." Checked in `processSource` right after extraction, before any embedding, so a very long source fails fast and clearly instead of running into the time budget.
- **R7** **Create:** `createUrlSource(ownerId, { notebookId, url })`: `parsePublicUrl` (no DNS yet), `assertNotebookOwner`, NB-007's limits, then insert a `pending` source with `url` and a provisional title (hostname plus path, cut to 80 characters). After extraction the title becomes readability's title when it has one (R6). Server Action `createUrlSource` via `runAction`, revalidating the notebook page like `createTextSource`.

### PDF sources
- **R8** **Upload URL route** `POST /api/sources/upload-url` (`runtime = "nodejs"`, `withRoute`): body `{ notebookId, fileName, fileSize }`.
  - zod: `fileName` trimmed, 1–200 characters, ends in `.pdf` (case-insensitive), else `VALIDATION` "Choose a PDF file."; `fileSize` a positive integer. Then `assertNotebookOwner`.
  - `fileSize > MAX_PDF_BYTES` → `FILE_TOO_LARGE`; NB-007's source limits apply.
  - Insert a `pending` source with `type = 'pdf'`, title = the file name without `.pdf`, trimmed, max 80 characters, or "Untitled PDF" if that leaves nothing; `storage_path = {owner_id}/{source_id}.pdf`.
  - `createSignedUploadUrl(path)` on the `sources` bucket; return `{ sourceId, path, token }`.
- **R9** **Client upload:** the PDF tab takes one file (`accept="application/pdf"`). The client checks first: not a PDF (type `application/pdf` or name ending in `.pdf`) → "Choose a PDF file."; over 10 MB → `FILE_TOO_LARGE`'s message. Then:
  1. It calls R8. If R8 answers with the error shape (e.g. a limit, `FILE_TOO_LARGE`, `VALIDATION`, `RATE_LIMITED`), the tab shows that error's own message under the file field; nothing was created, so nothing is deleted. A network error or a body that isn't the error shape shows INTERNAL's message.
  2. It uploads with `uploadToSignedUrl(path, token, file)` and the browser client (`lib/supabase/browser.ts`, publishable key). The dialog stays open with the button showing "Uploading…". If the upload fails, the client calls `deleteSource` for the new source and shows "The upload didn't work. Try again.", so no empty `pending` source stays behind from a failed upload in an open tab.
  3. After a successful upload it closes the dialog, calls `router.refresh()` (the source was created by a route handler, so nothing revalidated; the refresh shows the pending "PDF" chip and starts polling), then starts the process call as NB-007 R14 describes.
- **R10** **Page limit.** `MAX_PDF_PAGES` becomes **100** (was 300). A PDF must meet both limits: at most 100 pages **and** at most 200,000 characters of text (R6a). A typical report page holds about 2,000 characters, so most PDFs up to 100 pages fit; a very dense one hits the character cap first, with R6a's message. Within the cap a source is at most about 230 chunks: three embedding batches plus one summary call, which fits NB-007's 45 s processing budget and the 60 s `maxDuration` (well below the 5-minute stuck window, NB-007 R12) and what NB-007 R16 checks against the free tier. The page limit also bounds the parsing work for PDFs with little text per page. The limit message is built from the constant: "PDFs can have up to 100 pages."
- **R11** **Extract** `extractPdf(storagePath, ownerId)`:
  - Check the path starts with `{ownerId}/` (defence in depth), then download from the `sources` bucket with `INGEST_DB_TIMEOUT_MS`.
  - **Missing object** (the upload never finished, e.g. the tab was closed mid-upload) → a new error code `UPLOAD_INCOMPLETE` (422, "The upload didn't finish. Delete this source and add the PDF again."), added to `shared/error-codes.ts` and ARCHITECTURE §11. Other storage errors → `INTERNAL`.
  - More than `MAX_PDF_BYTES` → `FILE_TOO_LARGE`.
  - `unpdf`: `getDocumentProxy(new Uint8Array(buffer))`; more than `MAX_PDF_PAGES` pages → `LIMIT_REACHED` with R10's message; then `extractText(pdf, { mergePages: false })`, one string per page, so page `n` gets `page = n` (1-based). Check the installed unpdf version's API.
  - Total text under 100 characters (`MIN_PDF_TEXT_CHARS`) → `NO_TEXT_FOUND`. A PDF that can't be parsed (encrypted, corrupt) → `NO_TEXT_FOUND` too, with the cause logged.
  - Returns `{ pages, pageCount }` (R6).
- **R12** **Storage cleanup:** `deleteSource` removes the source's file from the bucket after deleting the row; `deleteNotebook` (NB-006) lists the notebook's `storage_path`s (owner-scoped) before deleting and removes them after. A storage error is logged and never fails the delete (an orphaned file is harmless; the bucket is private).

### UI and fixtures
- **R13** **Add source dialog** gets three tabs in this order: "PDF", "Web page", "Paste text" (keyboard: arrow keys between tabs, Radix). The "Web page" tab has one URL input and "Add source" ("Adding…" while pending); a validation error shows under the field.
  - **Chips:** "Web page" for URLs; for PDFs "PDF" until `page_count` is set, then "n p.".
  - **Popover:** "Web page · example.org" with a link to the URL (`rel="noopener noreferrer"`, `target="_blank"`); for PDFs "PDF" or "PDF · n pages".
- **R14** **Fixtures** in `fixtures/` with a line each in `fixtures/README.md` (source URL and licence):
  - A text PDF of about 40–60 pages, under 10 MB, from a public-domain source: a US federal government publication; the implementer picks one and records the link.
  - `scanned.pdf`, an image-only PDF made on macOS from page 1 of that PDF:
    ```bash
    qlmanage -t -s 1400 -o "$TMPDIR" fixtures/<the-pdf>.pdf      # renders page 1 to a PNG
    sips -s format pdf "$TMPDIR/<the-pdf>.pdf.png" --out fixtures/scanned.pdf
    ```
    The implementer checks with `unpdf` that it yields less than 100 characters of text.
- **R15** **Docs:**
  - ARCHITECTURE §6: the guarded fetch with the pinned lookup and redirect checks (R2, R3), the full blocked ranges, `htmlToText`, the extractor contract (R6), the upload clean-up (R9), `MAX_PDF_PAGES` 100 and why (R10), the extracted-text cap (R6a); §6 "Limits": `URL_FETCH_TIMEOUT_MS`, `URL_MAX_REDIRECTS`, `MAX_URL_BYTES`, `MIN_URL_TEXT_CHARS`, `MIN_PDF_TEXT_CHARS`; §11: `UPLOAD_INCOMPLETE` and the URL `VALIDATION` messages; §10: `deleteNotebook` now removes storage files.
  - `backend/README.md` Layout: `rag/fetch-page.ts`, `rag/html-text.ts`.
  - `docs/PROGRESS.md`: M4's storage-cleanup bullet (from NB-006) is covered; "Known limitations" gets "PDFs can have up to 100 pages and 200,000 characters of text; web pages up to 200,000 characters". M4 is marked done only after the production check, not in the implementing PR.

## Design

**Files**
- Backend: `rag/{url-guard,url-guard.test,fetch-page,html-text,html-text.test,extract}.ts`, `services/{sources,notebooks}.ts`, `db/sources.ts`, `shared/{limits,error-codes}.ts`.
- Frontend: `app/api/sources/upload-url/route.ts`, `app/notebook/[id]/actions.ts`, `components/notebook/{add-source-dialog,url-source-form,pdf-source-form,source-chip,source-popover}.tsx`.
- `fixtures/` (two PDFs, README lines).

**No schema change.** The `sources` bucket (private, 10 MB, `application/pdf`) exists from `0001_init.sql` and enforces size and type on upload too.

**Rejected alternatives**
- **Global `fetch` with a DNS check before the call:** the name is resolved again on connect, so a rebinding DNS server could answer differently. Pinning the checked address in `lookup` closes that without a new dependency (`undici`'s `Agent` would need one).
- **Uploading PDFs through our route:** Vercel's 4.5 MB body limit (ARCHITECTURE §2).
- **Readability's `textContent`:** it glues paragraphs together, which the chunker needs to keep apart.
- **Keeping 300 pages with a 300 s `maxDuration`:** it would equal the 5-minute stuck window (a running source could be claimed twice) and would likely exceed the free-tier quota anyway.

**Dependencies.** `unpdf`, `@mozilla/readability`, `linkedom` (approved).

**Size.** About 700–800 changed lines of code and tests (guard, lookup and tests ~320, guarded fetch ~90, HTML text and extractors with tests ~120, upload route and service ~80, dialog tabs and upload client ~130, cleanup ~30), plus fixtures.

## Implementation

- [ ] **Implemented** (`feat/NB-008-web-pdf-sources`)
  - No user steps.
  - Acceptance:
    - CI passes, including every case in R4.
    - `grep -rn "fetch(" backend/src/rag` returns no matches: URL sources only go through `fetch-page.ts` (node:http/https).
    - On the preview, logged in:
      - An article link (e.g. a Wikipedia article) reaches `ready`; the chip says "Web page", the title is the article's title, the popover links to it (opens in a new tab), and in Supabase its chunks start at paragraph boundaries rather than mid-sentence.
      - `http://localhost:3000`, `http://127.0.0.1`, `http://169.254.169.254/latest/meta-data/` and `http://[::1]/` show "That link points to a private address." under the field, and no source row is created. `https://example.com:8080/` shows the port message.
      - A link to a PDF or an image, and a page with almost no text, fail with "We couldn't read that page. Check the link or paste the text instead."
      - The fixture PDF (~50 pages) reaches `ready`; the chip shows "PDF" while processing and "n p." after; in Supabase its chunks have `page` between 1 and n, and `page_count = n`.
      - `scanned.pdf` fails with "This PDF has no selectable text. Scanned PDFs aren't supported yet."
      - **Near limit:** a PDF of 95–100 pages with just under 200,000 characters of text (any public-domain report, not committed) reaches `ready`. If it can't within the free tier, `MAX_PDF_PAGES` is lowered to what works (with R10's message and the PROGRESS line), `MAX_PASTED_TEXT_CHARS` stays as NB-007 R16 set it, and the change is noted under "Notes". A denser PDF of at most 100 pages (over 200,000 characters) fails with R6a's PDF message.
      - A PDF of more than 100 pages fails with "PDFs can have up to 100 pages."; a password-protected PDF (made with macOS Preview → Export → Encrypt, not committed) fails with the `NO_TEXT_FOUND` message.
      - An article whose extracted text is over 200,000 characters (e.g. a long public-domain book on one HTML page) fails with R6a's web-page message.
      - With the dialog's PDF tab open in a notebook with 9 sources, add a 10th source in a second browser tab, then choose a PDF in the first: "A notebook can have up to 10 sources." shows under the file field and no chip is added.
      - An 11 MB file is refused in the browser; with the client check bypassed (curl to R8 with `fileSize` 11534336), the route answers 400 `FILE_TOO_LARGE`. A `.docx` file shows "Choose a PDF file."
      - **Upload failure:** with the Supabase storage host blocked in DevTools (request blocking), adding a PDF shows "The upload didn't work. Try again." and no chip stays behind.
      - **Abandoned upload:** a PDF source created through R8 without uploading the file (curl), after 5 minutes and "Try again", fails with the `UPLOAD_INCOMPLETE` message.
      - Deleting a PDF source and deleting a notebook with a PDF remove the files from the `sources` bucket (Storage browser).
      - The dialog's tabs work by keyboard; at 360 px the dialog fits without horizontal scroll.
    - Docs updated as in R15.
    - **After merge, on production (M4 "Done when"):** a ~50-page PDF, an article URL and a pasted text all reach `ready`, a scanned PDF fails with the right message, and a `localhost` URL is rejected.

## Open questions
None. Decided by the user (2026-11-14): the PDF limit is 100 pages plus the 200,000-character text cap (R6a, R10), and the fixture PDF is a public-domain US federal government publication picked during implementation (R14).

## Notes
Deviations found during implementation, one line each.
