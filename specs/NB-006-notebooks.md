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
  - `loading.tsx` and `not-found.tsx` for the notebook route.
- **Out:**
  - Sources (adding, listing, processing): NB-007 and NB-008. The Shelf shows its empty state and an "Add source" button that is disabled with "Available soon", like the home button in NB-005.
  - Chat: NB-009. The Ask input is shown, disabled, with the empty-state copy.
  - Removing storage files when a notebook is deleted: no sources exist yet, so NB-008 adds it together with PDF uploads.
  - Cookie banner (separate decision, see memory).

## Requirements

### Backend
- **R1** **DB helpers** in `backend/src/db/notebooks.ts`, every query filtered by `owner_id` (CLAUDE.md rule 5):
  - `listByOwner(ownerId)`: `id`, `title`, `updated_at` and the number of sources, newest `updated_at` first. The source count comes from one query (`select id, title, updated_at, sources(count)`), not one query per notebook.
  - `insert(ownerId, title)`, `updateTitle(ownerId, id, title)`, `remove(ownerId, id)`, `countByOwner(ownerId)`, and `getOwned(ownerId, id)` returning `id`, `title`, `suggested_questions`, `updated_at` (the existing `findOwned` stays for `assertNotebookOwner`).
  - Supabase errors become a plain `Error` with the PostgREST code only (same pattern as `findOwned`), so they map to `INTERNAL`.
- **R2** **Service** `backend/src/services/notebooks.ts`, each function in the shape from `backend/README.md` (validate → authorise → act):
  - `listNotebooks(ownerId)`, `getNotebook(ownerId, id)` (throws `NOT_FOUND` for a malformed, unknown or foreign ID via `assertNotebookOwner`).
  - `createNotebook(ownerId, input)` with `{ title? }`; without a title it uses the schema default "Untitled notebook". Returns `{ id }`.
  - `renameNotebook(ownerId, input)` with `{ id, title }`, `deleteNotebook(ownerId, input)` with `{ id }`.
  - **Title rule** (one zod schema, exported for the client from `@repo/backend/shared`): trimmed, 1–120 characters, no control characters. An empty title after trimming is `VALIDATION` with "Give the notebook a name."; longer than 120 is `VALIDATION` with "Names can be up to 120 characters."
  - **Limit:** at most `MAX_NOTEBOOKS_PER_OWNER` (50, new in `shared/limits.ts`) notebooks per owner; the 51st create throws `LIMIT_REACHED` with "You can have up to 50 notebooks. Delete one to make room." (count then insert; two parallel creates may overshoot by one, which is harmless).
  - Exported from `backend/src/index.ts`.
- **R3** **Tests** (vitest) for the title schema: trims, rejects empty, whitespace-only, 121 characters and control characters, accepts 120 characters and non-Latin text.

### Frontend
- **R4** **Action helper.** `frontend/src/lib/action.ts` exports `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code; message } }` and `runAction(name, fn)`: it calls `getOwnerId()` and `fn(ownerId)`, rethrows Next's control-flow errors (`unstable_rethrow`, so `redirect` and `notFound` work), maps anything else with `toErrorBody`, logs it like `withRoute` (one line, details only for unknown errors), and returns the error result. Every Server Action from here on uses it.
- **R5** **Server Actions** in `frontend/src/app/actions.ts` (home) and `frontend/src/app/notebook/[id]/actions.ts`, each as small as the example in `frontend/README.md`:
  - `createNotebook()`: creates "Untitled notebook" and redirects to `/notebook/<id>`, where the user renames it if they want.
  - `renameNotebook({ id, title })`: `revalidatePath("/")` and `revalidatePath("/notebook/<id>")`.
  - `deleteNotebook({ id })`: `revalidatePath("/")`, then redirect to `/`.
- **R6** **Home page** (`(app)/page.tsx`, a Server Component):
  - Lists the owner's notebooks with `NotebookRow` (title, "n sources · edited <date>"), newest first. The date is formatted on the server as "12 Nov" (`en-GB`, day and short month; the year is added when it isn't the current year), in UTC, so the server render is stable.
  - With no notebooks, the NB-005 empty state stays.
  - "New notebook" is a real button now: a form posting `createNotebook`, pending state "Creating…" with the button disabled while pending, and an error toast with the action's message (e.g. the limit). The "Available soon" tooltip and the mobile hint from NB-005 are removed.
- **R7** **Notebook route** `frontend/src/app/notebook/[id]/`, outside the `(app)` group so it can render its own top bar:
  - `page.tsx` awaits `params`, calls `getNotebook`; on `NOT_FOUND` it calls `notFound()`.
  - `not-found.tsx`: top bar without title, a Newsreader heading "We can't find this notebook", one graphite line "It may have been deleted, or it belongs to another browser.", and a link "Back to your notebooks". HTTP status 404.
  - `loading.tsx`: the layout with static skeletons (DESIGN.md: no pulse).
  - `metadata`: the page title is "<notebook title> · Notehooked" (`generateMetadata`, same lookup; a missing notebook gives the app name only).
- **R8** **Top bar with notebook context.** `TopBar` takes optional `title` and `actions` props. On the notebook page: the wordmark (link home), the notebook title (Plex Sans 500, truncated with an ellipsis, full title in a tooltip), a "Notebook options" icon button (dropdown with "Rename" and "Delete notebook"), and the theme toggle. Below 640 px the wordmark shows only the mark, so the title gets the room (DESIGN.md mobile wireframe).
- **R9** **Rename** opens a dialog with one input (pre-filled, selected), "Save" and "Cancel". Enter saves. Client-side the same title schema as R2 shows the error under the field without a round trip; server errors show the same way. On success the dialog closes, the title updates (via `revalidatePath`), and a toast says "Notebook renamed."
- **R10** **Delete** opens a confirmation dialog: "Delete <title>?", "Its sources and chat go with it. This can't be undone.", buttons "Delete notebook" (destructive) and "Cancel". On success the user lands on `/` with a toast "Notebook deleted." Rows of `sources`, `chunks` and `messages` go with it through the existing `on delete cascade`.
- **R11** **Notebook layout** per DESIGN.md → "Layout", with the M6 cut applied (only the Reader on the right, no Takeaways tab):
  - **Desktop (≥ 1024 px):** the Shelf strip under the top bar; below it Ask (about 60 %) and the Reader (about 40 %), split by a `rule` line.
  - **Tablet (640–1023 px):** Shelf, then Ask full width; a "Reader" button in the Ask header opens the Reader as a sheet from the right.
  - **Mobile (< 640 px):** a "Sources (0)" button opens the Shelf as a bottom sheet; Ask fills the screen; the Reader is a bottom sheet (opened in NB-010 by a citation hook; in this spec nothing opens it on mobile).
  - Layout changes only through CSS breakpoints, one component tree.
- **R12** **Empty states** (copy final, sentence case):
  - **Shelf:** "No sources yet. Add a PDF, a web page or some text to start." and the "Add source" button, `aria-disabled` with the tooltip "Available soon" (mobile: the hint as text, as in NB-005).
  - **Ask:** heading "Ask about your sources" (Newsreader), line "Add a source first. Answers come only from your sources, with a hook to each passage." The input with the placeholder "Ask about your sources…" is disabled (`aria-disabled`, tooltip "Add a source first").
  - **Reader:** "Press a numbered hook in an answer to read the passage here."
- **R13** **Quality floor** (DESIGN.md): no horizontal scroll at 360 px on `/` and `/notebook/[id]`, keyboard reachable with the focus ring, dialogs and dropdowns are the shadcn/Radix ones (focus trap, Escape closes), light and dark.
- **R14** **Docs:**
  - `docs/ARCHITECTURE.md` §10: the three actions are implemented as described; add `MAX_NOTEBOOKS_PER_OWNER` to §6 "Limits".
  - `frontend/README.md` Layout tree: `lib/action.ts`, `app/notebook/[id]/` outside `(app)`, `components/notebook/`.
  - `backend/README.md` Layout: `db/notebooks.ts`, `services/notebooks.ts`.

## Design

**Files**
- Backend: `backend/src/db/notebooks.ts`, `backend/src/services/notebooks.ts` (+ test for the title schema in `shared/notebook-title.ts`), `backend/src/shared/{limits,index}.ts`, `backend/src/index.ts`.
- Frontend: `frontend/src/lib/action.ts`, `frontend/src/app/actions.ts`, `frontend/src/app/(app)/page.tsx`, `frontend/src/app/notebook/[id]/{page,loading,not-found,actions}.tsx`, `frontend/src/components/shell/top-bar.tsx`, `frontend/src/components/home/new-notebook-button.tsx`, `frontend/src/components/notebook/{notebook-layout,shelf,ask,reader,notebook-menu,rename-dialog,delete-dialog}.tsx`.
- No schema change: the `notebooks` table and its `on delete cascade` children exist (`0001_init.sql`).

**Why the notebook route is outside `(app)`:** the `(app)` layout renders the plain `TopBar`, and a nested layout can't replace its parent's. The notebook page renders `TopBar` itself with its title and menu. URLs don't change.

**Rejected alternatives**
- **Inline title editing in the top bar:** nicer, but more states to get right (blur, Escape, empty, mobile width). A dialog reuses Radix focus handling and is demo-safe.
- **Create with a name dialog first:** one more step before the user sees the notebook. "Untitled notebook" plus rename is what most note tools do.
- **Optimistic rename and delete with `useOptimistic`:** the round trip is short and the dialogs already show a pending state; the README's "where instant feedback matters" isn't worth the rollback code here.

**Dependencies.** None new. Uses the installed shadcn `dialog`, `dropdown-menu`, `sheet`, `tooltip`, `skeleton`, `sonner`.

**Size.** About 550–700 changed lines of code and tests (service and helpers ~150, action helper ~50, home ~60, notebook layout, three areas, menu and dialogs ~400).

## Implementation

- [ ] **Implemented** (`feat/NB-006-notebooks`)
  - No user steps.
  - Acceptance:
    - CI passes (lint, typecheck, test, build), including the R3 tests.
    - `git grep -n "from(\"notebooks\")" backend/src/db` — every match is followed by an `.eq("owner_id", …)` in the same query (checked by reading, R1).
    - On the preview, logged in:
      - "New notebook" creates a notebook and opens `/notebook/<id>` titled "Untitled notebook"; the home list shows it with "0 sources · edited <today>".
      - Rename to "Climate reading": the top bar, the browser tab and the home row show the new name. An empty name and a 121-character name show the R2 messages under the field and don't save.
      - Delete asks for confirmation, lands on `/` with the toast, and the row is gone.
      - With a notebook ID changed by one character, and with `/notebook/not-a-uuid`, the page shows the not-found view and the network tab shows status 404.
      - The notebook page shows the three empty states with the R12 copy, at 1280 px (Shelf, Ask, Reader side by side), 800 px (Reader as a sheet from the right) and 360 px ("Sources (0)" bottom sheet, no horizontal scroll), in light and dark.
      - Keyboard only: create, open the menu, rename and delete work; Escape closes the dialogs.
      - Creating a 51st notebook (temporarily lowering the limit locally is fine) shows the limit message as a toast.
    - Docs updated as in R14.
    - **After merge, on production (M3 "Done when"):** create, rename and delete work, and opening one of your notebook URLs in a private window and logging in there gives a 404.

## Open questions
1. **Where rename and delete live:** only in the notebook's top bar menu (this spec), or also as a menu on each home row? Recommended: only the notebook page, so the home list stays a plain list of links.
2. **Notebook cap:** add `MAX_NOTEBOOKS_PER_OWNER = 50` (R2)? Notebooks cost no Gemini quota, but a cap keeps the demo database tidy. Recommended: yes.

## Notes
Deviations found during implementation, one line each.
