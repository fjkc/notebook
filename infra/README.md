# infra

Everything that defines or documents the environment the app runs in: database schema, storage, hosting configuration, secrets and the runbook to set it all up from scratch. No application code.

## What belongs here

| Belongs here | Does not belong here |
|---|---|
| SQL migrations (tables, `match_chunks`, RLS, storage buckets) | Query code (that's `backend/src/db/`) |
| Setup and recovery runbook (this file) | Secrets or filled-in env files |
| Notes on hosting config and environment variables | `vercel.json` and CI files themselves (see below) |
| Optional seed data for local or demo use | |

Two infra files live elsewhere because their tools require it:
- `frontend/vercel.json`: Vercel reads it from the project's root directory (`frontend/`).
- `.github/workflows/ci.yml`: GitHub only reads workflows from the repo root. One job, `checks`, runs `npm ci`, lint, typecheck, test and build on every pull request and every push to `main`, on the Node version from `.nvmrc`. It has read-only permissions and uses no secrets. `main` is not branch-protected (`docs/PROGRESS.md` → "Decisions log"), so a red check doesn't block a merge: don't merge until it's green.

## Layout

```
infra/
  README.md
  supabase/
    migrations/
      0001_init.sql       complete initial schema
      0002_claim_source.sql  claim_source(): atomic claim for processing, deletes old chunks (NB-007)
      0003_match_chunks_exact.sql  match_chunks: exact per-notebook search instead of the global HNSW index (NB-009)
```

## Topology

Hosting (Vercel, `fra1`), database and storage (Supabase, Frankfurt), AI (Gemini free tier), keep-alive cron and runtime settings are described in `docs/ARCHITECTURE.md` → "Infrastructure overview". This file covers how to set them up and keep them running.

## Setup from scratch

1. **Gemini:** create an API key at https://aistudio.google.com. Do not enable billing on that project.
2. **Supabase:** create a project in Frankfurt and store the DB password in a password manager.
3. **Schema:** in the Supabase SQL editor, run every file in `infra/supabase/migrations/` once, in order (`0001_init.sql`, then `0002_claim_source.sql`, …). Check for the five tables (`notebooks`, `sources`, `chunks`, `messages`, `notes`), the `match_chunks` and `claim_source` functions and the two buckets.
4. **Keys:** copy the project URL, the publishable (or anon) key and the secret (or service_role) key.
5. **Local env:** `cp frontend/.env.example frontend/.env.local` and fill it in. Generate the two access gate values, never choose them by hand:
   ```bash
   openssl rand -base64 24   # APP_PASSWORD (the password you send to reviewers)
   openssl rand -base64 32   # SESSION_SECRET
   ```
6. **Vercel:** import the GitHub repo and set:
   - **Root Directory:** `frontend`. Keep "Include files outside the root directory in the Build Step" enabled, because the app imports `backend/`.
   - **Framework preset:** Next.js (detected). Leave Build, Output and Install Command on their defaults: Vercel detects the npm workspace and installs from the repo root with the root `package-lock.json`.
   - **Node.js version:** comes from `engines.node` (`26.x`) in `frontend/package.json`, which overrides the project setting. The build log shows it.
   - **Environment variables:** all six from `frontend/.env.example`, for **Production and Preview**. Without `APP_PASSWORD` and `SESSION_SECRET` nobody can log in. Env changes only apply to new deployments: redeploy after changing one.
   - Deploy.
7. **Verify:** `GET https://<deployment>/api/health` returns `{ "ok": true, "db": true }`, and the cron appears under Project → Settings → Schedules (formerly "Cron Jobs"). Vercel lists it only after a production deployment.

## Environment variables

| Variable | Exposure | Used by |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | server only | backend (AI SDK) |
| `NEXT_PUBLIC_SUPABASE_URL` | public | backend + browser upload client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | browser upload client only |
| `SUPABASE_SECRET_KEY` | server only | backend (bypasses RLS) |
| `APP_PASSWORD` | server only | `backend/src/access/env.ts` (access gate) |
| `SESSION_SECRET` | server only | `backend/src/access/env.ts` (signs the session cookie) |

`frontend/.env.example` is the template and is committed. `.env.local` is git-ignored. Set every variable in Vercel for both Production and Preview.

## Best practices

**Migrations**
- Migrations are append-only: a schema change is a new file `000N_description.sql`. Never edit a migration that has been applied anywhere.
- Each migration is idempotent where cheap (`create … if not exists`, `create or replace function`), and reviewed in the PR diff like code.
- Migrations are applied manually through the SQL editor, which is enough for one environment and a weekend. The upgrade path is the Supabase CLI (`supabase link`, `supabase db push`) run from this folder, which works with this layout as is.

**Security baseline** (the design is in `docs/ARCHITECTURE.md` → "Runtime configuration")
- RLS is on for every table with no policies, and buckets are private. Never add a policy or make a bucket public without a spec.
- Secrets live only in Vercel env settings and local `.env.local`. To rotate a key: provider dashboard first, then Vercel, then redeploy.

**Cost**
- Free tiers only, with no billing attached anywhere, so the worst case is a 429 and never a bill.

## Recovery checklist

| Symptom | Check |
|---|---|
| `/api/health` → `db: false` | Supabase project paused? Restore it. Keys rotated? Update Vercel env and redeploy. |
| Every AI call → "Lots of requests right now" | Gemini free-tier quota exhausted. Wait, or check the quota page in AI Studio. |
| PDF upload fails | Bucket `sources` exists and is private, and the file is under 10 MB. |
| Preview works, production doesn't | Env vars missing in the Production scope. |
| Nobody can log in, or "Login isn't set up yet." | Check `APP_PASSWORD` and `SESSION_SECRET` in the environment's scope, then redeploy. |
