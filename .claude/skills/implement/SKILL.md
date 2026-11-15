---
name: implement
description: Implement an approved spec in this repo, in one PR (branch, code, verify, tick "Implemented", open the PR). Use when the user asks to build a spec, e.g. "/implement NB-003", "implement NB-003", "pick up NB-005", "let's build the access gate". Only when the user's message asks for it; never start one on your own initiative, e.g. not after a spec PR or the previous PR is merged.
argument-hint: "NB-XXX"
---

# Implement a spec

The rules are in `WORKFLOW.md` §3 (implementing), §4 (PRs) and §6 (rules). This skill is the step sequence; when the two disagree, `WORKFLOW.md` wins.

Arguments: `$ARGUMENTS`

## 1. Resolve the spec

- The argument is `NB-XXX`. If it's missing, ask which spec, and name the merged specs whose "Implemented" box is still unticked.
- Read the spec **from `main`**, never from a local branch:
  ```bash
  git fetch origin main
  git ls-tree --name-only origin/main specs/ | grep '^specs/NB-XXX-'
  git show "origin/main:specs/NB-XXX-<name>.md"
  ```
- **PR lookup:** never use `gh pr list --search`, which also matches PR descriptions. List the titles and compare exactly:
  ```bash
  gh pr list --state open --json number,title,url
  ```
  Spec PRs have titles starting with `docs(NB-XXX): spec` (`spec for …` for a new spec, `spec change: …` for a change, `WORKFLOW.md` §1). The implementation PR is any other title with the scope exactly `(NB-XXX)`.

## 2. Check, and refuse if anything fails

Run every check before changing anything. If one fails, **stop, change nothing, and say which check failed and what would fix it**:
- **The spec exists on `main`.** If not:
  - an open spec PR for `NB-XXX` exists (PR lookup above): "NB-XXX isn't approved yet: its spec PR #n is still open. Merge it first."
  - otherwise: "There's no spec NB-XXX. Write it with `/spec` first."
- **No spec change is pending:** if an open `docs(NB-XXX): spec change: …` PR exists, stop: "A change to NB-XXX is still open in #n. Merge or close it first."
- **"Implemented" is unticked** (`- [ ] **Implemented**`). Ticked means it's done. A spec from before NB-004 that still has subtasks finishes under the old rule (`WORKFLOW.md` §1): say so and stop.
- **"Open questions" in the spec is empty** (`None.` or nothing).
- **Dependencies are done:** every spec in `**Depends on:**` is ticked on `main` (its "Implemented" box, or all subtasks for older specs).
- **No open implementation PR exists** for this spec (PR lookup above).
- **The working tree is clean:** `git status --porcelain` prints nothing.
- **User steps:** if the "Implementation" section lists user steps needed before the PR (keys, dashboards), ask for them in **one** message before branching, unless the user already said how to handle them (e.g. "use mock keys").

## 3. Branch

Use the branch name the "Implementation" line gives in backticks. Otherwise build it as in `WORKFLOW.md` §3 (`<type>/NB-XXX-<1–2 words>`, type from the spec).
```bash
git switch main && git pull --ff-only
git branch --list "<branch>"     # must print nothing
git switch -c "<branch>"
```
If the branch already exists locally (an aborted attempt or a closed PR), ask whether to reuse it or delete it; don't decide alone.

## 4. Read, then implement

- First read: `CLAUDE.md`, the spec in full (including "Notes"), the relevant `docs/ARCHITECTURE.md` sections, and the README of every folder you'll touch. Check installed major versions before writing code against a library (CLAUDE.md → Version gotchas).
- Implement **exactly** the spec's scope. Anything else that comes up goes into the spec's "Notes" as a follow-up, not into this branch.
- **If the spec turns out to be wrong** (impossible, contradicts the architecture, or needs a decision on scope, design, cost or the data model): stop, explain, and propose the spec change. Continue only once the user agrees, and record the change under "Notes".
- New dependencies outside the approved list in `CLAUDE.md` need the user's approval first.
- Commit as you go, one logical step per commit (`WORKFLOW.md` §3.6), with the attribution lines the session requires.

## 5. Verify

- Run `npm run lint && npm run typecheck && npm test && npm run build` from the root and fix every failure.
  - Before the M1 scaffold exists there is no root `package.json`. Then say so and note it in the PR. Never claim a check passed that didn't run.
- Go through the spec's acceptance criteria **one by one** and check each with a command, a file:line or observed behaviour. A criterion that can only be checked later (on the preview URL, on production, on a later PR) is listed as pending in the PR, with who checks it and when.

## 6. Update the docs in the same branch

- Tick "Implemented" in the spec (`- [x]`). Add deviations under "Notes", one line each.
- Update `docs/ARCHITECTURE.md` or a folder README if the design changed.
- Commit: `docs(NB-XXX): tick implemented` or fold it into the last logical commit.

## 7. Push, open the PR, run the review rounds, report, stop

- Push and open the PR exactly as in `WORKFLOW.md` §4:
  - Title `<type>(NB-XXX): <what, in plain words>`, `--assignee @me`.
  - Body: spec link first (absolute URL on this branch), then the emoji sections. "How to verify" lists the real check results and every acceptance criterion as `[x]` met or `[ ]` pending, with the reason.
- Tell the user the commits (hashes) and that they're pushed, give the PR link, and list anything pending or that needs them (keys, dashboard steps, decisions).
- Then run the two automatic review rounds on the PR, exactly as `WORKFLOW.md` §5 "Automatic review rounds" describes.
- Report as §5 describes: the commits, the review verdicts, what was fixed in each round, every won't-fix decision, every open question, and the commits no agent has reviewed yet.
- **Then stop.** Don't start a third round, don't merge, don't start the next spec. All three need the user to ask.
