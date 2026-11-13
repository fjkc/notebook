---
name: spec
description: Write a new spec for this repo (or propose the next work package from docs/PROGRESS.md) on a docs/NB-XXX-spec branch and open the spec PR. Use when the user asks for a spec, e.g. "/spec", "/spec URL sources", "let's write the spec for X", "spec out the chat", "what should the next spec be?". Only when the user's message asks for a spec; never start one on your own initiative, e.g. not after a PR is merged.
argument-hint: "[topic]"
---

# Write a spec

The rules (spec format, IDs, subtasks, branch and PR format) are in `WORKFLOW.md` §1, §2 and §4. This skill is the step sequence; when the two disagree, `WORKFLOW.md` wins.

Arguments: `$ARGUMENTS`

## 1. Pick the work package

- **With a topic:** that's the work package. If it's ambiguous or spans several milestones, say how you'd cut it and ask before writing.
- **Without a topic:** propose the next one, then **stop and wait** for the user to confirm or pick another.
  - Read `docs/PROGRESS.md`: the first open milestone, its tasks in order.
  - Skip tasks already covered by a spec on `main` (`specs/NB-*.md`) or by an open spec PR (`gh pr list --state open --search "docs(NB-" --json number,title`).
  - Propose one package in a few lines: the tasks it covers, a rough subtask cut, and anything the user must provide (keys, choices).

## 2. Check and branch

```bash
git status --porcelain            # must print nothing, otherwise stop and say why
git switch main && git pull --ff-only
```

**Next free ID:** the highest `NB-XXX` among `specs/NB-*.md` on `main` **and** the titles of all PRs (`gh pr list --state all --limit 200 --json title`), plus one. IDs are never reused, not even from closed PRs.

```bash
git switch -c docs/NB-XXX-spec
```

## 3. Read before writing

- `CLAUDE.md` (non-negotiables, stack, version gotchas) and `docs/PROGRESS.md` (the milestone's tasks and "Done when").
- The relevant sections of `docs/ARCHITECTURE.md`, and the README of every folder the spec will touch.
- Earlier specs it builds on, and their "Notes" (deviations found during implementation).
- For library APIs you're not sure about, the official docs (see CLAUDE.md → Version gotchas). A spec that names the wrong API costs a subtask later.

## 4. Write the spec

`specs/NB-XXX-short-name.md`, from `specs/_template.md`. Keep every section of the template.
- **Requirements:** numbered, each testable. Reference `docs/ARCHITECTURE.md` instead of repeating it. If the spec needs a design change, say so in "Design", and plan the ARCHITECTURE.md update into a subtask.
- **Subtasks:** each independently mergeable, PR-sized (roughly under 400 changed lines), in order, with its branch name and concrete acceptance criteria (commands, behaviour, preview URL). Checks that can only happen on production or a later PR say so.
- **Dependencies:** `**Depends on:**` names the spec IDs that must be done first, or `–`.
- **Open questions:** everything that affects scope, design, cost or the data model and isn't already decided in the docs. Don't decide those silently. Leave the section as `None.` only if there really are none.
- New dependencies outside the approved list in `CLAUDE.md` are an open question, with one line on why.

## 5. Commit, push, open the spec PR

- Commit: `docs(NB-XXX): add spec for <topic>`, with the attribution lines the session requires.
- Push and open the PR as in `WORKFLOW.md` §4.
  - **Title:** `docs(NB-XXX): spec for <topic>`, with **no** subtask number. That's how `/review` recognises a spec PR and routes it to the spec-reviewer.
  - **Body:** spec link first (absolute URL on the `docs/NB-XXX-spec` branch), then the §4 sections. "Changes" describes what the spec proposes, "Decisions" the choices it makes and what was rejected, "Impact" what implementing it will change. Close with: **Merging this PR approves the spec.**
- Tell the user the commit hash and that it's pushed.

## 6. Report and stop

In **one** message: the PR link, the subtask cut in one line each, and the open questions (numbered, each answerable in a word or a choice). Then stop.
- Don't start a review, and don't start implementing. Both need the user to ask.
- When the user answers or comments, push fix commits to the same branch, update the PR description, and empty "Open questions" as they get answered.
