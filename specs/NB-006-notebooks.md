# NB-006 · Notebooks: create, rename, delete and the notebook screen

**Type:** feat   **Milestone:** M3   **Depends on:** NB-005

## Goal
Users can create, rename and delete their own notebooks, see them on the home page, and open a notebook screen with its three areas (Shelf, Ask, Reader) in their empty states. Someone else's notebook, or an ID that doesn't exist, gives a 404.

## Scope
- **In:**
  - DB helpers and a notebook service in `@repo/backend`, all scoped by `owner_id`.
  - Server Actions `createNotebook`, `renameNotebook`, `deleteNotebook` (ARCHITECTURE §10).
  - The home page with real data, replacing the NB-005 placeholder empty state and the "Available soon" button.
  - The notebook page `/notebook/[id]`: top bar with the notebook title and its actions, and the layout from `docs/DESIGN.md` → "Layout" (desktop, tablet, mobile) with every area in its empty state.
  - `not-found.tsx` for the notebook route, and `error.tsx` for the home and notebook routes.
- **Out:**
  - Sources (adding, listing, processing): NB-007 and NB-008. The Shelf shows its empty state and an "Add source" button that is disabled with "Available soon", like the home button in NB-005.
  - Chat: NB-009. The Ask input is shown, read-only, with the empty-state copy.
  - Removing storage files when a notebook is deleted: no sources exist yet. It comes with PDF uploads in M4 (R14 records this in ARCHITECTURE and PROGRESS).
  - A `loading.tsx` skeleton for the notebook route (R7 explains why).
  - Cookie banner: a separate decision, not part of M3.

## Requirements

### Backend
- **R1** **DB helpers** in `backend/src/db/notebooks.ts`, every query filtered by `owner_id` (CLAUDE.md rule 5):
  - `listByOwner(ownerId)`: `id`, `title`, `updated_at` and the number of sources, newest `updated_at` first. The source count comes from one query (`select id, title, updated_at, sources(count)`), not one query per notebook.
  - `insert(ownerId, title)`, `updateTitle(ownerId, id, title)`, `remove(ownerId, id)`, `countByOwner(ownerId)`, and `getOwned(ownerId, id)` returning `id`, `title`, `suggested_questions`, `updated_at` (the existing `findOwned` stays for `assertNotebookOwner`).
  - Selects, updates, deletes and counts filter with `.eq("owner_id", ownerId)`; `insert` writes `owner_id: ownerId` into the row.
  - Supabase errors become a plain `Error` with the PostgREST code only (same pattern as `findOwned`), so they map to `INTERNAL`.
- **R2** **Service** `backend/src/services/notebooks.ts`, each function in the shape from `backend/README.md` (validate → authorise → act):
  - `listNotebooks(ownerId)`, `getNotebook(ownerId, id)` (throws `NOT_FOUND` for a malformed, unknown or foreign ID via `assertNotebookOwner`).
  - `createNotebook(ownerId)`: creates a notebook titled "Untitled notebook" (the schema default). Returns `{ id }`.
  - `renameNotebook(ownerId, input)` with `{ id, title }`, `deleteNotebook(ownerId, input)` with `{ id }`. Both call `assertNotebookOwner` first, so a notebook deleted in another tab gives `NOT_FOUND`.
  - **Title rule:** one zod schema `NotebookTitle` in `backend/src/shared/notebook-title.ts`, exported from `@repo/backend/shared` so the rename dialog uses the same rule:
    - Trimmed first. Then, in this order: empty → "Give the notebook a name."; any control character (Unicode category Cc, which includes line breaks and tabs) → "Names can't contain line breaks or control characters."; longer than 120 → "Names can be up to 120 characters.".
    - The length is zod's `.max(120)`, i.e. UTF-16 code units. That's simple and predictable; an emoji counts as two.
  - **Limit:** at most `MAX_NOTEBOOKS_PER_OWNER` (50, new in `shared/limits.ts`) notebooks per owner. Creating one more throws `LIMIT_REACHED` with a message built from the constant: "You can have up to 50 notebooks. Delete one to make room." Count then insert: two parallel creates may overshoot by one, which is harmless.
  - Exported from `backend/src/index.ts`.
- **R3** **Tests** (vitest) for `NotebookTitle`: trims; rejects empty, whitespace-only, a title with a newline, a title with a tab, and 121 characters, each with its message; accepts 120 characters, German umlauts and Japanese text.

### Frontend
- **R4** **Action helper.** `frontend/src/lib/action.ts` exports `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }` and `runAction(name, fn)`: it calls `getOwnerId()` and `fn(ownerId)`, rethrows Next's control-flow errors (`unstable_rethrow`, so `redirect` works), maps anything else with `toErrorBody`, logs it like `withRoute` (one line; details only for errors that aren't a plain `AppError`), and returns the error result. Every Server Action from here on uses it.
- **R5** **Server Actions**, each as small as the updated example in `frontend/README.md` (R14):
  - `frontend/src/app/actions.ts` → `createNotebook(_previous: ActionResult<never> | null, _form: FormData)`: the `useActionState` signature. On success it calls `revalidatePath("/")` and `redirect("/notebook/<id>")`; on failure it returns the error result.
  - `frontend/src/app/notebook/[id]/actions.ts` → `renameNotebook({ id, title })`: returns `ActionResult<{ id }>` and calls `revalidatePath("/")` and `revalidatePath("/notebook/<id>")`.
  - Same file → `deleteNotebook({ id })`: returns `ActionResult<null>` and calls `revalidatePath("/")`. It does **not** redirect; the client does (R10), so it can show the toast first.
- **R6** **Home page** (`(app)/page.tsx`, a Server Component):
  - Lists the owner's notebooks with `NotebookRow` (title, "n sources · edited <date>"), newest first. The date is formatted on the server as "12 Nov" (`en-GB`, day and short month; the year is added when it isn't the current year), in UTC, so the server render is stable.
  - With no notebooks, the NB-005 empty state stays.
  - "New notebook" is a real button now: a client leaf with `useActionState(createNotebook, null)`, a `<form action>`, the label "Creating…" and `disabled` while pending (a real `disabled`, since it's only for the moment of the request), and an error toast with the action's message (e.g. the limit). The "Available soon" tooltip and the mobile hint from NB-005 are removed.
- **R7** **Notebook route** `frontend/src/app/notebook/[id]/`, outside the `(app)` group so it can render its own top bar:
  - `page.tsx` awaits `params` and calls `getNotebook`; on `NOT_FOUND` it calls `notFound()`.
  - **No `loading.tsx`** in this route (and no `<Suspense>` around the lookup): a loading fallback starts streaming with status 200, after which `notFound()` can't set 404 any more (Next 16 docs, `loading.md` → "Status codes"). The lookup is two small indexed queries, so the page renders without a skeleton. Later specs that stream slow parts wrap only those parts in `<Suspense>`, below the `notFound()` check.
  - `not-found.tsx`: top bar without title, a Newsreader heading "We can't find this notebook", one graphite line "It may have been deleted, or it belongs to another browser.", and a link "Back to your notebooks". HTTP status 404.
  - `metadata`: the page title is `${notebook.title} · ${APP_NAME}` (`generateMetadata`, same lookup; a missing notebook gives `APP_NAME` alone).
- **R8** **Error pages.** `error.tsx` (a Client Component, as Next requires) in `app/(app)/` and in `app/notebook/[id]/`: the top bar's place stays empty, a Newsreader heading "Something went wrong", the `INTERNAL` message from `@repo/backend/shared` ("Something went wrong on our side. Try again."), and a "Try again" button that calls `reset()`. It never shows `error.message` or a stack trace. This covers a slow or paused database on `/` and `/notebook/[id]` (CLAUDE.md rule 4).
- **R9** **Top bar with notebook context.** `TopBar` takes optional `title` and `actions` props. On the notebook page: the wordmark (link home), the notebook title (Plex Sans 500, truncated with an ellipsis, full title in a tooltip), a "Notebook options" icon button (dropdown with "Rename" and "Delete notebook"), and the theme toggle. Below 640 px the wordmark shows only the mark, so the title gets the room (DESIGN.md mobile wireframe).
- **R10** **Rename and delete dialogs:**
  - **Rename:** one input (pre-filled, selected), "Save" and "Cancel". Enter saves. The same `NotebookTitle` schema validates on the client and shows its message under the field without a round trip; server errors show the same way. While saving: "Saving…", both buttons and the input disabled, and the dialog can't be closed (Escape and the scrim do nothing). On success the dialog closes, the title updates (via `revalidatePath`), and a toast says "Notebook renamed."
  - **Delete:** a confirmation dialog: "Delete <title>?", "Its sources and chat go with it. This can't be undone.", buttons "Delete notebook" (destructive) and "Cancel". While deleting: "Deleting…", both buttons disabled, the dialog can't be closed. On success the client shows the toast "Notebook deleted." and calls `router.replace("/")` (the toast lives in the root layout's `Toaster`, so it survives the navigation). On failure the dialog stays open and a toast shows the action's message; `NOT_FOUND` (already deleted in another tab) is treated as success.
  - Rows of `sources`, `chunks` and `messages` go with a deleted notebook through the existing `on delete cascade`.
- **R11** **Notebook layout** per DESIGN.md → "Layout", with the M6 cut applied (only the Reader on the right, no Takeaways tab):
  - **Desktop (≥ 1024 px):** the Shelf strip under the top bar; below it Ask (about 60 %) and the Reader (about 40 %), split by a `rule` line.
  - **Tablet (640–1023 px):** Shelf, then Ask full width; a "Reader" button in the Ask header opens the Reader as a sheet from the right.
  - **Mobile (< 640 px):** a "Sources (0)" button opens the Shelf as a bottom sheet; Ask fills the screen; the Reader is a bottom sheet (opened in NB-010 by a citation hook; in this spec nothing opens it on mobile).
  - Layout changes only through CSS breakpoints, one component tree.
- **R12** **Empty states** (copy final, sentence case):
  - **Shelf:** "No sources yet. Add a PDF, a web page or some text to start." and the "Add source" button, `aria-disabled` with the tooltip "Available soon" (mobile: the hint as text, as in NB-005).
  - **Ask:** heading "Ask about your sources" (Newsreader), line "Add a source first. Answers come only from your sources, with a hook to each passage." The input with the placeholder "Ask about your sources…" is `aria-disabled` **and** `readOnly`, with no submit handler, and the tooltip "Add a source first".
  - **Reader:** "Press a numbered hook in an answer to read the passage here."
- **R13** **Quality floor** (DESIGN.md): no horizontal scroll at 360 px on `/` and `/notebook/[id]`, keyboard reachable with the focus ring, dialogs and dropdowns are the shadcn/Radix ones (focus trap, Escape closes when not pending), light and dark.
- **R14** **Docs:**
  - `docs/ARCHITECTURE.md` §10: `createNotebook` takes no input (the title starts as "Untitled notebook"); `deleteNotebook` gets the note "storage files are removed from M4 on, with PDF uploads"; §6 "Limits" gets `MAX_NOTEBOOKS_PER_OWNER`.
  - `docs/PROGRESS.md` M4: a new bullet "Deleting a notebook removes the PDFs of its sources from storage."
  - `frontend/README.md`: the Layout tree (`lib/action.ts`, `app/notebook/[id]/` outside `(app)` with `page`, `not-found`, `error`, `actions`, `components/notebook/`, `error.tsx` in `(app)/`); the Server Action example is replaced by one that uses `runAction` and returns an `ActionResult`; "useOptimistic where instant feedback matters" becomes "useOptimistic only where it's worth the rollback code".
  - `backend/README.md` Layout: `db/notebooks.ts`, `services/notebooks.ts`, `shared/notebook-title.ts`.

## Design

**Files**
- Backend: `backend/src/db/notebooks.ts`, `backend/src/services/notebooks.ts`, `backend/src/shared/{notebook-title,notebook-title.test,limits,index}.ts`, `backend/src/index.ts`.
- Frontend: `frontend/src/lib/action.ts`, `frontend/src/app/actions.ts`, `frontend/src/app/(app)/{page,error}.tsx`, `frontend/src/app/notebook/[id]/{page,not-found,error}.tsx`, `frontend/src/app/notebook/[id]/actions.ts`, `frontend/src/components/shell/top-bar.tsx`, `frontend/src/components/home/new-notebook-button.tsx`, `frontend/src/components/notebook/{notebook-layout,shelf,ask,reader,notebook-menu,rename-dialog,delete-dialog}.tsx`.
- No schema change: the `notebooks` table and its `on delete cascade` children exist (`0001_init.sql`).

**Why the notebook route is outside `(app)`:** the `(app)` layout renders the plain `TopBar`, and a nested layout can't replace its parent's. The notebook page renders `TopBar` itself with its title and menu. URLs don't change.

**Rejected alternatives**
- **A `loading.tsx` skeleton:** it would start streaming before `notFound()`, so foreign IDs would get a 200 with `noindex` instead of the 404 that ARCHITECTURE §4 and M3's "Done when" promise.
- **Redirecting from `deleteNotebook` on the server:** the client code after the action never runs, so it can't show the toast; a search-param or cookie "flash" would be extra machinery for one message.
- **Inline title editing in the top bar:** more states to get right (blur, Escape, empty, mobile width). A dialog reuses Radix focus handling and is demo-safe.
- **Create with a name dialog first:** one more step before the user sees the notebook. "Untitled notebook" plus rename is what most note tools do.
- **Optimistic rename and delete with `useOptimistic`:** the round trip is short and the dialogs show a pending state; not worth the rollback code here.

**Dependencies.** None new. Uses the installed shadcn `dialog`, `dropdown-menu`, `sheet`, `tooltip`, `sonner`.

**Size.** About 600–750 changed lines of code and tests (service, helpers and title schema with tests ~180, action helper ~50, home ~60, error and not-found pages ~50, notebook layout, three areas, menu and dialogs ~400).

## Implementation

- [ ] **Implemented** (`feat/NB-006-notebooks`)
  - No user steps.
  - Acceptance:
    - CI passes (lint, typecheck, test, build), including the R3 tests.
    - Every select, update, delete and count in `backend/src/db/notebooks.ts` has `.eq("owner_id", ownerId)`, and `insert` sets `owner_id: ownerId` in the row (checked by reading, R1).
    - On the preview, logged in:
      - "New notebook" shows "Creating…", then opens `/notebook/<id>` titled "Untitled notebook"; the home list shows it with "0 sources · edited <today>".
      - Rename to "Climate reading": the top bar, the browser tab ("Climate reading · Notehooked") and the home row show the new name. An empty name, a name with a pasted tab character and a 121-character name show the R2 messages under the field and don't save. (Browsers strip line breaks from a single-line input, so newlines are covered by the R3 tests.)
      - Delete asks for confirmation, shows "Deleting…", lands on `/` with the toast "Notebook deleted.", and the row is gone. Deleting the same notebook from a second tab that still shows it also lands on `/` without an error.
      - With a notebook ID changed by one character, and with `/notebook/not-a-uuid`, the page shows the not-found view, and the network tab shows status **404** for the document request.
      - The notebook page shows the three empty states with the R12 copy, at 1280 px (Shelf strip on top, Ask and Reader side by side), 800 px (Reader as a sheet from the right) and 360 px ("Sources (0)" bottom sheet, no horizontal scroll), in light and dark. Typing into the Ask input does nothing.
      - Keyboard only: create, open the menu, rename and delete work; Escape closes the dialogs when nothing is pending.
      - Creating a notebook past the limit (with `MAX_NOTEBOOKS_PER_OWNER` temporarily set to 2 locally) shows "You can have up to 2 notebooks. Delete one to make room." as a toast.
    - Locally, with `NEXT_PUBLIC_SUPABASE_URL=https://unreachable.invalid` set temporarily, then `npm run build` and `npm start -w frontend` (production mode, so no dev overlay; the `.invalid` name fails fast): `/` and `/notebook/<id>` show the R8 error page with "Try again", no stack trace and no raw error text.
    - Docs updated as in R14.
    - **After merge, on production (M3 "Done when"):** create, rename and delete work, and opening one of your notebook URLs in a private window and logging in there gives a 404.

## Open questions
1. **Where rename and delete live:** only in the notebook's top bar menu (this spec), or also as a menu on each home row? Recommended: only the notebook page, so the home list stays a plain list of links.
2. **Notebook cap:** add `MAX_NOTEBOOKS_PER_OWNER = 50` (R2)? Notebooks cost no Gemini quota, but a cap keeps the demo database tidy. Recommended: yes.

## Notes
Deviations found during implementation, one line each.
