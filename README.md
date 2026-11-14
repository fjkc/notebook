# Notehooked

A web app for working with your own documents. Create a notebook, add sources (PDFs, web pages or pasted text) and ask questions about them. The assistant answers only from those sources, and every claim links to the exact passage it came from, so you can check it yourself.

The live demo is password-protected; reviewers get access from the author.

This project is inspired by Google's NotebookLM and uses the Gemini API. It is an independent project, not affiliated with or endorsed by Google.

## Run locally

Follow [`infra/README.md` → "Setup from scratch"](infra/README.md#setup-from-scratch) to create the Gemini key and the Supabase project and fill in `frontend/.env.local`. Then, from the repo root:

```bash
npm install
npm run dev        # http://localhost:3000
```

## Learn more

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): system design, data model, pipelines and API.
- [`WORKFLOW.md`](WORKFLOW.md): how work happens here, from spec to pull request.
- [`docs/PROGRESS.md`](docs/PROGRESS.md): roadmap and decisions.
