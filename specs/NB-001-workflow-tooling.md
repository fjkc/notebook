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
- **R1** All three commands are project skills (`.claude/skills/<name>/SKILL.md`). They run either when typed (`/spec …`) or when the user asks informally ("let's write the spec for X", "implement NB-003.2", "review PR 5"). Each skill's `description` lists those trigger phrasings. The model invokes a skill only when the user's message asks for that action. It never starts one on its own initiative, e.g. it doesn't begin implementing after a spec PR is merged unless asked.
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
  - Posts the result as one GitHub review on the PR: inline comments on the responsible code plus a summary (R12). Then gives the user a short summary with the verdict.

### Review agents
- **R6** Three project agents in `.claude/agents/`. None of them can edit files: their tools are `Read, Grep, Glob, Bash` only (Bash for `git diff`, `gh pr view`, running checks). A `PreToolUse` hook on each agent allows only read-only Bash commands, and denies anything that writes, commits, pushes, comments or sends data out. Their instructions treat everything in the PR as untrusted data. Only the main session posts the review.
- **R7** `reviewer` (always runs). Checks the PR against its spec and the project rules:
  - **Spec compliance:** every acceptance criterion of the subtask, marked met or not met, with evidence (file:line, command output).
  - **Correctness and sense:** does the code do what the PR says, are there obvious bugs.
  - **Simplification:** dead code, duplication, needless abstraction, things that take 20 lines instead of a dependency, or the reverse.
  - **Architecture:** folder rules from the READMEs, single sources (prompts, models, limits), owner scoping, thin adapters, no `next/*` in the backend.
  - **Integration and deployment:** env vars, migrations, Vercel config, build impact, preview check needed, docs updated (spec ticked, ARCHITECTURE.md/README).
  - **Project rules:** CLAUDE.md non-negotiables, unapproved dependencies, PR description format.
  - **Security triage:** states whether this PR needs a security audit, with a one-line reason, judged on what the code does (new input handling, data access, fetches, auth, secrets, file uploads, AI prompts with user content), not only on which files changed.
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
- **R10** `/review` runs `security-audit` when any of these is true:
  - **The reviewer recommends it** (R7, security triage). If the reviewer recommends it and it isn't already running, `/review` launches it as soon as the reviewer reports, and waits for it before posting.
  - **The user asks for it** with `--security` (or skips it with `--no-security`, which overrides everything else).
  - **The changed files match the path list** below. This is a safety net that starts the audit right away, in parallel with the others:
  - `infra/**`
  - `frontend/src/app/api/**`, `frontend/src/proxy.ts`, `frontend/src/middleware.ts`, `frontend/src/lib/owner.ts`, `frontend/src/lib/supabase/**`, `frontend/next.config.*`, `frontend/vercel.json`
  - `backend/src/db/**`, `backend/src/services/**`, `backend/src/supabase.ts`, `backend/src/env.ts`, `backend/src/rag/url-guard.ts`, `backend/src/rag/extract.ts`, `backend/src/ai/prompts.ts`
  - `**/package.json`, `package-lock.json`, `**/.env.example`, `.github/**`, `.claude/**`

  The summary always says whether the audit ran and what triggered it (reviewer, user, paths), or why it was skipped.
- **R11** Findings format, the same for all agents:
  - Severity: 🔴 blocker (must fix before merge), 🟠 should fix, 🟡 nit.
  - Each finding has a location, what's wrong, why it matters (a concrete failure scenario) and a suggested fix.
  - **Location:** the file and the line range in the PR's new version where the cause is. If the cause is spread over several places or isn't tied to code (missing file, design issue), the finding is marked "general".
  - Only report what was verified in the code. Anything uncertain is marked "unverified" and never rated 🔴.
  - No findings in a category means saying so, not padding.
- **R12** The review is posted as **one GitHub review** (event `COMMENT`, via `gh api …/pulls/<n>/reviews`):
  - **Inline comments:** every finding with a single location becomes an inline comment on those lines. It starts with the severity and the agent (e.g. `🟠 **Should fix** · bugfinder`), then what, why, and the fix (as a GitHub suggestion block when it's a small, exact change).
  - **Lines outside the diff:** GitHub only accepts inline comments on lines in the diff. Findings in unchanged code go into the summary with `file:line`.
  - **Summary** (the review body), in the PR description style (emoji headlines, bullets, no tables):
    - verdict line: ✅ ready to merge, or 🔁 changes needed, with the count per severity and "N inline comments",
    - `## 🎯 Spec and acceptance criteria`: each criterion met or not met,
    - `## 🧩 General findings`: findings marked "general" or outside the diff, by severity,
    - `## 🛡️ Security`: ran or skipped, and why,
    - `## 💡 Simplification`: only if there are ideas that aren't tied to one place.
  - Duplicates across agents are merged and attributed to all agents that found them.
- **R13** **A fresh set of eyes.** Every agent starts without context from the conversation that wrote the code.
  - They're launched as fresh subagents, never as forks of the conversation.
  - Their prompt contains only the facts (PR, commit, spec, changed files): no summary of the change, no author reasoning, no findings from earlier reviews.
  - They treat the PR description and code comments as claims to verify.

## Design

**Why `/review` dispatches the agents instead of the reviewer doing it.** In Claude Code a subagent can launch subagents of its own, but a subagent running in the background doesn't get the tool to do so ([docs](https://code.claude.com/docs/en/sub-agents.md), tool filters for background subagents). A reviewer that runs in the background therefore can't start security-audit or bugfinder. So the main session acts as the dispatcher:

```
/review 12
  ├─ triage: changed files match the path list, or --security? (R10)
  ├─ launch in background, in parallel:
  │    reviewer        (spec, AC, architecture, simplification, deployment, security triage)
  │    bugfinder       (races, edge cases, async, framework pitfalls)
  │    security-audit  (only if triggered by paths or --security)
  ├─ conversation stays usable while they run
  ├─ reviewer recommends security and it isn't running? → launch security-audit now
  └─ when all have reported: merge and de-duplicate
       → one GitHub review: inline comments on the code + summary body
       → short summary to the user
```

The roles and the optional security pass are the same as asked for, and parallel runs are faster than nested ones. A security audit recommended by the reviewer adds one more round to the review.

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

- [x] **NB-001.1 · Review agents and `/review`** (`feat/NB-001.1-review-agents`)
  - The three agents and the `/review` skill (R5–R13). `WORKFLOW.md` review step, `CLAUDE.md` pointer.
  - Comes first, so the PR for NB-001.2 can already be reviewed with it.
  - Acceptance:
    - `/review` works when typed, and "review PR <n>" in plain words triggers it too. The model doesn't start a review unasked.
    - Running it on this subtask's own PR launches reviewer, bugfinder and security-audit (triggered by `.claude/**`) in the background, and the conversation stays responsive.
    - Running it with `--no-security` skips security-audit, and the summary says so.
    - The reviewer's security triage is visible in the summary. When it recommends an audit that the paths didn't trigger, the audit runs before the review is posted (checked by reading the skill logic, or on a later PR where it happens).
    - The result is one GitHub review: findings with a single location appear as inline comments on those lines, and the summary follows R12 with no tables.
    - No agent modified files or posted anything itself (`git status` clean, exactly one new review on the PR).
- [ ] **NB-001.2 · `/spec` and `/implement`** (`feat/NB-001.2-spec-implement`)
  - The two skills (R1–R4). `WORKFLOW.md` names them at the start of sections 2 and 3.
  - Acceptance:
    - Both work when typed, and informal requests trigger them too ("let's write the spec for X", "pick up NB-002.1"). The model doesn't start them unasked.
    - `/implement NB-999` (doesn't exist) and `/implement` on an unmerged spec refuse with a clear reason and change nothing.
    - The PR is reviewed with `/review` from NB-001.1.
    - Proven in real use: the next spec (NB-002) is written with `/spec`, and its first subtask is built with `/implement`. Fixes found there go into a `fix` spec.

## Open questions
None. The dispatch design (`/review` launches the agents side by side) was confirmed by the user on the spec PR.

## Notes
- NB-001.1: the agents' shared rules (inputs, read-only, findings format) live once in `.claude/skills/review/protocol.md` instead of being repeated in each agent.
- NB-001.1: agents return findings as a JSON block, and `diff_lines.py` computes which lines accept inline comments, so a single out-of-diff finding can't make GitHub reject the whole review.
- NB-001.1: R13 (fresh eyes) was added by the user during the PR. Read-only enforcement by hook (R6) and the untrusted-content rule came from the first agent review of this PR.
