# NB-001 · Workflow tooling: slash commands and review agents

**Type:** feat   **Milestone:** M1   **Depends on:** –

## Goal
The workflow in `WORKFLOW.md` runs through three slash commands instead of long chat instructions. `/spec` writes a spec, `/implement` builds a subtask and `/review` reviews a PR. Every PR can get an automated review against its spec, with optional security and bug-hunting passes, posted as a PR comment.

## Scope
- **In:**
  - Project skills `/spec`, `/implement`, `/review` in `.claude/skills/`.
  - Project agents `reviewer`, `bugfinder`, `security-audit` in `.claude/agents/`.
  - Updates to `WORKFLOW.md` and `CLAUDE.md` so they point to the commands.
- **Out:**
  - CI (GitHub Actions) and branch protection: separate spec in M1.
  - Automatic review on every push (e.g. a GitHub Action running Claude). Reviews run when the user asks.
  - Agents that change code. Review agents only read and report; fixes go through the normal flow.

## Requirements

### Commands
- **R1** All three commands are project skills (`.claude/skills/<name>/SKILL.md`) with `disable-model-invocation: true`, so they only run when the user types them.
- **R2** Skills don't duplicate `WORKFLOW.md`. They give the step sequence and point to `WORKFLOW.md` for the rules (branch naming, commit format, PR description format).
- **R3** `/spec [topic]`
  - With a topic, it writes that spec. Without one, it proposes the next work package from `docs/PROGRESS.md` and waits for confirmation.
  - Takes the next free `NB-XXX` ID from `specs/`, branches `docs/NB-XXX-spec` from an up-to-date `main`, writes the spec from `specs/_template.md` after reading the relevant `docs/ARCHITECTURE.md` sections and folder READMEs.
  - Commits, pushes and opens the spec PR (format from `WORKFLOW.md` §4), then reports the link and any open questions in one message.
- **R4** `/implement NB-XXX[.n]`
  - Without a subtask number, it takes the first unticked subtask.
  - Refuses with a clear reason if the spec isn't merged to `main`, a dependency isn't done, or the working tree isn't clean.
  - Otherwise follows `WORKFLOW.md` §3: branch, implement, verify (all four checks plus each acceptance criterion), tick the subtask, commit, push, open the PR, report.
- **R5** `/review [PR number]`
  - Defaults to the PR of the current branch.
  - Launches the review in the background, so the conversation stays usable.
  - Posts one consolidated comment on the PR and gives the user a short summary with the verdict.

### Review agents
- **R6** Three project agents in `.claude/agents/`. None of them can edit files: their tools are `Read, Grep, Glob, Bash` only (Bash for `git diff`, `gh pr view`, running checks). Their instructions forbid any command that writes, commits, pushes or comments. Only the main session posts the comment.
- **R7** `reviewer` (always runs). Checks the PR against its spec and the project rules:
  - **Spec compliance:** every acceptance criterion of the subtask, marked met or not met, with evidence (file:line, command output).
  - **Correctness and sense:** does the code do what the PR says, are there obvious bugs.
  - **Simplification:** dead code, duplication, needless abstraction, things that take 20 lines instead of a dependency, or the reverse.
  - **Architecture:** folder rules from the READMEs, single sources (prompts, models, limits), owner scoping, thin adapters, no `next/*` in the backend.
  - **Integration and deployment:** env vars, migrations, Vercel config, build impact, preview check needed, docs updated (spec ticked, ARCHITECTURE.md/README).
  - **Project rules:** CLAUDE.md non-negotiables, unapproved dependencies, PR description format.
- **R8** `bugfinder` (always runs). Hunts for bugs the reviewer would miss:
  - Race conditions and concurrency (double submits, status transitions, parallel processing, retries that aren't idempotent).
  - Edge cases (empty, huge, unicode, boundaries, null and undefined, partial failures).
  - Async and error handling (unhandled rejections, missing awaits, swallowed errors, aborted streams, timeouts).
  - Serverless and framework pitfalls (function time limits, body size limits, caching and revalidation, hydration mismatches, stale closures).
  - General logic bugs. It may run existing tests and type checks to confirm a suspicion.
- **R9** `security-audit` (optional). Checks the change against current practice (OWASP Top 10, OWASP Top 10 for LLM applications, framework guidance):
  - Secrets and `server-only` boundaries, data reaching the client.
  - Authorisation: owner scoping on every query, 404 for foreign IDs, cookie flags.
  - Input validation, injection (SQL via RPC, prompt injection from sources), SSRF (URL guard, redirects, DNS).
  - Error leakage, logging of sensitive data, rate limiting and abuse.
  - Supabase RLS and storage exposure, signed URL lifetimes.
  - Dependencies (new packages, `npm audit`), CI and workflow permissions, security headers.
- **R10** `/review` runs `security-audit` when the PR's changed files match any of:
  - `infra/**`
  - `frontend/src/app/api/**`, `frontend/src/proxy.ts`, `frontend/src/middleware.ts`, `frontend/src/lib/owner.ts`, `frontend/src/lib/supabase/**`, `frontend/next.config.*`, `frontend/vercel.json`
  - `backend/src/db/**`, `backend/src/services/**`, `backend/src/supabase.ts`, `backend/src/env.ts`, `backend/src/rag/url-guard.ts`, `backend/src/rag/extract.ts`, `backend/src/ai/prompts.ts`
  - `**/package.json`, `package-lock.json`, `**/.env.example`, `.github/**`, `.claude/**`

  The user can force it with `/review <n> --security` or skip it with `--no-security`. The comment always says whether it ran and why.
- **R11** Findings format, the same for all agents:
  - Severity: 🔴 blocker (must fix before merge), 🟠 should fix, 🟡 nit.
  - Each finding has a location (`file:line`), what's wrong, why it matters (a concrete failure scenario) and a suggested fix.
  - Only report what was verified in the code. Anything uncertain is marked "unverified" and never rated 🔴.
  - No findings in a category means saying so, not padding.
- **R12** The consolidated PR comment follows the PR description style (emoji headlines, bullets, no tables):
  - verdict line (✅ ready to merge, or 🔁 changes needed, with the count per severity),
  - `## 🎯 Spec and acceptance criteria`, `## 🔴 Blockers`, `## 🟠 Should fix`, `## 🟡 Nits`, `## 🛡️ Security` (or why it was skipped), `## 💡 Simplification`,
  - duplicates across agents merged, attributed (reviewer, bugfinder, security-audit).

## Design

**Why `/review` dispatches the agents instead of the reviewer doing it.** In Claude Code a subagent can launch subagents of its own, but a subagent running in the background doesn't get the tool to do so ([docs](https://code.claude.com/docs/en/sub-agents.md), tool filters for background subagents). A reviewer that runs in the background therefore can't start security-audit or bugfinder. So the main session acts as the dispatcher:

```
/review 12
  ├─ triage: gh pr diff --name-only → security needed? (R10)
  ├─ launch in background, in parallel:
  │    reviewer        (spec, AC, architecture, simplification, deployment)
  │    bugfinder       (races, edge cases, async, framework pitfalls)
  │    security-audit  (only if triggered)
  ├─ conversation stays usable while they run
  └─ when all have reported: merge and de-duplicate → gh pr comment → summary to the user
```

The roles and the optional security pass are the same as asked for, and parallel runs are faster than nested ones.

**Files**
- `.claude/skills/spec/SKILL.md`, `.claude/skills/implement/SKILL.md`, `.claude/skills/review/SKILL.md`
- `.claude/agents/reviewer.md`, `.claude/agents/bugfinder.md`, `.claude/agents/security-audit.md`
  - Frontmatter: `name`, `description`, `tools: Read, Grep, Glob, Bash`, `model: inherit`.
  - The body is the agent's instructions: focus areas (R7–R9), how to get the diff and spec, findings format (R11), "read-only" rule.
- `WORKFLOW.md`: a review step between "PR opened" and "user merges", and the commands named where each step starts.
- `CLAUDE.md`: `.claude/` added to "Where things are".

**Inputs each agent gets** (passed by `/review` in the launch prompt, since subagents don't see the conversation): PR number, branch, spec file path and subtask ID (parsed from the PR title and spec link), and the list of changed files.

No app code, no dependencies, no env changes.

## Subtasks

- [ ] **NB-001.1 · Review agents and `/review`** (`feat/NB-001.1-review-agents`)
  - The three agents and the `/review` skill (R5–R12). `WORKFLOW.md` review step, `CLAUDE.md` pointer.
  - Comes first, so the PR for NB-001.2 can already be reviewed with it.
  - Acceptance:
    - `/review` shows in the slash menu. The model doesn't invoke it on its own.
    - Running `/review` on this subtask's own PR launches reviewer, bugfinder and security-audit (triggered by `.claude/**`) in the background, and the conversation stays responsive.
    - Running it with `--no-security` skips security-audit, and the comment says so.
    - One consolidated comment appears on the PR in the R12 format, with no tables and findings carrying severity and `file:line`.
    - No agent modified files or posted comments itself (`git status` clean, only one new comment).
- [ ] **NB-001.2 · `/spec` and `/implement`** (`feat/NB-001.2-spec-implement`)
  - The two skills (R1–R4). `WORKFLOW.md` names them at the start of sections 2 and 3.
  - Acceptance:
    - Both show in the slash menu, and the model doesn't invoke them on its own.
    - `/implement NB-999` (doesn't exist) and `/implement` on an unmerged spec refuse with a clear reason and change nothing.
    - The PR is reviewed with `/review` from NB-001.1.
    - Proven in real use: the next spec (NB-002) is written with `/spec`, and its first subtask is built with `/implement`. Fixes found there go into a `fix` spec.

## Open questions
None. The dispatch design (`/review` launches the agents side by side) was confirmed by the user on the spec PR.

## Notes
