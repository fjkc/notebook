# NB-004 · One PR per spec, no subtasks

**Type:** docs   **Milestone:** M1   **Depends on:** –

## Goal
Every spec is implemented in exactly one PR. Splitting specs into subtasks (`NB-XXX.1`, `NB-XXX.2`, …) made every work package wait on several review-and-merge rounds, which slowed the weekend budget down more than the smaller PRs helped.

## Scope
- **In:** the workflow rules, the spec template, the `/spec`, `/implement` and `/review` skills, the review agents, `CLAUDE.md`, the decisions log, and NB-003 (merged from two subtasks into one implementation).
- **Out:** the history of NB-001 and NB-002, which keep their subtasks as they were merged. NB-002.5 (PR #10) finishes under the old rule.

## Requirements
- **R1** `WORKFLOW.md`: one spec = one branch = one implementation PR. The spec's "Implementation" section has one checkbox ("Implemented"), the branch name, user steps if any, and the acceptance criteria. A work package that's clearly too big for one reviewable PR becomes two specs, never subtasks.
- **R2** `specs/_template.md`: "Subtasks" is replaced by "Implementation" with one checkbox; "Notes" no longer asks for a subtask prefix.
- **R3** `/implement NB-XXX` checks that "Implemented" is unticked and that no other open PR has the scope `(NB-XXX)` besides the spec PR, then branches, implements, ticks and opens one PR titled `<type>(NB-XXX): …`.
- **R4** `/spec` writes the "Implementation" section instead of a subtask cut. Spec PR titles stay `docs(NB-XXX): spec for …`; `/review` recognises spec PRs by the words "spec for", Markdown-only changes and a changed `specs/NB-*.md`.
- **R5** The reviewer checks the spec's "Implementation" acceptance criteria; the spec-reviewer checks size and the "Implementation" section instead of subtask cuts. Older PRs that carry a subtask in the title still review as before.
- **R6** NB-003 has one "Implementation" with the acceptance criteria of both former subtasks and the user step before merge, and no subtask references.

## Design
Markdown only, no code. Spec and implementation are combined in this one PR at the user's request, because the change is about the workflow itself.

## Implementation

- [x] **Implemented** (`docs/NB-004-one-pr-per-spec`)
  - Acceptance:
    - `grep -rn -i "subtask" WORKFLOW.md CLAUDE.md specs/_template.md .claude/ specs/NB-003-access-gate.md` only finds lines about older specs and PRs (the legacy notes) and the history line in NB-003's "Size".
    - `specs/_template.md` has an "Implementation" section with one checkbox.
    - NB-003 has one unticked "Implemented" box with branch `feat/NB-003-access-gate`.

## Open questions
None.

## Notes
- The `/review` skill can't run on this PR while its branch is checked out, because it changes `.claude/` and `CLAUDE.md` (`WORKFLOW.md` §5). Review it from `main` or read it on GitHub.
