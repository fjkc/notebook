---
name: spec
description: Write a new spec for this repo (or propose the next work package from docs/PROGRESS.md) on a docs/NB-XXX-spec branch and open the spec PR. Use when the user asks for a spec, e.g. "/spec", "/spec URL sources", "let's write the spec for X", "spec out the chat", "what should the next spec be?". Only when the user's message asks for a spec; never start one on your own initiative, e.g. not after a PR is merged.
argument-hint: "[topic]"
---

# Write a spec

The rules (spec format, IDs, size, branch and PR format) are in `WORKFLOW.md` §1, §2 and §4. This skill is the step sequence; when the two disagree, `WORKFLOW.md` wins.

Arguments: `$ARGUMENTS`

## 1. Pick the work package

- **With a topic:** that's the work package. If it's ambiguous or spans several milestones, say how you'd cut it and ask before writing.
- **Without a topic:** propose the next one, then **stop and wait** for the user to confirm or pick another.
  - Read from an up-to-date `origin/main`, not the local checkout, which may be stale or another branch: `git fetch origin main`, then `git show origin/main:docs/PROGRESS.md` and `git ls-tree --name-only origin/main specs/`.
  - Take the first open milestone and its tasks in order.
  - Skip tasks already covered by a spec on `main` or by an open spec PR (`gh pr list --state open --json number,title`, titles starting with `docs(NB-XXX): spec`).
  - Propose one package in a few lines: the tasks it covers, a rough size, and anything the user must provide (keys, choices).

## 2. Check and branch

```bash
git status --porcelain            # must print nothing, otherwise stop and say why
git switch main && git pull --ff-only
```

**Changing an approved spec** instead of writing a new one: keep its ID, branch `docs/NB-XXX-spec-change-<word>`, edit the existing file, and title the PR `docs(NB-XXX): spec change: <what>` (`WORKFLOW.md` §2). Skip the next-free-ID step.

**Next free ID:** the highest `NB-XXX` among `specs/NB-*.md` on `main` **and** the titles of all PRs (`gh pr list --state all --limit 200 --json title`), plus one. IDs are never reused, not even from closed PRs.

```bash
git switch -c docs/NB-XXX-spec
```

## 3. Read before writing

- `CLAUDE.md` (non-negotiables, stack, version gotchas) and `docs/PROGRESS.md` (the milestone's tasks and "Done when").
- The relevant sections of `docs/ARCHITECTURE.md`, and the README of every folder the spec will touch.
- Earlier specs it builds on, and their "Notes" (deviations found during implementation).
- For library APIs you're not sure about, the official docs (see CLAUDE.md → Version gotchas). A spec that names the wrong API costs a rework later.

## 4. Write the spec

`specs/NB-XXX-short-name.md`, from `specs/_template.md`. Keep every section of the template.
- **Requirements:** numbered, each testable. Reference `docs/ARCHITECTURE.md` instead of repeating it. If the spec needs a design change, say so in "Design"; the implementation PR updates ARCHITECTURE.md.
- **Implementation:** one checkbox with the branch name, user steps if any, and concrete acceptance criteria for every requirement (commands, behaviour, preview URL). Checks that can only happen on production say so. No subtasks: the whole spec is one PR (`WORKFLOW.md` §1). If the work would exceed the size in `WORKFLOW.md` §1, propose two specs instead.
- **Dependencies:** `**Depends on:**` names the spec IDs that must be done first, or `–`.
- **Open questions:** everything that affects scope, design, cost or the data model and isn't already decided in the docs. Don't decide those silently. Leave the section as `None.` only if there really are none.
- New dependencies outside the approved list in `CLAUDE.md` are an open question, with one line on why.

## 5. Commit, push, open the spec PR

- Commit: `docs(NB-XXX): add spec for <topic>`, with the attribution lines the session requires.
- Push and open the PR as in `WORKFLOW.md` §4.
  - **Title:** `docs(NB-XXX): spec for <topic>` (a later change to an approved spec: `docs(NB-XXX): spec change: <what>`). The leading word "spec" is how `/review` recognises a spec PR and routes it to the spec-reviewer.
  - **Body:** spec link first (absolute URL on the `docs/NB-XXX-spec` branch), then the §4 sections. "Changes" describes what the spec proposes, "Decisions" the choices it makes and what was rejected, "Impact" what implementing it will change. Close with: **Merging this PR approves the spec.**
- Tell the user the commit hash and that it's pushed.

## 6. Report and stop

First run the two automatic review rounds on the spec PR, exactly as `WORKFLOW.md` §5 "Automatic review rounds" describes (fixes stay inside the spec).

Then, in **one** message: the PR link, the size and any user steps in a line or two, the review verdicts, what was fixed and every won't-fix decision, and the open questions (numbered, each answerable in a word or a choice). Then stop.
- Don't start implementing. That needs the user to ask.
- When the user answers or comments, push fix commits to the same branch, update the PR description, and empty "Open questions" as they get answered.
