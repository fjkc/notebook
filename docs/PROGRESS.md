# Progress

The roadmap. Each milestone lists its scope and a "Done when" that is checked on production. Work on a milestone happens through specs and PRs (`WORKFLOW.md`). Progress on individual tasks lives in the specs, not here. This file only records whether a milestone is open or done.

## M0 · Setup (user) · done

Follow `infra/README.md` → "Setup from scratch", steps 1–5: Gemini key, Supabase project, schema, keys, `frontend/.env.local`.

**Done when:** `frontend/.env.local` is filled in and the schema is applied.

## M1 · Tooling, scaffold and first deployment · done

1. **Tooling (next up):** project slash commands so the workflow runs the same way every time:
   - `/spec`: propose or write the next spec on a `docs/NB-XXX-spec` branch and open the spec PR.
   - `/implement NB-XXX[.n]`: check the spec is merged, branch, implement, verify, tick, open the PR.
   - Both follow `WORKFLOW.md` and don't duplicate it.
2. **Scaffold** the workspaces (see "Scaffolding notes" below): root `package.json` with workspaces and fan-out scripts, Next.js in `frontend/`, `@repo/backend` with vitest. `npm run build` passes from the root.
3. **Infra · CI:** a GitHub Actions workflow running lint, typecheck, test and build on every PR and on `main`.
4. shadcn/ui init and base components (button, input, textarea, dialog, dropdown-menu, sheet, popover, tooltip, scroll-area, skeleton, sonner).
5. Foundations: `APP_NAME` placeholder, limits, error codes and `AppError`, model IDs, error-to-response helper.
6. Supabase clients: server (backend, secret key) and browser (frontend, publishable key, uploads only).
7. Owner cookie in `proxy.ts`/`middleware.ts`, `getOwnerId()`, `assertNotebookOwner()`.
8. `GET /api/health`.
9. README skeleton: title placeholder, one-paragraph description, "inspired by Google's NotebookLM" note, setup steps.
10. **User:** import the repo in Vercel (`infra/README.md` → step 6) and deploy.
11. Access gate (NB-003): one shared password, login page, gate in the proxy and in `getOwnerId()`.

**Done when:** the production URL loads, `/api/health` returns `ok: true` and `db: true` in production, the `owner_id` cookie is set, CI runs on PRs, and without the password the production URL shows only the login page.

### Scaffolding notes
Done in NB-002.1 on Node 26 (pinned in `.nvmrc` and `engines.node: "26.x"`). `frontend/` wasn't empty, and create-next-app refuses non-empty folders and names starting with a dot, so it ran in a subfolder of the gitignored `.scaffold/`:

```bash
npx create-next-app@latest .scaffold/app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --skip-install --yes
# move the files into frontend/ without overwriting (README.md, .env.example, vercel.json kept),
# drop its .gitignore (the root one covers it), next-env.d.ts, public/ logos and favicon; delete .scaffold/
npm i -D -w backend vitest "typescript@^5" "@types/node@^26"
npm i -w backend server-only
npm install
```
Then `transpilePackages: ["@repo/backend"]` in `frontend/next.config.ts`, `"@repo/backend": "*"` in `frontend/package.json`, and the scripts: `typecheck` is `next typegen && tsc --noEmit` in `frontend/` and `tsc --noEmit` in `backend/`, `test` is `vitest run --passWithNoTests` in `backend/`.

Every other dependency is installed by the spec that first uses it (NB-002 → "Dependencies"): shadcn and `zod` in NB-002.3, `@supabase/supabase-js` in NB-002.4, the AI and extraction packages in later milestones.

## M2 · Name and design · done

- The user picks the app name from 5 original suggestions that don't resemble NotebookLM or well-known products. Chosen: **Notehooked** (NB-005).
- Design plan proposed and approved, then written to `docs/DESIGN.md`:
  - Colour: 4–6 named hex values plus dark-mode equivalents.
  - Type: one or two deliberately chosen typefaces with roles and a type scale.
  - Layout: ASCII wireframes of the notebook screen (sources, chat, generated notes: same functions, own arrangement) and the home page, including mobile.
  - Principles: 3–4 sentences on what makes this app feel like its own product.
  - Avoid generic AI-design defaults: cream background with terracotta accent, black with one neon accent, identical rounded cards with the same grey shadow, ALL-CAPS eyebrow labels, decorative gradients, entrance animations on everything. Spend boldness in one place.
  - Quality floor: responsive to 360 px, visible keyboard focus, `prefers-reduced-motion`, sufficient contrast.
- Tokens (light and dark), fonts via `next/font`, restyled shadcn components, app shell, favicon.
- Home page: notebook list with empty state (data may be mocked).

**Done when:** `docs/DESIGN.md` exists and the deployed home page matches it in light and dark mode and on mobile.

## M3 · Notebooks · open

- DB helpers and notebook service, all scoped by `owner_id`.
- Server actions: create, rename, delete notebook.
- Home page with real data.
- Notebook page shell with the three areas and their empty states. Unknown or foreign IDs return 404.

**Done when:** on production, create, rename and delete work, and opening one of your notebook URLs in a private window and logging in there gives a 404.

## M4 · Sources and ingestion · open

- Chunker and URL guard, with tests.
- Text source end to end (create → process → chunks → ready).
- URL source (readability, SSRF guard, timeouts, size limit).
- PDF source (signed upload URL, unpdf per page, `NO_TEXT_FOUND`).
- Source summaries.
- Sources UI: add dialog (three types), list with status, polling, retry on failed, delete, view summary, limits enforced with clear messages.
- Stuck `processing` for more than 5 min is treated as failed and retryable.
- Deleting a notebook removes the PDFs of its sources from storage (NB-008, along with deleting a single PDF source).
- Sample sources in `fixtures/` (short text, public-domain PDF).

**Done when:** on production, a multi-page PDF within the text cap (the 32-page fixture `fixtures/nist-csf-2.0.pdf`), an article URL and a pasted text all reach `ready`, a scanned PDF fails with the right message, and a `localhost` URL is rejected.

## M5 · Chat with citations · open

- Retrieval and prompt builder.
- Citation parser, with tests.
- `POST /api/chat`: streaming, citation metadata, persistence, throttle.
- Chat UI: Markdown rendering, citation hooks that open the Reader (`docs/DESIGN.md` → "Layout"), source highlighting on the Shelf, suggested questions, source include/exclude, disabled state without ready sources.
- History on page open, clear chat, friendly `RATE_LIMITED` handling.
- Notebook suggested questions from ready summaries (moved from M4, NB-010).

**Done when:** on production, answers cite the right passages, a citation shows source, page and excerpt, an unanswerable question gets an honest "not in your sources" reply, and a German question gets a German answer. Then tag `v1.0-mvp`.

## M6 · Generated notes (nice-to-have) · cut

**Cut on 2026-11-14** (user decision): the scope is M3–M5 and M8, so the core works reliably. Kept below as a sketch for "next steps"; not planned.

- `POST /api/notes` for three kinds (briefing, FAQ, study guide, with our own names from the design).
- Notes area: generate, list, view, delete.

**Done when:** all three kinds generate on production from a notebook with 2+ sources.

## M7 · Audio conversation (stretch) · cut

**Cut on 2026-11-14** (user decision): the scope is M3–M5 and M8, so the core works reliably. Kept below as a sketch for "next steps"; not planned.

- Script generation (structured output), TTS, WAV wrapping, upload to the `audio` bucket, player in the notes area.

**Done when:** a 3–5 minute two-voice audio plays on production.

## M8 · Ship · open

- Cron visible in Vercel, with `/api/health` called successfully at least once.
- README complete: description, live link, screenshots, "inspired by" note, stack, architecture diagram and key decisions, workflow (specs and PRs), local setup, known limitations, how AI tools were used.
- Demo notebook on production with fixture content.
- `docs/LOOM_NOTES.md`: a 10-minute outline (approach, architecture, live demo, trade-offs, next steps).
- Final check in a fresh private window: full flow, mobile width, dark mode, error messages, health route.

**Done when:** the user has everything for the email: repo link, live link, Loom outline.

## Decisions log

| Topic | Decision | Status |
|---|---|---|
| Stack | Next.js, Vercel, Supabase, Gemini free tier, Vercel AI SDK | decided |
| Auth | Shared password gate + anonymous `owner_id` cookie | decided |
| UI language | English | decided |
| Regions | Supabase Frankfurt, Vercel fra1 | decided |
| Repo layout | npm workspaces: `frontend/` (deployed), `backend/` (`@repo/backend` library), `infra/`; one Vercel deployment | decided |
| Branch protection | None; `main` stays unprotected, CI runs on every PR | decided |
| Workflow | Spec-driven; specs and code reach `main` only via PRs; merging a spec PR approves it; one implementation PR per spec, no subtasks (from NB-004) | decided |
| Review rounds | Every PR Claude opens gets two `/review` rounds with fixes right after it's opened; the user reviews and merges after that (NB-011) | decided |
| App name | Notehooked | decided |
| Design | `docs/DESIGN.md` (NB-005) | decided |
| Scope | M0–M5 and M8. M6 (generated notes) and M7 (audio) are cut, so the core (sources, grounded chat, citations) gets the time | decided |

## Known limitations (for the README)

- Notebooks are tied to one browser (no accounts).
- Scanned PDFs without a text layer aren't supported.
- Gemini free-tier rate limits apply; heavy use shows a "try again" message. Pasted text is capped at 80,000 characters to fit the embedding limit, chat answers and source summaries share a Flash-Lite quota of 500 requests a day (summaries are skipped when it runs out), and embeddings for sources and questions share 1,000 requests a day.
- PDFs can have up to 100 pages and 80,000 characters of text; web pages up to 80,000 characters (the pasted-text cap, set by the embedding free tier). Longer documents fail with a message asking to split them or paste the part needed.
- Web pages that need a login, sit behind a paywall or render their text with JavaScript can't be read; only `text/html` pages up to 5 MB on the default ports.
- Processing runs in a serverless function without a queue; very large documents may time out.
- "Try again" on a failed source isn't throttled, so a web page source can be fetched again on every retry (public addresses only). Acceptable behind the password gate.
- The hourly source limit counts existing sources, so deleting one frees room, and "Try again" isn't limited. Acceptable behind the password gate.
- No generated notes or audio recaps: cut to keep the core reliable (M6, M7); they are the natural next features.
