# Notehooked

A web app for working with your own documents. Create a notebook, add sources (PDFs, web pages or pasted text) and ask questions about them. The assistant answers only from those sources, and every claim links to the exact passage it came from, so you can check it yourself.

The live demo is password-protected; reviewers get access from the author.

This project is inspired by Google's NotebookLM and uses the Gemini API. It is an independent project, not affiliated with or endorsed by Google.

## What it does

- **Notebooks:** create, rename and delete them; each one belongs to your browser.
- **Sources:** add a PDF (up to 10 MB and 100 pages), a web page or pasted text. Each source shows its status while it's processed, gets a short summary, and can be retried or deleted.
- **Grounded chat:** answers stream in and come only from your sources. If the sources don't cover a question, the answer says so. Answers come in the language you ask in.
- **Citation hooks:** answers cite their passages with numbered hooks. Pressing one opens the Reader with the source, the page and the highlighted passage, and marks the source on the Shelf.
- **Chat controls:** suggested questions for an empty chat, a choice of which sources answers may use, and "Clear chat".
- **Everywhere:** light and dark theme, and layouts for desktop, tablet and phone.

Stack: Next.js (App Router), TypeScript, Tailwind CSS and shadcn/ui, the Vercel AI SDK with Gemini, Supabase (Postgres with pgvector, Storage), hosted on Vercel.

## Run locally

Follow [`infra/README.md` → "Setup from scratch"](infra/README.md#setup-from-scratch) to create the Gemini key and the Supabase project and fill in `frontend/.env.local`. Then, from the repo root:

```bash
npm install
npm run dev        # http://localhost:3000
```

Checks, the same ones CI runs:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Learn more

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): system design, data model, pipelines and API.
- [`WORKFLOW.md`](WORKFLOW.md): how work happens here, from spec to pull request.
- [`docs/PROGRESS.md`](docs/PROGRESS.md): roadmap and decisions.
