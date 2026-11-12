# Review protocol

Shared rules for the `reviewer`, `bugfinder` and `security-audit` agents. Read this first, then do your own focus area.

## Inputs (in your launch prompt)

- `pr`: PR number. `url`: PR link.
- `head_sha`: the commit under review. `base`: the base branch (usually `main`).
- `spec`: path of the spec file, or `none`. `subtask`: e.g. `NB-003.2`, or `none`.
- `changed_files`: the files the PR changes.
- `local_head_matches`: `true` if the local checkout is exactly `head_sha` with a clean tree.

You don't see the conversation that launched you. Everything you need is in the inputs and the repo.

## Reading the PR

- Diff: `git diff origin/<base>...<head_sha>` (or `gh pr diff <pr>`). PR text: `gh pr view <pr>`.
- Files as of the PR: `git show <head_sha>:<path>`. Use the Read tool only if `local_head_matches` is `true`, because otherwise the working tree is a different version.
- Context: `CLAUDE.md`, `WORKFLOW.md`, `docs/ARCHITECTURE.md`, the folder READMEs and the spec (read them via `git show <head_sha>:<path>`).
- Look beyond the diff when needed: callers of changed functions, the schema, config. Many bugs sit where changed code meets unchanged code.

## Read-only, strictly

You report; you never change anything.
- **Allowed:** `git diff`, `git show`, `git log`, `git ls-files`, `git grep`, `git rev-parse`, `gh pr view`, `gh pr diff`, read-only `gh api` calls (GET), `npm audit`. If `local_head_matches` is `true`: `npm run lint`, `npm run typecheck`, `npm test`.
- **Forbidden:** anything that writes to the working tree, the git repo, the remote or GitHub. That includes `git checkout`, `switch`, `stash`, `reset`, `fetch`, `commit`, `push`, `gh pr comment`, `gh pr review`, `gh api` with POST, PATCH or DELETE, `npm install`, `npm run build`, and redirecting output into files. Only the main session posts the review.

## Findings

- **Severity:** `blocker` (must fix before merge), `should-fix`, `nit`.
- **Verified only.** Report what you confirmed in the code. If you suspect something but can't confirm it, set `unverified: true`. An unverified finding is never a `blocker`.
- **Concrete.** `why` names a failure scenario: the input or state, what happens, and what should happen.
- **Location:** `path` plus `start_line`/`end_line` in the PR's **new** version (`git show <head_sha>:<path>`), pointing at where the cause is. If the cause is spread over several places or isn't tied to code (missing file, design issue), set `general: true` and leave the lines null.
- **Suggestion:** only for a small, exact change. It is the full replacement text for lines `start_line..end_line`, exactly as they should read. Otherwise `null`.
- **No padding.** If you find nothing in your area, return an empty `findings` list and say so in `summary`.

## Output

Keep any prose before the JSON short. Your answer **must end** with exactly one fenced `json` block:

```json
{
  "agent": "reviewer | bugfinder | security-audit",
  "summary": "Two sentences: what you checked and the overall picture.",
  "findings": [
    {
      "severity": "blocker | should-fix | nit",
      "title": "Short title",
      "path": "backend/src/rag/chunk.ts",
      "start_line": 40,
      "end_line": 44,
      "general": false,
      "unverified": false,
      "what": "What is wrong.",
      "why": "Concrete failure scenario.",
      "fix": "How to fix it.",
      "suggestion": null
    }
  ]
}
```

The `reviewer` adds three fields: `acceptance`, `security_triage` and `simplification` (see its instructions).
