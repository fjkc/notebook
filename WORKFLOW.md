# Workflow

**Spec first, then code.** Every change starts as a spec. Specs and code both reach `main` only through pull requests, which is where review, comments and approval happen. Claude Code follows this file exactly.

```
Spec PR ──► review, comments, fixes ──► merged = approved ──► one PR for the spec ──► /review ──► fixes ──► merged = done
(Claude)    (user and review agents)    (user)                (Claude)               (agents)    (Claude)  (user)
```

## Status lives in Git, nowhere else

- **Spec proposed:** its spec PR is open.
- **Spec approved:** its spec PR is merged.
- **Spec done:** its "Implemented" checkbox is ticked. The implementing PR ticks it, so it becomes true when that PR merges.
- **Milestone done:** `docs/PROGRESS.md` marks it, once its "Done when" is checked on production.

There are no status fields to keep in sync. To see where things stand, look at the specs and `gh pr list`.

## 1. Specs

- One file per spec in `specs/`, named `NB-XXX-short-name.md`, written from `specs/_template.md`.
- IDs are `NB-` plus a sequential three-digit number. They're never reused.
- A spec covers one or more tasks of a milestone in `docs/PROGRESS.md`. It references `docs/ARCHITECTURE.md` instead of repeating it.
- **One spec, one implementation PR.** There are no subtasks. The spec's "Implementation" section has one checkbox with the branch name and the acceptance criteria, and the implementing PR ticks it.
  - The app builds and works after the PR merges.
  - **Size:** if a work package would be too big for one reviewable PR (roughly over 800 changed lines of code and tests, not counting lockfiles, generated files and Markdown), it becomes two specs, each with its own ID, not subtasks.
  - Specs before NB-004 (NB-001, NB-002, NB-003's original draft) used subtasks `NB-XXX.n`. Their history stays as it is, and a subtask that's still open (NB-002.5) finishes under the old rule.
- **Spec PR titles:** a new spec is `docs(NB-XXX): spec for <topic>`, a change to an approved spec is `docs(NB-XXX): spec change: <what>`. Both start with the word "spec", which is how `/review` routes them to the spec-reviewer and how `/implement` tells them from the implementation PR, whose title never starts with "spec".

## 2. Writing a spec

Run with `/spec [topic]`, or ask in plain words ("let's write the spec for X"). The steps are in `.claude/skills/spec/SKILL.md`.

1. The user names the work package, or asks Claude to propose the next one from `docs/PROGRESS.md`.
2. Claude reads the relevant section of `docs/ARCHITECTURE.md` and the affected folder READMEs.
3. Claude branches `docs/NB-XXX-spec` from an up-to-date `main` and writes the spec. Open questions go into the spec's "Open questions" section.
4. Claude opens a **spec PR** (same PR rules as in section 4, with "Changes" describing what the spec proposes) and reports the link.
5. Claude runs the two automatic review rounds on it (section 5): the spec-reviewer's findings are triaged and fixed by pushing commits to the same branch. The user comments on the PR too, and Claude answers the same way.
6. **The user merges the spec PR. That is the approval.** "Open questions" must be empty by then.

**Changing an approved spec.** Before implementation starts (or when the user wants the change reviewed on its own), the change gets its own PR: same ID, branch `docs/NB-XXX-spec-change-<word>`, the existing spec file edited in place, title `docs(NB-XXX): spec change: <what>`, merged like a spec PR. A deviation found **during** implementation that the user agrees to stays in the implementation branch as a line under "Notes" (§6), with no separate PR.

## 3. Implementing a spec

Run with `/implement NB-003`, or ask in plain words ("implement NB-003", "pick up NB-005"). The steps are in `.claude/skills/implement/SKILL.md`.

1. **Check:** the spec is merged, its dependencies are done, and the working tree is clean. Otherwise stop and say why.
2. **Branch** from an up-to-date `main`, named as in the spec's "Implementation" line, otherwise `<type>/NB-<id>-<1–2 words>`:
   ```bash
   git switch main && git pull --ff-only
   git switch -c feat/NB-003-access-gate
   ```
   The type is `feat`, `fix` or `docs`, matching the spec.
3. **Implement** exactly the spec's scope. Anything else that comes up goes into the spec as a note or a follow-up, not into this branch.
4. **Verify:** `npm run lint && npm run typecheck && npm test && npm run build`, then the spec's acceptance criteria one by one. Fix every failure.
5. **Update in the same branch:**
   - Tick "Implemented" in the spec. Add deviations under "Notes".
   - Update `docs/ARCHITECTURE.md` or a folder README if the design changed.
6. **Commit** with Conventional Commits and the spec ID as scope, one logical step per commit:
   ```
   feat(NB-003): add the session token helpers
   ```
7. **Push and open the PR** (section 4), then run the two automatic review rounds on it (section 5), report, and stop. Claude never merges.

After review (yours, or the agents' via `/review`, see section 5): when asked, Claude triages the findings with the loop gate (section 5), pushes fixes as commits to the same branch (no force-push unless asked), and replies in every thread: what was fixed, why something won't be fixed, or a question for you. After a merge, Claude switches back to `main`, pulls, and waits for the next instruction. When the last spec of a milestone merges, Claude tells the user to check production against the milestone's "Done when".

## 4. Pull requests

```bash
git push -u origin <branch>
gh pr create --base main --assignee @me --title "<type>(NB-XXX): <what, in plain words>" --body-file <tmp>
```

- **Assignee:** `--assignee @me` assigns the user, because PRs are opened with their account. A reviewer can't be set, because GitHub rejects review requests to a PR's own author. If a collaborator is added later, add `--reviewer <login>`.
- **The description matters as much as the code.** Write it for a human reading it cold, in plain sentences, not a file dump.
  - **Spec link first:** an absolute GitHub URL on the PR's branch, so it opens with one click and shows the spec as it is in this PR. Relative links don't resolve reliably in PR descriptions.
  - **Emoji headlines** in the order below. Leave out a section only if it would honestly say nothing.
  - **No tables.** Use headlines, bullets and indented sub-bullets.

```markdown
📄 **Spec:** [NB-003 · Access gate](https://github.com/fjkc/notebook/blob/feat/NB-003-access-gate/specs/NB-003-access-gate.md)

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
  - **Spec PRs** (title `docs(NB-XXX): spec …`, Markdown only): `spec-reviewer` alone, plus `security-audit` with `--security`. It reads the spec as a new developer or agent session would, and checks logic, gaps, hidden open questions, missing definitions and decisions, testability and size.
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
- **What happens next:** a review never changes code. Findings are fixed in the automatic review rounds below, or when you ask, following the loop gate.

### Automatic review rounds

Every PR Claude opens (spec PRs, implementation PRs, any other) gets **two review rounds** right after it's opened, without being asked (NB-011):
1. **Round 1:** `/review` on the PR, then triage every finding with the loop gate, push the fixes as commits to the same branch, reply in every thread (or in one PR comment when the findings ended up in the summary), and update the PR description.
2. **Round 2:** `/review` again. It re-reviews the commits since round 1. Triage, fix, reply and update the description the same way; nits aren't fixed in this round.
3. **Report and stop:** the verdicts, what was fixed, every won't-fix decision and every open question for you. A third round only when you ask. Merging stays yours.

- **Spec PRs:** fixes stay inside the spec (and the docs the spec PR already touches). Questions only you can decide go into the report; the rounds don't decide them.
- **PRs that change `.claude/` or `CLAUDE.md`:** the review guard won't review from the PR's checkout, so each round's `/review` runs from an up-to-date checkout of the base branch (the agents read the PR through `git` and `gh`, with `local_head_matches: false`), and Claude switches back to the PR branch for the fixes.
- While a round's agents run, the working tree stays untouched. You can stop the rounds at any time.

### Loop gate: which findings get fixed

Review rounds can go on forever if every finding gets fixed, because each fix exposes the next layer. So Claude triages every finding before fixing:
- 🔴 **Blocker:** always fixed.
- 🟠 **Should fix:** judged per finding. Is it a real problem **for this project**: a weekend take-home, a public demo, a private repo, one author? A real bug, a security or data risk, or something that will bite in the next milestone gets fixed. Theoretical hardening and enterprise-grade polish don't.
- 🟡 **Nit:** fixed in round 1 when cheap, never in later rounds.

For every finding that isn't fixed, Claude replies in its thread with the **reasoning** (why it doesn't matter in this scope) and resolves the thread. If Claude is **unsure, or thinks a human should decide**, the reply pings the PR author with a concrete question and leaves the thread open. Fixed findings get a reply naming the commit, and their thread is resolved. Claude's report lists every won't-fix decision, so you can reopen any of them.

## 6. Rules

- **One spec = one branch = one PR.** Never mix specs or unrelated changes.
- **No direct commits to `main`.** Everything goes through a PR, including docs.
- **Bugs get a spec too.** It can be short (Goal, Requirements, Implementation with its acceptance criteria) with type `fix`, so every change traces back to an ID.
- **The spec is the contract.** If implementation shows the spec is wrong, stop, explain, and propose a change to the spec. Continue once the user agrees.
- **Green and deployable.** Every PR passes all checks and leaves `main` deployable. Vercel builds a preview for every PR, so use it for anything UI-related.
