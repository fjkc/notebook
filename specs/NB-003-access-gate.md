# NB-003 · Access gate with a shared password

**Type:** feat   **Milestone:** M1   **Depends on:** NB-002

## Goal
Only people who have the password can use the deployed app. The author emails the password to the reviewers, so the Gemini free-tier quota is reserved for them, and strangers who find the URL see only a login page.

## Scope
- **In:**
  - One shared password for everyone, set as an env var in Vercel and `.env.local`, never in the repo.
  - A `/login` page, a signed session cookie, and a gate in `proxy.ts` that blocks every page and API route without a valid session.
  - A second check in `getOwnerId()`, so Server Actions and Route Handlers are protected even if the proxy matcher misses a path.
  - Docs that currently say "no login": `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/PROGRESS.md`, `infra/README.md`, `frontend/.env.example`, the README.
- **Out:**
  - User accounts, one login per reviewer, sign-up, password reset (rejected for this project, see Design).
  - A logout button. Clearing cookies or waiting for the session to expire is enough for a demo.
  - A login attempt counter or rate limit store (see "Brute force" below).
  - Login page design beyond the neutral placeholder style (M2 restyles it).

## Requirements
- **R1** **Env.** Two new server-only variables, read lazily and validated with zod in the backend (`getAccessEnv()`, same pattern as the env groups from NB-002 R18):
  - `APP_PASSWORD`: at least 16 characters.
  - `SESSION_SECRET`: at least 32 characters (e.g. `openssl rand -base64 32`).
  - Both are added to `frontend/.env.example` (empty), the env table in `infra/README.md`, and CLAUDE.md rule 2 ("Secrets stay on the server"). Neither has a `NEXT_PUBLIC_` prefix, so Next.js never bundles them for the browser.
  - **Fail closed:** if either is missing or invalid, nobody can log in. The login page says "Login isn't set up yet." and the server log names the missing variable. This applies in development too, so local dev needs both in `.env.local`.
- **R2** **Session token.** Pure functions in the backend, no env reads, unit-tested:
  - `createSessionToken(secret, passwordFingerprint, now)` returns `v1.<expiresAt>.<signature>`, where the signature is HMAC-SHA256 (Web Crypto) over `v1.<expiresAt>.<passwordFingerprint>`, base64url-encoded.
  - `passwordFingerprint` is a SHA-256 of `APP_PASSWORD`, so **changing the password logs everyone out**. Rotating `SESSION_SECRET` does too.
  - `verifySessionToken(token, secret, passwordFingerprint, now)` returns `true` only for the right version, a valid signature (constant-time compare) and `expiresAt > now`. Anything malformed returns `false`, never throws.
  - Session lifetime: 30 days, so reviewers can come back days later without a new email.
- **R3** **Password check.** `passwordMatches(input, expected)` compares SHA-256 digests of both with a constant-time compare, so neither the length nor the content leaks through timing.
- **R4** **Login page** `/login`:
  - A password field and a button "Open the app". Server Action `logIn` with `useActionState` for pending and error state.
  - Right password: sets the `access` cookie (`httpOnly`, `secure` in production, `sameSite: "lax"`, `path: "/"`, `maxAge` 30 days) and redirects to `next`.
  - Wrong password: waits 1 second, then shows "That password isn't right." No other detail.
  - Input validated with zod (non-empty string, at most 200 characters).
  - **`next` parameter:** only a relative path that starts with `/` and not `//` or `/\` is used. Anything else falls back to `/`, so the login can't redirect to another site.
  - Uses `APP_NAME` from `frontend/src/lib/config.ts`. All copy in sentence case (CLAUDE.md → "Code conventions"), no NotebookLM wording.
- **R5** **Gate in `proxy.ts`**, before the owner cookie logic from NB-002 R20:
  - Public paths (no session needed): `/login`, `/api/health`, `_next/static`, `_next/image`, `favicon.ico`.
  - Everything else without a valid `access` cookie:
    - page requests: redirect (`307`) to `/login?next=<original path and query>`,
    - `/api/*`: `401` with `{ error: { code: "UNAUTHORIZED", message } }` (`docs/ARCHITECTURE.md` → "Errors").
  - The owner cookie is only set on requests that passed the gate.
  - An already logged-in user who opens `/login` is redirected to `/`.
- **R6** **Second layer.** `getOwnerId()` (`frontend/src/lib/owner.ts`) also verifies the `access` cookie and throws `AppError("UNAUTHORIZED")` without a valid session. Every Server Action and Route Handler calls it, so they stay protected even if the matcher changes (the Next.js proxy docs recommend checking inside each Server Function, not only in the proxy).
- **R7** **Brute force.** No attempt counter. The password is long and random (R1), every failed attempt costs 1 second, and the free-tier quota is the only thing at stake. The decision and its upgrade path (a per-IP counter in Postgres) are recorded in `docs/ARCHITECTURE.md`.
- **R8** **Docs.**
  - `CLAUDE.md`: the project paragraph says reviewers use the live deployment "with a password the author sends them", instead of "without signing up". Rule 2 lists the two new secrets.
  - `docs/ARCHITECTURE.md`: the "No login, cookie-based ownership" row in "Key decisions" becomes "Shared password gate, cookie-based ownership" (why: protect the free-tier quota; trade-off: one password for all, notebooks still tied to one browser). The diagram's proxy line, "Ownership" and a short "Access gate" section describe R1–R7.
  - `docs/PROGRESS.md`: M1 gets the task "Access gate (NB-003)", and its "Done when" adds: "without the password, the production URL shows only the login page".
  - `infra/README.md`: env table, setup step 5 (generate both values) and step 6 (add them in Vercel for Production and Preview). Recovery checklist: "Nobody can log in → check `APP_PASSWORD` and `SESSION_SECRET` in the environment's scope".
  - Root `README.md`: one line saying the live demo is password-protected and reviewers get access from the author.

## Design

**Rejected alternatives**
- **Password in the code:** anyone who can read the repo would have it, and reviewers read the repo.
- **One login per reviewer:** more work and a change to the ownership design, for no gain at this scale. The user chose the shared password.
- **Vercel Deployment Protection with a password:** a paid add-on, not available on the Hobby plan.
- **HTTP Basic Auth in the proxy:** no own login page, browser-dependent behaviour, and the credentials are resent with every request.

**Where the code lives.** The proxy can't import `@repo/backend`, because that entry starts with `import "server-only"`, which is meant for React Server Components, not for the proxy. So the session logic gets its own entry point:
- `backend/src/access/` with `env.ts` (`getAccessEnv()`), `session.ts` (R2), `password.ts` (R3), and `index.ts`. Exported as `@repo/backend/access` in `backend/package.json`.
- It imports nothing from `server-only` modules and nothing from `next/*`. It reads only the two non-public variables, so a wrong import into a Client Component would get `undefined` and fail closed, never leak a secret. It's listed in `backend/README.md` → "Package entry points".
- Frontend: `src/proxy.ts` (gate), `src/lib/owner.ts` (second layer), `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/login/login-form.tsx` (the client leaf with `useActionState`).

**Cookies.** Two independent cookies: `access` (proves the password was entered, 30 days) and `owner_id` (whose notebooks, 1 year, from NB-002). Notebooks stay tied to the browser, as before.

**Tests.** Vitest in `backend/src/access/`: token round trip, expired token, tampered signature, wrong version, malformed input, a token from before a password change is rejected, `passwordMatches` for equal, different and different-length inputs, `next` parameter sanitising (the sanitiser is a pure function in `@repo/backend/access` so it can be tested).

**Env.** Two new variables (R1). No schema change, no new dependency (Web Crypto and `node:crypto`'s `timingSafeEqual` are built in).

## Subtasks

- [ ] **NB-003.1 · Access gate** (`feat/NB-003.1-access-gate`)
  - R1–R8: backend access module with tests, login page and action, gate in the proxy, check in `getOwnerId()`, docs.
  - Acceptance:
    - CI passes, including the new unit tests.
    - Locally, without `APP_PASSWORD` in `.env.local`: every page redirects to `/login`, which says "Login isn't set up yet.", and logging in is impossible.
    - Locally, with both variables set, in a fresh private window:
      - `/` redirects to `/login?next=%2F`.
      - `curl -i localhost:3000/api/health` still returns the health response without a cookie.
      - Another API route (e.g. a temporary probe, not committed, if NB-002 hasn't added one yet) returns `401` with the error shape.
      - A wrong password shows "That password isn't right." after about a second.
      - The right password sets `access` (`HttpOnly`, `SameSite=Lax`) and lands on `/`; the `owner_id` cookie is set on that request.
      - `/login?next=//evil.example` logs in to `/`, not to the other site.
      - Changing `APP_PASSWORD` and restarting logs the browser out.
    - On the Vercel preview of this PR (needs both variables in the Preview scope): the same login flow works, and `access` has `Secure`.
    - `grep -rn "APP_PASSWORD\|SESSION_SECRET" frontend/src` finds nothing: the frontend never reads them directly.
    - **After merge, on production:** without the password, the production URL shows only the login page (new line in M1's "Done when").

## Open questions
None. Login type and placement were decided by the user (one shared password, separate spec after NB-002).

## Notes
- The first deployment in NB-002.5 is open until NB-003.1 merges. It's an empty shell with no Gemini calls, so nothing can use up the quota in that window.
