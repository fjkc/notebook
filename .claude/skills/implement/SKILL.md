---
name: implement
description: Implement one subtask of an approved spec in this repo (branch, code, verify, tick the subtask, open the PR). Use when the user asks to build a subtask, e.g. "/implement NB-003", "/implement NB-003.2", "implement NB-003.2", "pick up NB-002.1", "let's build the next subtask of NB-004". Only when the user's message asks for it; never start one on your own initiative, e.g. not after a spec PR or the previous subtask is merged.
argument-hint: "NB-XXX[.n]"
---

# Implement a subtask

The rules are in `WORKFLOW.md` §3 (implementing), §4 (PRs) and §6 (rules). This skill is the step sequence; when the two disagree, `WORKFLOW.md` wins.

Arguments: `$ARGUMENTS`

## 1. Resolve the subtask

- The argument is `NB-XXX` or `NB-XXX.n`. If it's missing, ask which spec, and name the merged specs that still have unticked subtasks.
- Read the spec **from `main`**, never from a local branch:
  ```bash
  git fetch origin main
  git ls-tree --name-only origin/main specs/ | grep '^specs/NB-XXX-'
  git show "origin/main:specs/NB-XXX-<name>.md"
  ```
- `NB-XXX` alone: take the first unticked subtask (`- [ ] **NB-XXX.n`). `NB-XXX.n`: take that one.

## 2. Check, and refuse if anything fails

Run every check before changing anything. If one fails, **stop, change nothing, and say which check failed and what would fix it**:
- **The spec exists on `main`.** If not:
  - an open spec PR has it (`gh pr list --state open --search "NB-XXX" --json number,title,url`): "NB-XXX isn't approved yet: its spec PR #n is still open. Merge it first."
  - otherwise: "There's no spec NB-XXX. Write it with `/spec` first."
- **The subtask exists and is unticked.** Ticked means it's done; a missing number means it isn't in the spec. Name the subtasks that do exist.
- **"Open questions" in the spec is empty** (`None.` or nothing).
- **Dependencies are done:** every spec in `**Depends on:**` has all subtasks ticked on `main`, and every earlier subtask of this spec is ticked. If an earlier one is unticked, ask whether to go ahead anyway; don't assume.
- **No open PR already exists** for this subtask (`gh pr list --state open --search "NB-XXX.n"`).
- **The working tree is clean:** `git status --porcelain` prints nothing.

## 3. Branch

Use the branch name the subtask gives in backticks. Otherwise build it as in `WORKFLOW.md` §3 (`<type>/NB-XXX.n-<1–2 words>`, type from the spec).
```bash
git switch main && git pull --ff-only
git switch -c <branch>
```

## 4. Read, then implement

- First read: `CLAUDE.md`, the spec in full (including "Notes" from earlier subtasks), the relevant `docs/ARCHITECTURE.md` sections, and the README of every folder you'll touch. Check installed major versions before writing code against a library (CLAUDE.md → Version gotchas).
- Implement **exactly** the subtask's scope. Anything else that comes up goes into the spec's "Notes" as a follow-up, not into this branch.
- **If the spec turns out to be wrong** (impossible, contradicts the architecture, or needs a decision on scope, design, cost or the data model): stop, explain, and propose the spec change. Continue only once the user agrees, and record the change under "Notes".
- New dependencies outside the approved list in `CLAUDE.md` need the user's approval first.
- Commit as you go, one logical step per commit (`WORKFLOW.md` §3.6), with the attribution lines the session requires.

## 5. Verify

- Run `npm run lint && npm run typecheck && npm test && npm run build` from the root and fix every failure.
  - Before the M1 scaffold exists there is no root `package.json`. Then say so and note it in the PR. Never claim a check passed that didn't run.
- Go through the subtask's acceptance criteria **one by one** and check each with a command, a file:line or observed behaviour. A criterion that can only be checked later (on the preview URL, on production, on a later PR) is listed as pending in the PR, with who checks it and when.

## 6. Update the docs in the same branch

- Tick the subtask in the spec (`- [x]`). Add deviations under "Notes", one line each, prefixed with the subtask ID.
- Update `docs/ARCHITECTURE.md` or a folder README if the design changed.
- Commit: `docs(NB-XXX.n): tick subtask` or fold it into the last logical commit.

## 7. Push, open the PR, report, stop

- Push and open the PR exactly as in `WORKFLOW.md` §4:
  - Title `<type>(NB-XXX.n): <what, in plain words>`, `--assignee @me`.
  - Body: spec link first (absolute URL on this branch, `→ subtask **NB-XXX.n**`), then the emoji sections. "How to verify" lists the real check results and every acceptance criterion as `[x]` met or `[ ]` pending, with the reason.
- Tell the user the commits (hashes) and that they're pushed, give the PR link, and list anything pending or that needs them (keys, dashboard steps, decisions).
- **Then stop.** Don't start `/review`, don't merge, don't start the next subtask. All three need the user to ask.
