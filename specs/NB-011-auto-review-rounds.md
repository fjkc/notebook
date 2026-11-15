# NB-011 · Two review rounds after every PR

**Type:** docs   **Milestone:** M1   **Depends on:** –

## Goal
Every PR Claude opens arrives at the user already reviewed twice and fixed twice, so the user's review starts from a cleaner state and doesn't have to ask for `/review` and the fixes each time.

## Scope
- **In:** `WORKFLOW.md` (§2, §3, §5), the `/implement`, `/spec` and `/review` skills, the decisions log in `docs/PROGRESS.md`.
- **Out:** the review agents, the loop gate's rules, the review guard. Merging stays the user's decision.

## Requirements
- **R1** After Claude opens a PR (spec PR via `/spec`, implementation PR via `/implement`, or any other PR it opens), it runs **two review rounds** on it without being asked. Each round is: `/review` as in `WORKFLOW.md` §5 → triage with the loop gate → push the fixes as commits to the same branch → reply in every thread (or in one PR comment when the findings are in the summary) → update the PR description. Round 2 is a re-review of the commits since round 1, skipped when round 1 pushed no commits. "Round 1/2" count the automatic runs, not `/review`'s markers. After round 2's fixes Claude reports (including the commits no agent has reviewed) and stops; a third round only when the user asks.
- **R2** The loop gate applies unchanged: blockers always, should-fix judged per finding, nits only in round 1. A finding Claude is unsure about stays an open question to the user and doesn't block round 2.
- **R3** A spec PR's fixes stay inside the spec (and the docs the spec PR already touches). Open questions that need the user are listed in the report; the rounds don't decide them.
- **R4** If the PR changes `.claude/` or `CLAUDE.md`, the review guard refuses to review from the PR's checkout. Claude then runs each round's `/review` from an up-to-date checkout of the base branch (the agents read the PR through `git`/`gh`, with `local_head_matches: false`), and switches back to the PR branch for the fixes.
- **R5** While a round's agents run, the working tree stays untouched (as `/review` already requires); the user can stop the rounds at any time. A dirty tree before the base switch, or a guard that still fails on the base branch, stops the round and asks the user; Claude never stashes, resets or cleans to make it run.
- **R7** Fixes in the automatic rounds never change `.claude/**`, `CLAUDE.md`, `.github/**` or permission settings unless the PR's spec is about exactly that change; such findings become open questions in the report.
- **R6** The skills' descriptions and stop rules say this: `/review` may be started by the automatic rounds, `/implement` and `/spec` continue into the rounds instead of stopping after the PR, and `/review` doesn't stop after posting when it runs as part of the rounds.

## Design
Markdown only, no code. Spec and implementation in this one PR, like NB-004, because the change is about the workflow itself.

## Implementation

- [x] **Implemented** (`docs/NB-011-auto-review-rounds`)
  - Acceptance:
    - R1, R2, R5: `WORKFLOW.md` §5 has "Automatic review rounds" with the round steps, two rounds, the loop gate reference and the stop after round 2; §3 step 7 and §2 step 5 point to it.
    - R3: the §5 section says what a spec PR's fixes may touch and that open questions go to the user.
    - R4: the §5 section and `.claude/skills/review/SKILL.md` step 0 describe reviewing from the base checkout when the PR changes `.claude/` or `CLAUDE.md`.
    - R6: the `description` of `/review` no longer forbids starting after opening a PR; `/implement` §7 and `/spec` §6 continue into the rounds; `/review` §6 continues when it runs as part of the rounds.
    - The decisions log has a "Review rounds" row.
    - R7: the §5 section has "Protected paths".
    - Review round 1: round 2 is skipped without new commits; "Counting" and "Stop and ask" bullets in §5; `/review` step 0 never stashes, resets or cleans; `/spec` §6 runs the rounds before the report; §3 and §5 "How it runs" mention the rounds.

## Open questions
None. Requested by the user on 2026-11-15: "if u open a PR, also run 2 rounds of reviews and fixes afterwards on that mr".

## Notes
- PR #25 (NB-008) was the first PR run this way, before this rule was merged, at the user's request.
