# frontend

The Next.js app: everything the browser sees, plus the thin server layer that connects HTTP requests to `@repo/backend`. This folder is the **Vercel project root**: it is the only thing that gets deployed.

## What belongs here

| Belongs here | Does not belong here |
|---|---|
| Pages, layouts, `loading.tsx`, `error.tsx`, `not-found.tsx` | SQL queries, Supabase table access |
| React components (Server and Client), shadcn/ui components | Prompts, model IDs, Gemini calls |
| Server Actions and Route Handlers as **thin adapters** | Chunking, embedding, retrieval, URL fetching |
| `proxy.ts` / `middleware.ts` (owner cookie), `getOwnerId()` | Business rules and limit checks (call the backend) |
| Design tokens, fonts, global CSS, favicon | Secrets other than through `@repo/backend` |
| Browser Supabase client (signed PDF uploads only) | |
| `APP_NAME` and other UI-only constants | |
| `vercel.json`, `.env.example`, `.env.local` | |

Rule of thumb: if it would still make sense with a different web framework, it belongs in `backend/`.

## Layout

```
frontend/
  src/
    app/
      layout.tsx, page.tsx            home: notebook list
      actions.ts                      server actions for home
      notebook/[id]/
        page.tsx, loading.tsx, not-found.tsx
        actions.ts                    server actions for the notebook screen
      api/
        health/route.ts
        sources/upload-url/route.ts
        sources/[id]/process/route.ts
        chat/route.ts
        notes/route.ts
        notes/audio/route.ts          (stretch)
    components/
      ui/                             shadcn components, restyled to our design
      notebook/                       sources, chat, notes areas
    lib/
      config.ts                       APP_NAME, UI-only constants
      owner.ts                        getOwnerId() from the cookie
      owner-cookie.ts                 cookie name and max age, shared with proxy.ts
      http.ts                         toErrorResponse(), withRoute() logging wrapper
      supabase/browser.ts             publishable key, uploadToSignedUrl only
    proxy.ts                          sets the owner_id cookie (imports only @repo/backend/shared)
  vercel.json                         region fra1, daily health cron
  .env.example
```

## How it talks to the backend

```
Browser ──► Server Component / Server Action / Route Handler ──► @repo/backend
                 (frontend: auth + I/O)                          (rules + data)
```

1. Read the owner: `const ownerId = await getOwnerId()`.
2. Pass raw input and `ownerId` to a backend function. The backend validates with zod and enforces ownership and limits.
3. Turn the result into UI: `revalidatePath` / `redirect` for actions, JSON or a stream for route handlers.
4. Catch everything. `AppError` becomes `{ error: { code, message } }` via `toErrorResponse()`. Unknown errors become `INTERNAL`, and the details are only logged.

Two entry points of the backend package:
- `@repo/backend`: server-only (services, DB, AI). Importing it into a Client Component fails the build, and that is intended.
- `@repo/backend/shared`: client-safe (limits, error codes and messages, `Citation` type, citation parser). Use it from Client Components.

A Server Action should look like this, and no bigger:

```ts
"use server";
export async function renameNotebook(input: unknown) {
  const ownerId = await getOwnerId();
  const result = await notebooks.rename(ownerId, input); // validates + scopes
  revalidatePath(`/notebook/${result.id}`);
  return result;
}
```

## Best practices

**Rendering**
- Server Components by default. Add `"use client"` only to the smallest interactive leaf, never to a page or layout.
- Fetch data in Server Components by calling backend functions directly. No `useEffect` fetching and no internal `fetch("/api/...")` from the server.
- Use streaming with `<Suspense>` and `loading.tsx` for slow areas so the shell renders instantly.
- `notFound()` for unknown or foreign IDs. The 404 is deliberate, so IDs can't be probed.

**Mutations and forms**
- Server Actions for our own UI mutations, with `useActionState` for pending and error state and `useOptimistic` where instant feedback matters (rename, delete).
- Route Handlers only for streaming (chat), uploads, long processing and health. Runtime and duration settings: `docs/ARCHITECTURE.md` → "Runtime configuration".
- Chat uses `useChat` from `@ai-sdk/react`, with citations arriving as message metadata (`docs/ARCHITECTURE.md` → "Chat and citations").

**UI and design**
- Follow `docs/DESIGN.md` (created in M2). Tokens live in CSS via Tailwind v4 `@theme`. No hard-coded colours in components.
- Fonts via `next/font` (self-hosted, no layout shift).
- Own identity: no Google or NotebookLM look, names or copy (CLAUDE.md rule 1).
- Copy: English, sentence case, buttons say what happens ("Add source").

**Quality floor**
- Responsive down to 360 px, visible keyboard focus, `prefers-reduced-motion` respected, WCAG AA contrast.
- Semantic HTML first: buttons are `<button>`, and dialogs and popovers come from Radix via shadcn.
- Every async UI state is covered: loading, empty, error (friendly message from the error code), success toast via `sonner`.

**Security**
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` may reach the browser. Everything else is read inside `@repo/backend`.
- Never render raw error messages or stack traces.
- Owner cookie: see `docs/ARCHITECTURE.md` → "Ownership".

## Build

Commands run from the repo root (see CLAUDE.md → "Commands"). `next.config.ts` lists `transpilePackages: ["@repo/backend"]`: the backend ships TypeScript source and Next compiles it, so there's no separate backend build. Vercel project settings are in `infra/README.md`.

Next.js ships its own docs for the installed version in `node_modules/next/dist/docs/` (hoisted to the repo root by the workspaces; `frontend/AGENTS.md`, generated by Next, points there too). Check them before writing code against Next APIs, because they match the installed version and training data often doesn't.

There are no UI tests (project decision). Logic worth testing belongs in `backend/`.
