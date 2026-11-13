# NB-002 · Scaffold and first deployment

**Type:** feat   **Milestone:** M1   **Depends on:** – (M0 setup by the user before NB-002.4 is verified, see Subtasks)

## Goal
The repo becomes a working app: an empty Next.js shell with the backend package, the shared foundations (errors, limits, models, logging), the Supabase clients, anonymous ownership by cookie and a health check, deployed to Vercel with CI on every PR. After this, M3 can start building features on a deployed base, and M1's "Done when" in `docs/PROGRESS.md` can be checked on production.

## Scope
- **In:** `docs/PROGRESS.md` → M1 tasks 2–10 (task 1, tooling, was NB-001):
  - npm workspaces with `frontend/` (Next.js) and `backend/` (`@repo/backend`), root fan-out scripts.
  - GitHub Actions CI and the branch protection step for the user.
  - shadcn/ui init with the base components, `APP_NAME` placeholder, limits, error codes and `AppError`, model IDs, structured logging, error-to-response helper.
  - Supabase server and browser clients, the owner cookie, `getOwnerId()`, `assertNotebookOwner()`.
  - `GET /api/health`, root README skeleton, first Vercel deployment.
- **Out:**
  - Any feature: notebooks UI, sources, chat (M3 onwards).
  - Design: name, colours, fonts, restyled components (M2). The placeholder UI stays neutral and unbranded.
  - Schema changes. `infra/supabase/migrations/0001_init.sql` is used as is.
  - Prompts and AI calls. Only `models.ts` with the IDs is added; `prompts.ts` comes with the first feature that uses a prompt.
  - Rate limiting and the per-owner throttles (they arrive with sources in M4).

## Requirements

### Workspaces and scripts (NB-002.1)
- **R1** The repo is an npm workspaces monorepo as in `docs/ARCHITECTURE.md` → "Code layout" and the folder READMEs: root `package.json` (private, `workspaces: ["frontend", "backend"]`), one `package-lock.json` at the root, no other lockfiles.
- **R2** The root scripts `dev`, `lint`, `typecheck`, `test`, `build` exist and fan out to the workspaces, so the commands in `CLAUDE.md` → "Commands" work from the root. `lint` covers `frontend/` with the ESLint flat config that create-next-app generates (`next lint` no longer exists in Next 16; the script calls `eslint` directly). `typecheck` runs `tsc --noEmit` in both workspaces. `test` runs vitest in `backend/`.
- **R3** `frontend/` is a Next.js App Router app (latest stable major at implementation time; this spec assumes 16, which uses `proxy.ts`) with TypeScript strict, Tailwind v4, `src/` dir and the `@/*` alias, created as in `docs/PROGRESS.md` → "Scaffolding notes". The existing `frontend/README.md`, `.env.example` and `vercel.json` are kept. `next.config.ts` has `transpilePackages: ["@repo/backend"]`.
- **R4** `backend/` is `@repo/backend` as sketched in `backend/README.md` → "Package entry points": exports `.` (`src/index.ts`, starts with `import "server-only"`) and `./shared` (`src/shared/index.ts`), `vitest.config.ts` with the `server-only` alias, TypeScript strict.
- **R5** The create-next-app placeholder page is replaced by a minimal neutral page (one heading with a working title, no Vercel or Next.js logos, no default metadata like "Create Next App").
- **R6** Node version: one major, pinned via `engines.node` in the root `package.json` and an `.nvmrc`, used by CI and Vercel. Use the current Active LTS at implementation time (Node 24 as of writing).
- **R7** `npm run build` passes **without any env vars set**. Nothing reads env at import time (`backend/README.md` → "Code style").

### CI (NB-002.2)
- **R8** `.github/workflows/ci.yml` runs on `pull_request` and on `push` to `main`: checkout, setup-node from `.nvmrc` with npm cache, `npm ci`, then `lint`, `typecheck`, `test`, `build`. One job named `checks`, so branch protection can require it by name.
- **R9** The workflow has `permissions: contents: read` at the top level, no secrets, and `concurrency` that cancels superseded runs of the same PR. Actions are pinned to a major version tag (`actions/checkout@v5` or current).

### Foundations (NB-002.3)
- **R10** shadcn/ui is initialised in `frontend/` for Tailwind v4, with the components listed in `docs/PROGRESS.md` → M1 task 4 (button, input, textarea, dialog, dropdown-menu, sheet, popover, tooltip, scroll-area, skeleton, sonner). Default shadcn styling is kept until M2. The `sonner` `<Toaster />` is mounted in the root layout.
- **R11** `frontend/src/lib/config.ts` exports `APP_NAME` with a neutral placeholder (`"Untitled notebook app"`). The root layout's `metadata.title` uses it. No other place hard-codes a name (CLAUDE.md rule 1).
- **R12** `backend/src/shared/limits.ts` holds every limit from `docs/ARCHITECTURE.md` → "Limits", as named constants.
- **R13** `backend/src/shared/error-codes.ts` defines every code from `docs/ARCHITECTURE.md` → "Errors" with its HTTP status and user-facing message. `backend/src/errors.ts` defines `AppError` (carries `code`, optional specific message for `VALIDATION` and `LIMIT_REACHED`) and `toUserMessage()`. A `ZodError` is mapped to `VALIDATION` with a short message built from the first issue.
- **R14** `backend/src/ai/models.ts` holds the model IDs: the latest stable Gemini Flash text model and the current embedding model, checked against https://ai.google.dev/gemini-api/docs/models at implementation time, plus the embedding dimension `768`. No other file contains a model ID.
- **R15** `backend/src/log.ts` writes one structured JSON line per operation (`docs/ARCHITECTURE.md` → "Observability"). It accepts only an allow-list of fields (route, owner prefix, duration, outcome, error code), so secrets or document text can't be logged by accident.
- **R16** `frontend/src/lib/http.ts` exports `toErrorResponse(error)` (returns `{ error: { code, message } }` with the code's status; unknown errors become `INTERNAL`, their details only go to the log) and `withRoute(name, handler)` (wraps a Route Handler: catches everything, logs one line with duration and outcome).
- **R17** Unit tests (vitest) cover: every error code has a status and a message, `ZodError` maps to `VALIDATION`, an unknown error maps to `INTERNAL`, and the log line drops fields that aren't allow-listed.

### Data access and ownership (NB-002.4)
- **R18** `backend/src/env.ts` validates env with zod, lazily, **per group**: `getSupabaseEnv()` (URL + secret key) and `getGeminiEnv()` (API key), each parsed on first call. A missing variable throws an error naming the variable (logged server-side, mapped to `INTERNAL` for the user). The health check therefore works without the Gemini key.
- **R19** `backend/src/supabase.ts` (`import "server-only"`) creates the server client lazily with the secret key and `auth: { persistSession: false, autoRefreshToken: false }`. `frontend/src/lib/supabase/browser.ts` creates the browser client with the publishable key, and is only exported for `uploadToSignedUrl` (`docs/ARCHITECTURE.md` → "Runtime configuration").
- **R20** `frontend/src/proxy.ts` sets the `owner_id` cookie as in `docs/ARCHITECTURE.md` → "Ownership", with two changes recorded there in this subtask:
  - **Same-request visibility:** when the cookie is missing, the new value is set on the **response** and also on the forwarded **request** (`NextResponse.next({ request: { headers } })`), so `getOwnerId()` sees it on the very first visit instead of throwing `UNAUTHORIZED`.
  - **`secure`:** `true` in production, `false` in development, so the cookie also works on `http://localhost` in every browser.
  - The matcher excludes `_next/static`, `_next/image`, `favicon.ico` and `api/health` (the cron needs no cookie). Server Actions stay covered because they post to page routes.
  - An existing cookie that isn't a UUID is replaced with a new one.
- **R21** `frontend/src/lib/owner.ts` exports `getOwnerId()`: awaits `cookies()`, returns the value if it's a UUID, otherwise throws `AppError("UNAUTHORIZED")`.
- **R22** `backend/src/db/notebooks.ts` has the first owner-scoped helper (`findOwned(ownerId, id)`, filtered by `owner_id` and `id`), and `backend/src/services/ownership.ts` exports `assertNotebookOwner(ownerId, notebookId)`: validates both as UUIDs with zod, throws `NOT_FOUND` when no row comes back (also for a malformed ID, so IDs can't be probed). A unit test with an injected fake `findOwned` covers found, not found and malformed ID.

### Health and deployment (NB-002.5)
- **R23** `GET /api/health` (`runtime = "nodejs"`, `dynamic = "force-dynamic"`) runs one cheap query through the backend (`select id from notebooks limit 1`) with a 5-second timeout and returns `{ ok, db, timestamp }`:
  - Database reachable: `200`, `{ ok: true, db: true }`.
  - Query fails, times out or env is missing: `503`, `{ ok: false, db: false }`. The reason is only logged.
  - The response never contains error details, keys or URLs. It sets `Cache-Control: no-store`.
- **R24** Root `README.md` skeleton: title from a placeholder (to be replaced with `APP_NAME` in M2), a one-paragraph description, the factual note that the project is inspired by Google's NotebookLM and uses the Gemini API (no logos, no implied affiliation, CLAUDE.md rule 1), a "Run locally" section pointing to `infra/README.md` → "Setup from scratch", and links to `docs/ARCHITECTURE.md` and `WORKFLOW.md`.
- **R25** `infra/README.md` → step 6 is checked against the real Vercel import and corrected if needed (install from the repo root with the root lockfile, Root Directory `frontend`, files outside the root included, Node version from R6).

## Design

**Files**
- Root: `package.json`, `package-lock.json`, `.nvmrc`, `README.md`.
- `.github/workflows/ci.yml`.
- `frontend/`: the create-next-app output (`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/{layout,page}.tsx`, `src/app/globals.css`), `components.json`, `src/components/ui/*` (shadcn, generated), `src/lib/{config,http,owner}.ts`, `src/lib/supabase/browser.ts`, `src/proxy.ts`, `src/app/api/health/route.ts`.
- `backend/`: `package.json`, `tsconfig.json`, `vitest.config.ts`, `test/empty.ts`, `src/index.ts`, `src/env.ts`, `src/errors.ts`, `src/log.ts`, `src/supabase.ts`, `src/db/notebooks.ts`, `src/services/ownership.ts`, `src/services/health.ts`, `src/ai/models.ts`, `src/shared/{index,limits,error-codes}.ts`, plus tests next to the code.
- Docs: `docs/ARCHITECTURE.md` → "Ownership" (R20 changes) and "Keep-alive and health" (status codes from R23), `infra/README.md` step 6 and 8 if they change.

**Dependencies.** All are on the approved list in CLAUDE.md or come with the stack (Next.js, React, TypeScript, Tailwind, ESLint from create-next-app, shadcn and its dependencies). They are installed **in the subtask that first uses them**, not all at once in the scaffold as `docs/PROGRESS.md` → "Scaffolding notes" lists, so each PR only adds what it uses:
- NB-002.1: create-next-app output, `vitest`, `typescript`, `server-only`.
- NB-002.3: shadcn and its dependencies (incl. `sonner`, `lucide-react`), `zod`.
- NB-002.4: `@supabase/supabase-js`.
- Later milestones: `ai`, `@ai-sdk/google`, `@ai-sdk/react`, `unpdf`, `@mozilla/readability`, `linkedom`, `react-markdown`, `remark-gfm`.

**Health check shape.** `backend/src/services/health.ts` exports `checkDatabase(): Promise<boolean>` (never throws, logs the reason). The route handler only turns the boolean into the response. The check runs without an owner, so it's the one backend function that takes no `ownerId`, and it reads no owner data: it selects only `id` and returns only a boolean.

**PR sizes.** Generated files (lockfile, create-next-app boilerplate, `components/ui/*`) don't count towards the ~400 line guideline (`WORKFLOW.md` §1). Hand-written code per subtask is estimated at 50–250 lines.

**Env.** No new variables. `frontend/.env.example` already lists all four.

## Subtasks

- [ ] **NB-002.1 · Workspaces and scaffold** (`feat/NB-002.1-scaffold`)
  - R1–R7: root workspaces and scripts, Next.js in `frontend/`, `@repo/backend` skeleton with vitest, Node pin, neutral placeholder page.
  - Acceptance:
    - From a fresh clone: `npm ci && npm run lint && npm run typecheck && npm test && npm run build` all pass, with no env vars set.
    - `npm run dev` serves the placeholder page on http://localhost:3000, with no Vercel or Next.js logos and no "Create Next App" title.
    - Only one lockfile exists (`git ls-files | grep -E 'lock'` shows only the root `package-lock.json`).
    - `frontend/README.md`, `.env.example` and `vercel.json` are unchanged.
    - A Client Component importing `@repo/backend` fails the build (checked once by hand, not committed).
- [ ] **NB-002.2 · CI** (`feat/NB-002.2-ci`)
  - R8–R9: the workflow.
  - Acceptance:
    - The PR itself shows the `checks` job running and passing.
    - The workflow file has top-level `permissions: contents: read` and no secrets.
    - After merge, a push to `main` runs the job too (checked on the next merge).
    - The user enables branch protection or a ruleset on `main` (PR required, `checks` must pass), depending on the open question below. `infra/README.md` step 8 names the job.
- [ ] **NB-002.3 · Foundations** (`feat/NB-002.3-foundations`)
  - R10–R17: shadcn, `APP_NAME`, limits, error codes, `AppError`, model IDs, logging, `http.ts`, tests.
  - Acceptance:
    - All four checks pass in CI, including the new unit tests (R17).
    - The page title in the browser tab is the `APP_NAME` placeholder; `grep -rn "Create Next App\|NotebookLM\|Gemini" frontend/src` finds nothing.
    - `backend/src/shared/` imports nothing from outside `shared/`.
    - Model IDs appear only in `backend/src/ai/models.ts`; limits only in `limits.ts`.
- [ ] **NB-002.4 · Data access and ownership** (`feat/NB-002.4-ownership`)
  - R18–R22: env, Supabase clients, owner cookie, `getOwnerId()`, `assertNotebookOwner()`. Updates `docs/ARCHITECTURE.md` → "Ownership".
  - Acceptance:
    - CI passes, including the `assertNotebookOwner` and env tests.
    - Locally, on the first visit in a fresh private window: the response sets `owner_id` (`HttpOnly`, `SameSite=Lax`), and a temporary debug render of `getOwnerId()` on that same first request returns the value instead of throwing (checked by hand, not committed). The `Secure` flag in production is checked on the preview in NB-002.5.
    - A tampered cookie (`owner_id=abc`) is replaced on the next request.
    - `SUPABASE_SECRET_KEY` is read only in `backend/src/env.ts`, and every module that reaches it starts with `import "server-only"`.
- [ ] **NB-002.5 · Health check, README and first deployment** (`feat/NB-002.5-health-deploy`)
  - R23–R25. Needs M0 done (Supabase project, schema applied, keys) and the user's Vercel import.
  - Acceptance:
    - Locally with `.env.local`: `curl -i localhost:3000/api/health` gives `200` and `{ "ok": true, "db": true, … }`. With a wrong `SUPABASE_SECRET_KEY`: `503` and `{ "ok": false, "db": false, … }`, no error details in the body.
    - On the Vercel preview of this PR: `/api/health` gives `200` with `db: true`, and the `owner_id` cookie is set on `/` with `HttpOnly`, `Secure` and `SameSite=Lax`.
    - The cron is listed under Project → Settings → Cron Jobs.
    - **After merge, on production:** M1's "Done when" in `docs/PROGRESS.md` holds (production URL loads, `/api/health` → `ok: true, db: true`, cookie set, CI runs on PRs). The user checks it and marks M1 done.

## Open questions
1. **Branch protection on a private repo.** The repo is private, and GitHub only offers branch protection and rulesets for private repos on a paid plan (Pro, Team or Enterprise). Which applies?
   - (a) You have GitHub Pro: protect `main` in NB-002.2 as planned.
   - (b) You're on Free: make the repo public now (reviewers will see it anyway) and protect `main`.
   - (c) You're on Free and keep it private until submission: skip protection for now, CI still runs on every PR, and protection is turned on when the repo goes public. M1's "Done when" doesn't require protection, so nothing else changes.

## Notes
