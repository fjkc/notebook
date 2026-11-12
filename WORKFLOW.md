# Workflow

**Spec first, then code.** Every change starts as a spec. Specs and code both reach `main` only through pull requests, which is where review, comments and approval happen. Claude Code follows this file exactly.

```
Spec PR ──► review, comments, fixes ──► merged = approved ──► one PR per subtask ──► merged = done
(Claude)    (user and review agents)    (user)                (Claude)               (user)
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
5. The user, and any review agents, comment on the PR. Claude answers by pushing fix commits to the same branch.
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

After review: Claude pushes fix commits to the same branch (no force-push unless asked). After a merge, Claude switches back to `main`, pulls, and waits for the next instruction. When the last subtask of a milestone merges, Claude tells the user to check production against the milestone's "Done when".

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

## 5. Rules

- **One subtask = one branch = one PR.** Never mix subtasks or unrelated changes.
- **No direct commits to `main`.** Everything goes through a PR, including docs.
- **Bugs get a spec too.** It can be short (Goal, Requirements, Acceptance criteria) with type `fix`, so every change traces back to an ID.
- **The spec is the contract.** If implementation shows the spec is wrong, stop, explain, and propose a change to the spec. Continue once the user agrees.
- **Green and deployable.** Every PR passes all checks and leaves `main` deployable. Vercel builds a preview for every PR, so use it for anything UI-related.
