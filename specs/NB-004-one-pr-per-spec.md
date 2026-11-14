# NB-004 · One PR per spec, no subtasks

**Type:** docs   **Milestone:** M1   **Depends on:** –

## Goal
Every spec is implemented in exactly one PR. Splitting specs into subtasks (`NB-XXX.1`, `NB-XXX.2`, …) made every work package wait on several review-and-merge rounds, which slowed the weekend budget down more than the smaller PRs helped.

## Scope
- **In:** the workflow rules, the spec template, the `/spec`, `/implement` and `/review` skills, the review agents, `CLAUDE.md`, the decisions log, and NB-003 (merged from two subtasks into one implementation).
- **Out:** the history of NB-001 and NB-002, which keep their subtasks as they were merged. NB-002.5 (PR #10) finishes under the old rule.

## Requirements
- **R1** `WORKFLOW.md`: one spec = one branch = one implementation PR. The spec's "Implementation" section has one checkbox ("Implemented"), the branch name, user steps if any, and the acceptance criteria. A work package too big for one PR (roughly over 800 changed lines of code and tests, not counting lockfiles, generated files and Markdown) becomes two specs, never subtasks. The ~400-line guideline per subtask is replaced by this larger limit per spec, because fewer, bigger PRs are the point. Older specs' open subtasks (NB-002.5) finish under the old rule.
- **R2** `specs/_template.md`: "Subtasks" is replaced by "Implementation" with one checkbox; "Notes" no longer asks for a subtask prefix.
- **R3** `/implement NB-XXX` checks that "Implemented" is unticked, that no spec change for NB-XXX is open, and that no implementation PR is open (a title with the scope `(NB-XXX)` that doesn't start with "spec"), then branches, implements, ticks and opens one PR titled `<type>(NB-XXX): …`.
- **R4** `/spec` writes the "Implementation" section instead of a subtask cut. Spec PR titles start with the word "spec": `docs(NB-XXX): spec for <topic>` for a new spec, `docs(NB-XXX): spec change: <what>` for a change to an approved spec. `/review` recognises spec PRs by that title, Markdown-only changes and a changed `specs/NB-*.md`.
- **R5** The reviewer checks the spec's "Implementation" acceptance criteria; the spec-reviewer checks size and the "Implementation" section instead of subtask cuts. Older PRs that carry a subtask in the title still review as before.
- **R6** NB-003 has one "Implementation" with the acceptance criteria of both former subtasks and the user step before merge, and no subtask references.

## Design
Markdown only, no code. Spec and implementation are combined in this one PR at the user's request, because the change is about the workflow itself.

## Implementation

- [x] **Implemented** (`docs/NB-004-one-pr-per-spec`)
  - Acceptance:
    - R1: `WORKFLOW.md` §1 has "One spec, one implementation PR", the size limit with "800 changed lines", and the spec PR title rule with both `spec for` and `spec change:`. §6 says "One spec = one branch = one PR".
    - R2: `specs/_template.md` has an "Implementation" section with one `- [ ] **Implemented**` checkbox and no "Subtasks" section.
    - R3: `.claude/skills/implement/SKILL.md` checks `- [ ] **Implemented**`, stops on an open `spec change:` PR, and titles the PR `<type>(NB-XXX): …`.
    - R4: `.claude/skills/review/SKILL.md` classifies `spec` by a title starting with `docs(NB-XXX): spec`; `.claude/skills/spec/SKILL.md` names both title forms.
    - R5: `.claude/agents/reviewer.md` reads the "Implementation" section and falls back to the `subtask` input; `/review` still takes the subtask from an older title such as `feat(NB-002.5): …`.
    - R6: NB-003 has one unticked "Implemented" box with branch `feat/NB-003-access-gate`.
    - `grep -rn -i "subtask" WORKFLOW.md CLAUDE.md specs/_template.md .claude/ specs/NB-003-access-gate.md docs/PROGRESS.md` finds only: rules that forbid subtasks (WORKFLOW.md §1, `/spec`, spec-reviewer, PROGRESS decisions log), references to pre-NB-004 PRs and specs (WORKFLOW.md §1, `/implement`, `/review`, protocol, reviewer), and NB-003's history line in "Size". No line asks for, numbers or ticks a subtask.

## Open questions
None.

## Notes
- This PR is titled `docs(NB-004): spec for …`, so `/review` from `main` routes it to the spec-reviewer under both the old and the new rule (review round 1).
- The `/review` skill can't run on this PR while its branch is checked out, because it changes `.claude/` and `CLAUDE.md` (`WORKFLOW.md` §5). Review it from `main` or read it on GitHub.
