# Progress

**Current milestone:** M0

Claude Code: continue with the first unchecked task of the current milestone. Tick tasks when done, add a one-line note under a task if it deviated from the plan, and update "Current milestone" when a milestone's "Done when" is met.

## M0 · Setup (done by the user)

- [ ] Create an empty GitHub repo, clone it, copy the starter files (`CLAUDE.md`, `docs/`, `supabase/`, `vercel.json`, `.env.example`) into it, commit and push.
- [ ] Get a Gemini API key at https://aistudio.google.com ("Get API key"). Don't enable billing on that project.
- [ ] Create a Supabase project in the Frankfurt region (eu-central-1). Save the database password.
- [ ] In Supabase's SQL editor, run `supabase/migrations/0001_init.sql` once. Check that the five tables and the two storage buckets exist.
- [ ] From the Supabase dashboard, copy the project URL, the publishable (or anon) key and the secret (or service_role) key.
- [ ] Copy `.env.example` to `.env.local` and fill in all values.
- [ ] Start Claude Code in the repo folder: `claude`, then "Continue with docs/PROGRESS.md".

**Done when:** all of the above are ticked.

## M1 · Scaffold and first deployment

- [ ] Scaffold Next.js as described in CLAUDE.md → "Scaffolding"; add `typecheck` and `test` scripts; `!.env.example` in `.gitignore`.
- [ ] shadcn/ui init and base components (button, input, textarea, dialog, dropdown-menu, sheet, popover, tooltip, scroll-area, skeleton, sonner).
- [ ] `src/lib/config.ts` (with `APP_NAME = "APP_NAME"` placeholder and limits), `src/lib/errors.ts`, `src/lib/ai/models.ts`.
- [ ] Supabase clients: `src/lib/supabase/server.ts` (server-only) and `src/lib/supabase/browser.ts`.
- [ ] Owner cookie in `proxy.ts`/`middleware.ts`; `src/lib/owner.ts`.
- [ ] `GET /api/health`.
- [ ] README skeleton (title placeholder, one-paragraph description, "inspired by Google's NotebookLM" note, setup steps).
- [ ] **User:** import the repo in Vercel, add the env vars for Production and Preview, deploy.

**Done when:** production URL loads, `/api/health` returns `ok: true` and `db: true` in production, `owner_id` cookie is set.

## M2 · Name and design

- [ ] Ask the user for the app name. Offer 5 original suggestions that don't resemble NotebookLM or obvious well-known products. Set `APP_NAME`.
- [ ] Propose the design plan (CLAUDE.md rule 1 + the design process below) and wait for approval.
- [ ] Write the approved plan to `docs/DESIGN.md`.
- [ ] Implement tokens (light + dark), fonts via `next/font`, restyled shadcn base components, app shell, favicon.
- [ ] Home page: notebook list with empty state (data can still be mocked).

Design process for the plan:
- Colour: 4–6 named hex values, plus dark-mode equivalents.
- Type: one or two deliberately chosen typefaces with roles and a type scale.
- Layout: ASCII wireframe of the notebook screen (sources, chat, generated notes: same functions, own arrangement) and of the home page, including mobile.
- Principles: 3–4 sentences on what makes this app feel like its own product.
- Avoid generic AI-design defaults: cream background with terracotta accent, black with one neon accent, identical rounded cards with the same grey shadow, ALL-CAPS eyebrow labels, decorative gradients, entrance animations on everything. Spend boldness in one place.
- Quality floor: responsive to 360 px, visible keyboard focus, `prefers-reduced-motion`, sufficient contrast.

**Done when:** user approved the plan, `docs/DESIGN.md` exists, home page matches it in light and dark mode and on mobile, deployed.

## M3 · Notebooks

- [ ] `src/lib/db/` helpers for notebooks, all scoped by `owner_id`.
- [ ] Server actions: create, rename, delete notebook.
- [ ] Home page with real data.
- [ ] Notebook page shell with the three areas and their empty states; 404 for unknown or foreign ids.

**Done when:** on production, create/rename/delete works, and opening one of your notebook URLs in a private window gives 404.

## M4 · Sources and ingestion

- [ ] `rag/chunk.ts` + tests.
- [ ] `rag/url-guard.ts` + tests.
- [ ] Text source end to end (create → process → chunks → ready).
- [ ] URL source (readability, SSRF guard, timeouts, size limit).
- [ ] PDF source (signed upload URL, unpdf per page, `NO_TEXT_FOUND`).
- [ ] Source summaries.
- [ ] Notebook suggested questions.
- [ ] Sources UI: add dialog (three types), list with status, polling, retry on failed, delete, view summary, limits enforced with clear messages.
- [ ] Stuck `processing` > 5 min treated as failed and retryable.
- [ ] Add sample sources to `fixtures/` (short text, public-domain PDF).

**Done when:** on production, a ~50-page PDF, an article URL and a pasted text all reach `ready`; a scanned/image-only PDF fails with the right message; a `localhost` URL is rejected.

## M5 · Chat with citations

- [ ] `rag/retrieve.ts` and prompt builder.
- [ ] `rag/citations.ts` + tests.
- [ ] `POST /api/chat`: streaming, citation metadata, persistence, throttle.
- [ ] Chat UI: Markdown rendering, citation chips with popover, source highlighting, suggested questions, source include/exclude, disabled state without ready sources.
- [ ] Load history on page open; clear chat.
- [ ] Friendly `RATE_LIMITED` handling in the UI.

**Done when:** on production, answers cite the right passages, clicking a citation shows source, page and excerpt, a question the sources can't answer gets an honest "not in your sources" reply, and a German question gets a German answer.

**MVP checkpoint:** push, verify production, tag `v1.0-mvp`.

## M6 · Generated notes (nice-to-have)

- [ ] `POST /api/notes` for briefing, FAQ, study guide (our own feature names from the design).
- [ ] Notes area: generate, list, view, delete.

**Done when:** all three kinds generate on production from a notebook with 2+ sources.

## M7 · Audio conversation (stretch, cut first if time is short)

- [ ] Script generation (structured output).
- [ ] TTS, WAV wrapping, upload to `audio` bucket.
- [ ] Player in the notes area.

**Done when:** a 3–5 minute two-voice audio plays on production.

## M8 · Ship

- [ ] Cron visible in Vercel and `/api/health` called successfully at least once.
- [ ] README complete: description, live link, screenshots, "inspired by" note, stack, architecture diagram and key decisions (from `docs/ARCHITECTURE.md`), local setup, known limitations, how AI tools were used.
- [ ] Demo notebook prepared on production with fixture content.
- [ ] `docs/LOOM_NOTES.md`: a 10-minute outline (approach, architecture, live demo flow, trade-offs, next steps).
- [ ] Final check in a fresh private window: full flow, mobile width, dark mode, error messages, health route.

**Done when:** the user has everything for the email: repo link, live link, Loom outline.

## Decisions log

| Topic | Decision | Status |
|---|---|---|
| Stack | Next.js, Vercel, Supabase, Gemini free tier, Vercel AI SDK | decided |
| Auth | None; anonymous `owner_id` cookie | decided |
| UI language | English | decided |
| Regions | Supabase Frankfurt, Vercel fra1 | decided |
| App name | – | open (M2) |
| Design | – | open (M2) |

## Known limitations (for the README)

- Notebooks are tied to one browser (no accounts).
- Scanned PDFs without a text layer aren't supported.
- Gemini free-tier rate limits apply; heavy use shows a "try again" message.
- Processing runs in a serverless function without a queue; very large documents may time out.
