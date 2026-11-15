# backend

`@repo/backend`: a server-only TypeScript package with all domain logic. It contains data access, ingestion (extract → chunk → embed → summarise), retrieval, chat prompt building, citations, errors and limits. The Next.js app in `frontend/` imports it; it is never deployed on its own.

## What belongs here

| Belongs here | Does not belong here |
|---|---|
| Services that take `ownerId` + raw input and do the work | React, JSX, CSS |
| zod schemas for every input | `next/*` imports (`cookies`, `headers`, `revalidatePath`, …) |
| DB helpers, **all scoped by `owner_id`** | `Request`/`Response` objects (statuses live only in `shared/error-codes.ts`) |
| Supabase server client (secret key) | Reading cookies or deciding who the owner is |
| Gemini via the AI SDK: models, prompts, embeddings, generation | UI copy other than error messages |
| RAG pipeline: extract, chunk, embed, retrieve, citations, URL guard | |
| `AppError`, error codes, user-facing messages | |
| Limits (sources per notebook, file size, throttles) | |
| Unit tests for pure logic | |

The backend is **framework-agnostic**: it receives `ownerId` as a plain argument and never asks Next.js for it. That keeps it testable and keeps the trust boundary obvious.

## Layout

```
backend/
  package.json            name "@repo/backend", exports ".", "./shared" and "./access"
  tsconfig.json
  vitest.config.ts
  src/
    index.ts              server entry: import "server-only"; re-exports services
    env.ts                zod-validated env, read lazily on first use
    errors.ts             AppError, toUserMessage(), toErrorBody(), describeError()
    log.ts                one structured line per operation, no secrets or content
    supabase.ts           server client (secret key), created lazily
    access/               password gate: env, session tokens, password check, safe redirect
      index.ts            entry for "@repo/backend/access" (not server-only, the proxy imports it)
    db/                   typed query helpers: notebooks, sources, chunks, messages, notes
      notebooks.ts        list (with source counts), get, count, insert, rename, delete, setSuggestedQuestions
      sources.ts          insert, list, get, counts, claim (claim_source RPC), mark ready/failed, delete, listReadySummaries
      storage.ts          the private "sources" bucket: signed upload token, download, quiet remove
      chunks.ts           insertMany in batches, matchChunks (match_chunks RPC); the documented owner_id exception, see below
      messages.ts         chat messages: insert, listRecent, listAll, countUserMessagesSince, removeByNotebook
    services/             notebooks, sources, chat, notes, health: one module per area
      notebooks.ts        list, get, create (limit), rename, delete, refreshSuggestedQuestions
      sources.ts          list (stuck → failed), create text (limits), process (pipeline), delete; both refresh the suggested questions (+ test)
      ownership.ts        assertNotebookOwner, assertSourceOwner (+ test)
      chat.ts             startChat (validate, own, throttle, history, store question, retrieve), saveAnswer, getHistory, clearChat
      chat-history.ts     pure helpers: buildHistory, collapseResends, isEmptyAnswer (+ test)
    ai/
      models.ts           the only place with Gemini model IDs
      prompts.ts          the only place with prompts: source summary, chat system prompt, suggested questions and their cleaning (+ test)
      suggestions.ts      generateSuggestedQuestions: structured output with SUMMARY_MODEL, 10 s, no retries
      chat.ts             streamChatAnswer: streamText with TEXT_MODEL for a prepared chat turn
      gemini.ts           provider with the server key, created lazily; AI_MAX_RETRIES
      errors.ts           toAiError(): Gemini 429 → RATE_LIMITED, else INTERNAL (+ test)
    rag/
      extract.ts          pdf (unpdf) / url (readability + linkedom) / text → { pages, title?, pageCount? }
      clean-text.ts       stripControlChars, used by every extractor (+ test)
      fetch-page.ts       guarded fetch: node:http(s) with the pinned lookup, redirects, size and type checks
      html-text.ts        readability HTML → text with paragraph breaks (+ test)
      chunk.ts            + chunk.test.ts
      embed.ts            batched embeddings, 768 dims
      summarize.ts        a source's 3–4 sentence summary
      retrieve.ts         embed the question, matchChunks, titles → numbered citations and passages
      url-guard.ts        SSRF protection: parsePublicUrl, isPublicAddress, guarded lookup (+ test)
    shared/               client-safe, no server-only imports
      index.ts            entry for "@repo/backend/shared"
      limits.ts           all limits (single source of truth)
      error-codes.ts      codes, HTTP statuses, user-facing messages, ErrorCode
      ids.ts              isUuid() (also used by the proxy)
      notebook-title.ts   NotebookTitle zod rule, shared with the rename dialog (+ test)
      citations.ts        Citation type, parseCitations, usedCitationNumbers, stripCitationMarkers, cutExcerpt (+ test)
```

## Package entry points

```jsonc
// backend/package.json (sketch)
{
  "name": "@repo/backend",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",          // server only
    "./shared": "./src/shared/index.ts", // safe for Client Components
    "./access": "./src/access/index.ts"  // proxy, getOwnerId and login only
  }
}
```

- `src/index.ts` starts with `import "server-only"`, and so does every module that reads `SUPABASE_SECRET_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`.
- Nothing in `shared/` may import from outside `shared/`. That rule is what makes it safe for the browser.
- `access/` is the one exception to `server-only`: the proxy imports it, and `server-only` throws there. It imports nothing from `next/*` and nothing server-only, and its only env reads are `APP_PASSWORD` and `SESSION_SECRET` in `access/env.ts`. Only `proxy.ts`, `lib/owner.ts` and the login page and action import it, never a Client Component (CLAUDE.md rule 2).
- Internal packages ship TypeScript source; the frontend compiles them via `transpilePackages`. There is no build step and no `dist/`.

## Best practices

**Service shape**: every public function follows the same pattern:

```ts
export async function renameNotebook(ownerId: string, input: unknown) {
  const { id, title } = RenameNotebookInput.parse(input); // 1. validate
  await assertNotebookOwner(ownerId, id);                 // 2. authorise (404 if foreign)
  return db.notebooks.updateTitle(ownerId, id, title);    // 3. act, scoped by owner
}
```

- Inputs are `unknown` and parsed with zod. Never trust types from the caller. A `ZodError` maps to `VALIDATION`.
- Ownership first: any function that takes a notebook or source ID calls `assertNotebookOwner` / `assertSourceOwner` before anything else. A foreign ID gets `NOT_FOUND`, never 403.
- Every query has `.eq("owner_id", ownerId)` or goes through a function that does. No unscoped queries, ever.
- **One documented exception:** `db/chunks`. The `chunks` table has no `owner_id`. `insertMany` is called only by `processSource`, with rows built from a source it has just claimed for the owner. `matchChunks` (the notebook-scoped `match_chunks` RPC) is called only by `retrieve`, after `assertNotebookOwner`. Chunks are deleted only inside the owner-scoped `claim_source` and by the cascade from `sources`.
- Throw `AppError(code)` for expected failures. Let unexpected errors bubble up, and the frontend maps them to `INTERNAL`.

**Data and concurrency**
- State transitions are atomic in SQL, never read-then-write (e.g. claiming a source for processing, `docs/ARCHITECTURE.md` → "Source ingestion").
- Batch writes: chunk inserts, embeddings.
- Schema changes are new migration files in `infra/` (see `infra/README.md`).

**Code style**
- Pure functions for logic (chunker, parser, guard), with I/O at the edges. Pure code gets unit tests.
- No module-level side effects: clients are created lazily, and env is validated with zod on first access. Importing a module never needs env vars, and a missing key fails with a clear server log.
- Logs: one structured line per operation, never secrets or document text.

Pipelines, AI parameters, limits and the URL guard rules are specified in `docs/ARCHITECTURE.md` (sections 6–9). Implement them from there.

## Test

```bash
npm test -w backend
```

Tests cover pure logic: chunker, citation parser, URL guard (with DNS resolution injected). `server-only` throws outside a React Server environment, so `vitest.config.ts` aliases it to an empty module:

```ts
resolve: { alias: { "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)) } }
```
