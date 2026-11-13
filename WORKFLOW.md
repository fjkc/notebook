# Workflow

**Spec first, then code.** Every change starts as a spec. Specs and code both reach `main` only through pull requests, which is where review, comments and approval happen. Claude Code follows this file exactly.

```
Spec PR ──► review, comments, fixes ──► merged = approved ──► one PR per subtask ──► /review ──► fixes ──► merged = done
(Claude)    (user and review agents)    (user)                (Claude)               (agents)    (Claude)  (user)
```

## Status lives in Git, nowhere else

- **Spec proposed:** its spec PR is open.
- **Spec approved:** its spec PR is merged.
- **Subtask done:** its checkbox in the spec is ticked. The implementing PR ticks it, so it becomes true when that PR merges.
- **Spec done:** all subtask checkboxes are ticked.
- **Milestone done:** `docs/PROGRESS.md` marks it, once its "Done when" is checked on production.

There are no status fields to keep in sync. To see where things stand, look at the specs and `gh pr list`.

## 1. Specs

- One file per spec in `specs/`, named `NB-XXX-short-name.md`, written from `specs/_template.md`.
- IDs are `NB-` plus a sequential three-digit number. They're never reused.
- A spec covers one or more tasks of a milestone in `docs/PROGRESS.md`. It references `docs/ARCHITECTURE.md` instead of repeating it.
- **Subtasks:** a spec that's too big for one easy-to-review PR is split into `NB-XXX.1`, `NB-XXX.2`, … All subtasks are written with the spec and reviewed together. Each subtask:
  - is independently mergeable, so the app builds and works after each one,
  - has its own acceptance criteria,
  - becomes exactly one branch and one PR (roughly under 400 changed lines, excluding lockfiles and generated files).

## 2. Writing a spec

1. The user names the work package, or asks Claude to propose the next one from `docs/PROGRESS.md`.
2. Claude reads the relevant section of `docs/ARCHITECTURE.md` and the affected folder READMEs.
3. Claude branches `docs/NB-XXX-spec` from an up-to-date `main` and writes the spec. Open questions go into the spec's "Open questions" section.
4. Claude opens a **spec PR** (same PR rules as in section 4, with "Changes" describing what the spec proposes) and reports the link.
5. The user comments on the PR, and `/review` adds the spec-reviewer's findings. Claude answers by pushing fix commits to the same branch.
6. **The user merges the spec PR. That is the approval.** "Open questions" must be empty by then.

## 3. Implementing a subtask

Triggered by "implement NB-003" (take the first unticked subtask) or "implement NB-003.2".

1. **Check:** the spec is merged, its dependencies are done, and the working tree is clean. Otherwise stop and say why.
2. **Branch** from an up-to-date `main`, named `<type>/NB-<id>[.<sub>]-<1–2 words>`:
   ```bash
   git switch main && git pull --ff-only
   git switch -c feat/NB-003.2-db-client
   ```
   The type is `feat`, `fix` or `docs`, matching the spec.
3. **Implement** exactly the subtask's scope. Anything else that comes up goes into the spec as a note or a follow-up, not into this branch.
4. **Verify:** `npm run lint && npm run typecheck && npm test && npm run build`, then the subtask's acceptance criteria one by one. Fix every failure.
5. **Update in the same branch:**
   - Tick the subtask in the spec. Add deviations under "Notes".
   - Update `docs/ARCHITECTURE.md` or a folder README if the design changed.
6. **Commit** with Conventional Commits and the spec ID as scope, one logical step per commit:
   ```
   feat(NB-003.2): add server-side supabase client
   ```
7. **Push and open the PR** (section 4), report the link, then stop. Claude never merges.

After review (yours, or the agents' via `/review`, see section 5): when asked, Claude triages the findings with the loop gate (section 5), pushes fixes as commits to the same branch (no force-push unless asked), and replies in every thread: what was fixed, why something won't be fixed, or a question for you. After a merge, Claude switches back to `main`, pulls, and waits for the next instruction. When the last subtask of a milestone merges, Claude tells the user to check production against the milestone's "Done when".

## 4. Pull requests

```bash
git push -u origin <branch>
gh pr create --base main --assignee @me --title "<type>(NB-XXX[.n]): <what, in plain words>" --body-file <tmp>
```

- **Assignee:** `--assignee @me` assigns the user, because PRs are opened with their account. A reviewer can't be set, because GitHub rejects review requests to a PR's own author. If a collaborator is added later, add `--reviewer <login>`.
- **The description matters as much as the code.** Write it for a human reading it cold, in plain sentences, not a file dump.
  - **Spec link first:** an absolute GitHub URL on the PR's branch, so it opens with one click and shows the spec as it is in this PR. Relative links don't resolve reliably in PR descriptions.
  - **Emoji headlines** in the order below. Leave out a section only if it would honestly say nothing.
  - **No tables.** Use headlines, bullets and indented sub-bullets.

```markdown
📄 **Spec:** [NB-003 · Database setup](https://github.com/fjkc/notebook/blob/feat/NB-003.2-db-client/specs/NB-003-database-setup.md) → subtask **NB-003.2**

## 📋 Summary
Two to four sentences: what this PR does and why, in plain language.

## 🧭 Decisions
- **Lazy Supabase client instead of a module-level singleton**
  - Why: importing the module never needs env vars, so tests stay simple.
  - Rejected: a singleton created at import time.

## 🛠️ Changes
- **Backend**
  - What was added or changed, described by intent, not as a file list.
- **Frontend**
  - …
- **Docs**
  - Spec ticked, ARCHITECTURE.md or README updates.

## 💥 Impact
- **Users:** behaviour changes, or "none".
- **Deployment:** new env vars, migrations to run, or "none".
- **Other code:** breaking changes, or "none".

## ✅ How to verify
- **Checks**
  - lint ✔ · typecheck ✔ · test ✔ (12 passed) · build ✔
- **Acceptance criteria**
  - [x] Criterion from the spec
- **On the preview URL**
  - What to click or call, and what should happen.

## ⚠️ Risks and follow-ups
- Known limitations and deviations from the spec.
- What comes next.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 5. Reviewing a PR

Triggered by `/review [PR number] [--security | --no-security]`, or by asking "review PR 5". The steps are in `.claude/skills/review/SKILL.md`.

- **Who reviews:**
  - **Spec PRs** (spec ID without subtask in the title, Markdown only): `spec-reviewer` alone, plus `security-audit` with `--security`. It reads the spec as a new developer or agent session would, and checks logic, gaps, hidden open questions, missing definitions and decisions, testability and the subtask cuts.
  - **Code PRs:**
    - `reviewer` always runs: spec and acceptance criteria, correctness, simplification, architecture, integration and deployment, project rules, and a security triage.
    - `bugfinder` always runs: races, edge cases, async and error handling, framework pitfalls.
    - `security-audit` runs when the reviewer recommends it, when you pass `--security`, or when the PR touches sensitive paths. `--no-security` skips it.
  - Agent definitions are in `.claude/agents/`, and their shared rules in `.claude/skills/review/protocol.md`.
- **How it runs:**
  - The agents start fresh, with no context from the conversation that wrote the code. They get only the facts and treat the PR description as claims to verify.
  - They run in the background and in parallel. A hook limits them to a small read-only tool surface: `git` read commands, `gh pr view/diff/checks`, and reading files inside the project.
  - `/review` refuses to run when `.claude/` or `CLAUDE.md` in the local checkout differ from `main` (or contain untracked files), so a PR can't review itself with its own rules.
  - Claude merges their findings and posts **one GitHub review**: inline comments on the code that causes each finding, and a summary with the verdict, the acceptance criteria and the security status.
- **Re-reviews:**
  - Each review records its round and commit in a hidden marker.
  - The next `/review` on the same PR focuses on the commits since then, while still checking their impact on the whole PR and codebase.
  - Problems in untouched code are only re-raised if they're blockers.
- **What happens next:** a review never changes code. Findings are fixed when you ask, following the loop gate below.

### Loop gate: which findings get fixed

Review rounds can go on forever if every finding gets fixed, because each fix exposes the next layer. So Claude triages every finding before fixing:
- 🔴 **Blocker:** always fixed.
- 🟠 **Should fix:** judged per finding. Is it a real problem **for this project**: a weekend take-home, a public demo, a private repo, one author? A real bug, a security or data risk, or something that will bite in the next milestone gets fixed. Theoretical hardening and enterprise-grade polish don't.
- 🟡 **Nit:** fixed in round 1 when cheap, never in later rounds.

For every finding that isn't fixed, Claude replies in its thread with the **reasoning** (why it doesn't matter in this scope) and resolves the thread. If Claude is **unsure, or thinks a human should decide**, the reply pings the PR author with a concrete question and leaves the thread open. Fixed findings get a reply naming the commit, and their thread is resolved. Claude's report lists every won't-fix decision, so you can reopen any of them.

## 6. Rules

- **One subtask = one branch = one PR.** Never mix subtasks or unrelated changes.
- **No direct commits to `main`.** Everything goes through a PR, including docs.
- **Bugs get a spec too.** It can be short (Goal, Requirements, Acceptance criteria) with type `fix`, so every change traces back to an ID.
- **The spec is the contract.** If implementation shows the spec is wrong, stop, explain, and propose a change to the spec. Continue once the user agrees.
- **Green and deployable.** Every PR passes all checks and leaves `main` deployable. Vercel builds a preview for every PR, so use it for anything UI-related.
