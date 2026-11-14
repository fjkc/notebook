# NB-003 · Access gate with a shared password

**Type:** feat   **Milestone:** M1   **Depends on:** NB-002

This spec builds on NB-002 (`specs/NB-002-scaffold-first-deployment.md`, spec PR #4): its env groups (R18), `proxy.ts` and owner cookie (R20), `getOwnerId()` (R21) and the first deployment (NB-002.5). **Merge this spec PR only after NB-002's spec PR**, and re-check those references if NB-002 changed in the meantime.

## Goal
Only people who have the password can use the deployed app. The author emails the password to the reviewers, so the Gemini free-tier quota is reserved for them, and strangers who find the URL see only a login page.

## Scope
- **In:**
  - One shared password for everyone, set as an env var in Vercel and `.env.local`, never in the repo.
  - A `/login` page, a signed session cookie, and a gate in `proxy.ts` that blocks every page and API route without a valid session.
  - A second check in `getOwnerId()`, so Server Actions, Route Handlers and page data are protected even if the proxy matcher misses a path.
  - Every doc that currently says "no login" or describes the system without the gate (R13).
- **Out:**
  - User accounts, one login per reviewer, sign-up, password reset (rejected, see Design).
  - A logout button. Clearing cookies or waiting for the session to expire is enough for a demo.
  - A login attempt counter or rate limit store (R8).
  - Login page design beyond the neutral placeholder style (M2 restyles it).

## Requirements

### Backend access module
- **R1** **Env.** Two new server-only variables, read lazily and validated with zod in `backend/src/access/env.ts` (`getAccessEnv()`, same pattern as NB-002 R18):
  - `APP_PASSWORD`: at least 24 characters, **generated**, never chosen by hand (`openssl rand -base64 24`, 32 characters).
  - `SESSION_SECRET`: at least 32 characters (`openssl rand -base64 32`).
  - Neither has a `NEXT_PUBLIC_` prefix, so Next.js never bundles them for the browser.
  - **Fail closed:** if either is missing or invalid, `getAccessEnv()` returns `null` (it never throws), nobody can log in, and the server log names the missing or invalid variable (never its value). This applies in development too, so local dev needs both in `.env.local`.
- **R2** **Session token.** Pure functions in `backend/src/access/session.ts`, no env reads:
  - Units: `expiresAt` in Unix **seconds**, `now` in **milliseconds** (`Date.now()`), all byte values base64url-encoded without padding.
  - `passwordFingerprint(password)`: base64url SHA-256 of the password.
  - `createSessionToken(secret, fingerprint, now)` returns `v1.<expiresAt>.<signature>`, with `expiresAt = floor(now / 1000) + 30 days` and `signature` = HMAC-SHA256 (Web Crypto) with `secret` over `v1.<expiresAt>.<fingerprint>`.
  - Because the fingerprint is signed, **changing the password logs everyone out**. Rotating `SESSION_SECRET` does too.
  - `verifySessionToken(token, secret, fingerprint, now)` returns `true` only for version `v1`, a valid signature (constant-time compare) and `expiresAt > floor(now / 1000)`. Anything malformed returns `false` and never throws.
  - Session lifetime is 30 days, so reviewers can come back days later without a new email.
- **R3** **Password check.** `passwordMatches(input, expected)` in `backend/src/access/password.ts` compares the SHA-256 digests of both with `timingSafeEqual`, so neither length nor content leaks through timing.
- **R4** **Safe redirect target.** `safeNextPath(next: unknown): string` in `backend/src/access/next-path.ts` returns `next` only if it is a string without control or whitespace characters, and `new URL(next, "http://localhost")` keeps the origin `http://localhost` and has a path that starts with a single `/` and isn't `/login`. Anything else returns `/`. This blocks `//evil.example`, `/\evil.example`, `/<tab>/evil.example`, absolute URLs and a login loop.
- **R5** **Entry point.** `backend/src/access/index.ts` re-exports R1–R4 and is published as `@repo/backend/access` in `backend/package.json`.
  - The proxy can't import `@repo/backend`, which starts with `import "server-only"` (meant for React Server Components, not for the proxy). So this entry deliberately **doesn't** import `server-only`.
  - It imports nothing from `next/*` and nothing from server-only modules. Its only env reads are the two variables in `env.ts`.
  - Rules for importing it: only `proxy.ts`, `lib/owner.ts` and the login page and action. Never a Client Component.
- **R6** **Rule 2 and the backend README.** This spec introduces the exception, so it also changes the rule that it would otherwise break:
  - **CLAUDE.md rule 2** reads: "`GOOGLE_GENERATIVE_AI_API_KEY` and `SUPABASE_SECRET_KEY` are only read in `backend/`, in modules that start with `import \"server-only\"`. `APP_PASSWORD` and `SESSION_SECRET` are only read in `backend/src/access/env.ts`, which the proxy imports and therefore can't be `server-only`; they never get a `NEXT_PUBLIC_` prefix and the module is never imported by a Client Component. Never commit `.env.local`, never log secrets, never send them to the client."
  - **`backend/README.md`**: the layout gets `access/`, and "Package entry points" gets `./access` with the import rules from R5.
- **R7** **Tests** (vitest, `backend/src/access/`): token round trip, expired token, tampered signature, wrong version, malformed input, a token signed before a password change is rejected, `passwordMatches` for equal, different and different-length inputs, `getAccessEnv()` returns `null` for missing and too-short values, and `safeNextPath` for every case in R4.

### Frontend gate
- **R8** **Brute force.** No attempt counter. The real protection is the password's entropy (R1: 24 random bytes' worth of base64 is far beyond guessing). A failed attempt waits 1 second before answering, which slows sequential guessing only; parallel requests aren't slowed. Only the free-tier quota is at stake. The decision and its upgrade path (a per-IP counter in Postgres) go into `docs/ARCHITECTURE.md`.
- **R9** **Login page** `/login`:
  - Rendered per request (`export const dynamic = "force-dynamic"`, and it awaits `searchParams`), so the "set up" check reflects the running deployment's env, not the build's.
  - If `getAccessEnv()` returns `null`: the page shows "Login isn't set up yet." and no form.
  - Otherwise: a password field and a button "Open the app". Client leaf `login-form.tsx` with `useActionState` for pending and error state.
  - A user with a valid session who opens `/login` is redirected to `safeNextPath(next)`.
  - Uses `APP_NAME` from `frontend/src/lib/config.ts`. All copy in sentence case (CLAUDE.md → "Code conventions"), no NotebookLM wording.
- **R10** **Server Action `logIn`** (`src/app/login/actions.ts`):
  - Checks `getAccessEnv()` again on submit. If `null`, returns "Login isn't set up yet."
  - Validates the input with zod (non-empty string, at most 200 characters). Invalid input returns "Enter the password." without the 1-second wait.
  - Right password: sets the `access` cookie (`httpOnly`, `secure` in production, `sameSite: "lax"`, `path: "/"`, `maxAge` 30 days) with a token from R2, then redirects to `safeNextPath(next)`.
  - Wrong password: waits 1 second, then returns "That password isn't right." No other detail.
  - `logIn` is the **only** Server Action that doesn't call `getOwnerId()`, because it runs without a session by design.
- **R11** **Gate in `proxy.ts`**, before the owner cookie logic from NB-002 R20:
  - The NB-002 matcher exclusions stay as they are (`_next/static`, `_next/image`, `favicon.ico`, `api/health`), so the proxy never runs for them.
  - Inside the proxy, `/login` is the only extra path allowed without a session. That includes the `logIn` Server Action, which posts to `/login`.
  - Every other request without a valid `access` cookie:
    - `GET` or `HEAD` to a page: redirect (`307`) to `/login?next=<original path and query>`.
    - `/api/*`: `401` with `{ error: { code: "UNAUTHORIZED", message } }` (`docs/ARCHITECTURE.md` → "Errors").
    - A Server Action (a `POST` with a `Next-Action` header) on any other page: **passed through**. The action's first call, `getOwnerId()` (R12), throws `UNAUTHORIZED`, and the action returns the error shape, so the UI shows "Your session has expired. Reload the page." instead of a broken redirect.
    - Any other method to a page: `401` with the same error shape.
  - The owner cookie logic (NB-002 R20) runs on **every request the proxy lets through**: requests with a valid session, and `/login` including the `logIn` action. So the page rendered right after login already has an owner, even when Next.js renders the redirect target inside the action's response. An `owner_id` without a session grants nothing, because `getOwnerId()` also requires a session (R12). Requests that are redirected to `/login` or rejected with `401` get no owner cookie.
- **R12** **Second layer.** `getOwnerId()` (`frontend/src/lib/owner.ts`) also verifies the `access` cookie with `@repo/backend/access` and throws `AppError("UNAUTHORIZED")` without a valid session. Every Server Action except `logIn`, every Route Handler except health, and every page that loads owner data calls it, so they stay protected even if the matcher changes (the Next.js proxy docs recommend checking inside each Server Function, not only in the proxy).
- **R13** **Docs** (rule 2 and the backend README are covered by R6):
  - `CLAUDE.md` project paragraph: reviewers use the live deployment "with a password the author sends them", instead of "without signing up".
  - `docs/ARCHITECTURE.md`: the "No login, cookie-based ownership" row in "Key decisions" becomes "Shared password gate, cookie-based ownership" (why: protect the free-tier quota; trade-off: one password for all, notebooks still tied to one browser). The diagram's proxy line, "Ownership", and a new "Access gate" section describe R1–R12 and R8's upgrade path.
  - `docs/PROGRESS.md`: M1 gets the task "Access gate (NB-003)", its "Done when" adds "without the password, the production URL shows only the login page", M3's "Done when" becomes "… opening one of your notebook URLs in a private window and logging in there gives a 404" (without logging in, the gate shows the login page, so the ownership check can't be seen), and the Decisions log row "Auth" becomes "Shared password gate + anonymous `owner_id` cookie".
  - `frontend/README.md`: the layout gets `app/login/`, and `proxy.ts` is described as "access gate, then owner cookie".
  - `infra/README.md`: env table, setup step 5 (generate both values with the commands from R1), step 6 (add them in Vercel for Production and Preview, redeploy after env changes), and the recovery checklist ("Nobody can log in → check `APP_PASSWORD` and `SESSION_SECRET` in the environment's scope, then redeploy").
  - `frontend/.env.example`: both variables, empty, with the generate commands as comments.
  - Root `README.md`: one line saying the live demo is password-protected and reviewers get access from the author.

## Design

**Rejected alternatives**
- **Password in the code:** anyone who can read the repo would have it, and reviewers read the repo.
- **One login per reviewer:** more work and a change to the ownership design, for no gain at this scale. The user chose the shared password.
- **Vercel Deployment Protection with a password:** a paid add-on, not available on the Hobby plan.
- **HTTP Basic Auth in the proxy:** no own login page, browser-dependent behaviour, and the credentials are resent with every request.
- **Redirecting Server Actions to `/login`:** a `307` keeps the POST and re-sends the action to a page where it doesn't exist, which breaks the UI. Passing them through to `getOwnerId()` gives the normal error message.

**Files**
- Backend: `backend/src/access/{env,session,password,next-path,index}.ts` and tests, `backend/package.json` (`./access` export), `backend/README.md`, `CLAUDE.md` rule 2.
- Frontend and docs: `frontend/src/proxy.ts`, `frontend/src/lib/owner.ts`, `frontend/src/app/login/{page,actions,login-form}.tsx`, and the docs in R13.

**Cookies.** Two independent cookies: `access` (proves the password was entered, 30 days) and `owner_id` (whose notebooks, 1 year, from NB-002). Notebooks stay tied to the browser, as before.

**Size.** About 400 lines of code and tests plus the doc edits in R13, in one PR (`WORKFLOW.md` §1). It was first cut into two subtasks; NB-004 merged them into one PR.

**Env.** Two new variables (R1). No schema change, no new dependency (Web Crypto and `node:crypto`'s `timingSafeEqual` are built in).

## Implementation

- [x] **Implemented** (`feat/NB-003-access-gate`)
  - R1–R13 in one PR: the backend access module and its tests, the `./access` export, the login page and action, the gate in the proxy, the check in `getOwnerId()`, CLAUDE.md rule 2 and the docs in R13.
  - **User step before merge:** add `APP_PASSWORD` and `SESSION_SECRET` in Vercel for **Production and Preview**, then redeploy. The gate fails closed, so merging without them locks everyone out of production. The PR's "Deployment" section says this, and `/implement` asks for it in one message when opening the PR.
  - Acceptance:
    - CI passes, including every test case listed in R7.
    - `backend/src/access/` imports nothing from `next/*`, from `server-only` or from modules outside `access/` that import it (`grep -rn "server-only\|from \"next" backend/src/access` finds nothing).
    - The only `process.env` reads in `backend/src/access/` are the two variables in `env.ts`.
    - CLAUDE.md rule 2 and `backend/README.md` match R6.
    - Locally, without `APP_PASSWORD` in `.env.local`: every page redirects to `/login`, which says "Login isn't set up yet.", and the server log names the missing variable.
    - Locally, with both variables set, in a fresh private window:
      - `/` redirects to `/login?next=%2F`.
      - `curl -i localhost:3000/api/health` still returns the health response without a cookie.
      - Another API route (a temporary probe, not committed, if none exists yet) returns `401` with the error shape.
      - An empty submit shows "Enter the password."; a 201-character input is rejected the same way.
      - A wrong password shows "That password isn't right." after about a second.
      - The right password sets `access` (`HttpOnly`, `SameSite=Lax`) and lands on `/`. After landing, the browser has an `owner_id` cookie, and a temporary debug render of `getOwnerId()` on `/` (not committed) returns it on that first page load instead of throwing.
      - Opening `/login` again while logged in redirects to `/`.
      - `/login?next=//evil.example` and `/login?next=%2F%09%2Fevil.example` log in to `/`, not to another site.
      - **Second layer:** with the `access` cookie deleted, a temporary page or Server Action that calls `getOwnerId()` (with the matcher temporarily excluding its path, not committed) gets `UNAUTHORIZED`, and the UI shows "Your session has expired. Reload the page."
      - Changing `APP_PASSWORD` and restarting logs the browser out.
    - On the Vercel preview of this PR: the same login flow works, and `access` has `Secure`.
    - `grep -rn "APP_PASSWORD\|SESSION_SECRET" frontend/src` finds nothing: the frontend never reads them directly.
    - Docs: every change listed in R13 is made (including M3's "Done when" in `docs/PROGRESS.md`, which now mentions logging in), and `grep -rn "No login\|without signing up" CLAUDE.md docs README.md` finds nothing.
    - **After merge, on production:** without the password, the production URL shows only the login page (new line in M1's "Done when").

## Open questions
None. Login type and placement were decided by the user (one shared password, separate spec after NB-002).

## Notes
- The first deployment in NB-002.5 is open until NB-003 merges. It's an empty shell with no Gemini calls, so nothing can use up the quota in that window.
- Implementation: `@repo/backend/access` also exports `ACCESS_COOKIE`, `hasValidSession(token)`, `isAppPassword(env, input)` and `createSession(env)`, beyond R1–R4. The proxy, `getOwnerId()` and the login page share one session check, and the frontend never touches the two variables (the R13 grep finds nothing in `frontend/src`).
- Implementation: the zod input check for the password is `parsePasswordInput()` in `access/password.ts`, so the frontend needs no `zod` dependency. The 30-day lifetime, the 1-second delay and the 200-character input limit are constants in `shared/limits.ts`.
- Implementation: `docs/PROGRESS.md` sets M1 back to **open**, because its "Done when" gains the login-page line (R13). It's marked done again once that line holds on production.
- Implementation: the local login checks were run by submitting the form without JavaScript (React's progressive enhancement) with a scripted HTTP client, not in a browser. The JavaScript-driven flow is checked on the preview. Action responses repeat the `owner_id` `Set-Cookie` header with the same value, which is harmless.
- Review round 1 (PR #13): the matcher exclusions `favicon.ico` and `api/health` were prefixes, so any path starting with them (e.g. `/api/healthz`) skipped the gate. R11 said the exclusions stay; instead the matcher now skips only `_next/static` and `_next/image`, and the proxy lets through exactly `/api/health` and `/favicon.ico` (`PUBLIC_PATHS`). Checked on a fresh `next start`: `/api/health` → `200` without cookies, `/api/healthz`, `/api/health/x` → `401`.
- Review round 1: the password input and both env values are trimmed, so a password copied from an email with a trailing space or newline, or pasted into Vercel with one, still works. The generated base64 password never contains whitespace.
