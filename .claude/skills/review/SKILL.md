---
name: review
description: Review a pull request in this repo with the reviewer, bugfinder and optional security-audit agents (or the spec-reviewer for spec PRs), running in the background, and post the result as one GitHub review with inline comments and a summary. Use when the user asks to review a PR or MR, e.g. "/review 5", "review PR 5", "review this PR", "let the agents review the MR", "run a security review on PR 7". Only when the user asks for a review; never start one on your own initiative, e.g. not automatically after opening a PR.
argument-hint: "[PR number] [--security | --no-security]"
---

# Review a pull request

You are the dispatcher. The agents review, and you collect, merge and post. The rules for PRs are in `WORKFLOW.md`, and the agents' shared rules are in `.claude/skills/review/protocol.md`.

Arguments: `$ARGUMENTS`

## 0. Guard: the review tooling must be trusted

The agents, their hook, the helper scripts, the project settings and `CLAUDE.md` (which every agent loads as instructions) come from the **local checkout**. If it contains a PR's changes to them, that PR would review itself with its own rules. So before anything else:
```bash
gh pr view <n> --json baseRefName          # <base>; <n> as in step 1
git fetch origin "<base>"
git diff --quiet "origin/<base>" -- .claude CLAUDE.md
git status --porcelain -- .claude CLAUDE.md   # must print nothing (catches untracked files)
```
- **Both pass** (the tooling equals the base branch, nothing untracked): continue.
- **Otherwise: stop.** Tell the user the local review tooling differs from `<base>`, usually because a PR that changes it is checked out, and ask them to switch to `<base>` or explicitly confirm.
- **Bootstrap exception:** if `<base>` has no `.claude/hooks/review-readonly.py` yet (the PR that introduces the tooling), continue, and say so in the summary.

## 1. Resolve the PR

- PR number: from the arguments, or else the PR of the current branch (`gh pr view --json number`). If there's none, ask which PR.
- Flags: `--security` forces the audit. `--no-security` skips it, and that overrides everything else.
- Fetch the facts:
  ```bash
  gh pr view <n> --json number,url,title,body,headRefName,headRefOid,baseRefName,files
  git fetch origin "pull/<n>/head" "<baseRefName>"
  ```
  Branch names are chosen by whoever opens the PR, so never paste them unquoted into a shell command. Fetching `pull/<n>/head` avoids using the branch name at all.
- Spec and subtask:
  - Since NB-004 a spec is implemented in one PR, so there's no subtask: `subtask: none`. Only older PRs carry one in the title (`feat(NB-002.5): …` gives `NB-002.5`).
  - The spec path comes from the spec link in the body (`specs/NB-003-….md`).
  - If either is missing, use `none`. The reviewer then flags the missing link.
- **Kind of PR:**
  - `spec` if the title starts with `docs(NB-XXX): spec` (`spec for …` or `spec change: …`, spec ID without a subtask number), **and** every changed file is Markdown, **and** at least one is `specs/NB-*.md`.
  - `code` otherwise.
  - If the user says which kind it is, that wins.
- `local_head_matches`: `true` only if `git rev-parse HEAD` equals `headRefOid` and `git status --porcelain` is empty.
- Commentable lines: `gh pr diff <n> | python3 -I .claude/skills/review/diff_lines.py`. Keep the output for step 4.
- **Round and `since_sha`:** look for earlier reviews of this PR with the marker `<!-- review-round: N head: <sha> -->`, for example with `gh pr view <n> --json reviews`.
  - Count only reviews whose author is the authenticated `gh` user (`gh api user --jq .login`), and only a marker on a line of its own, as written in step 5. A marker quoted inside a finding or posted by someone else doesn't count.
  - None found: `round: 1`, `since_sha: none`.
  - Otherwise take the highest N: `round: N+1` and `since_sha` = its head. If `git merge-base --is-ancestor <since_sha> <headRefOid>` exits with anything but 0 (not an ancestor after a force-push, or the sha is unknown locally), do a full review as `since_sha: none`, but keep counting rounds.

## 2. Decide on security-audit up front

For **spec PRs**, run security-audit only if `--security` is set. The spec-reviewer covers the security implications of the design. For **code PRs**, run it from the start if `--security` is set, or if any changed file matches:
- `infra/**`
- `frontend/src/app/api/**`, `frontend/src/proxy.ts`, `frontend/src/middleware.ts`, `frontend/src/lib/owner.ts`, `frontend/src/lib/supabase/**`, `frontend/next.config.*`, `frontend/vercel.json`
- `backend/src/db/**`, `backend/src/services/**`, `backend/src/supabase.ts`, `backend/src/env.ts`, `backend/src/rag/url-guard.ts`, `backend/src/rag/extract.ts`, `backend/src/ai/prompts.ts`
- `**/package.json`, `package-lock.json`, `**/.env.example`, `.github/**`, `.claude/**`

Remember the trigger (user, paths, or none yet) for the summary.

## 3. Launch the agents in the background

In **one** message, launch these agents with the Agent tool, in the background:
- **Code PR:** `reviewer` and `bugfinder`, plus `security-audit` if triggered.
- **Spec PR:** `spec-reviewer` only, plus `security-audit` if `--security` is set. There's no code for the reviewer to check against a spec, and no code for the bugfinder.

**Fresh eyes:** each agent starts without any context from this conversation.
- Launch them by their agent type. Never use a fork of this conversation.
- The prompt is **only** the input block below. Add no summary of the change, no reasoning from whoever wrote it, no hints, and no findings from earlier reviews.

Give each the same input block:

```
Review PR #<n> (<url>).
pr: <n>
head_sha: <headRefOid>
base: <baseRefName>
kind: <code|spec>
spec: <path or none>
subtask: <id or none>
local_head_matches: <true|false>
round: <N>
since_sha: <sha or none>
changed_files:
- <path>
Follow .claude/skills/review/protocol.md.
```

Then tell the user in one or two lines which agents are running, and why security-audit is or isn't among them. End your turn. Don't wait idle, and don't guess results.

**While agents run, leave the working tree alone.** Don't switch branches, pull, edit or commit until all agents have reported. Agents may read the local checkout when it matches the PR's commit. If the user asks for something that changes files, say the review is still running and do it once the review is posted, or offer to stop the review.

When the reviewer reports (code PRs): if its `security_triage.needed` is `true`, security-audit isn't running yet, and `--no-security` wasn't given, launch security-audit now with the same input block and tell the user. Post only once **all** launched agents have reported.

## 4. Merge the findings

- Take the JSON block at the end of each agent's answer.
- **If an agent returned no valid block,** the review is incomplete:
  - The verdict is ⚠️ **Review incomplete**, never ✅. Name the missing agent in the summary and continue with the others.
  - If the **reviewer** is missing: mark every acceptance criterion 👀. Its security triage is also missing, so launch security-audit before posting unless it already ran or `--no-security` was given. Say so in the summary.
  - If the **spec-reviewer** is missing, there is no review of the spec at all. Post only the ⚠️ verdict and the reason.
- **De-duplicate:** findings with the same file, overlapping lines and the same problem become one. Keep the highest severity and list all agents that found it.
- **Place each finding:**
  - **Inline** if `general` is `false` and `start_line..end_line` lies inside one range from step 1 for that path.
  - **Summary** otherwise (general, or outside the diff), with `path:start_line`.
- **Verdict**, first match wins:
  - 🔁 **Changes needed:** any blocker, an acceptance criterion "not met", or (spec PRs) `readiness` is "needs work".
  - ⚠️ **Review incomplete:** an agent result is missing.
  - ✅ **Ready to merge:** otherwise.

## 5. Post one GitHub review

Inline comment body:

```markdown
🟠 **Should fix** · bugfinder — <title>

<what>

**Why:** <why>

**Fix:** <fix>
```

- The badge is 🔴 **Blocker**, 🟠 **Should fix** or 🟡 **Nit**. Add `(unverified)` after the agent name when it applies.
- If there's a suggestion, append it as a ` ```suggestion ` block.

Summary body: emoji headlines, bullets, no tables.

```markdown
## 🔁 Changes needed · 1 blocker · 2 should fix · 3 nits · 5 inline comments
<!-- or: ## ✅ Ready to merge · …   or: ## ⚠️ Review incomplete · bugfinder returned no result · … -->

Reviewed by reviewer, bugfinder, security-audit at <short sha> · round <N> (re-reviews: commits since <short since_sha>).

<!-- review-round: <N> head: <headRefOid> -->

## 🎯 Spec and acceptance criteria
- ✅ / ❌ / 👀 <criterion>: <evidence>     (👀 = needs manual check)

## 🧩 General findings
- 🟠 **<title>** · <agents> · `path:line` (if any)
  - <what>. **Why:** <why>. **Fix:** <fix>

## 🛡️ Security
- Ran: triggered by <user | paths: … | reviewer: reason>. <summary, or "no findings">
- or: Skipped: <--no-security | not triggered; reviewer triage: reason>

## 💡 Simplification
- <idea> (only ideas not tied to one place; omit the section if empty)
```

- Leave out "General findings" when it would be empty, and write "No findings" where a whole review has none.
- **Always include the `review-round` marker.** The next `/review` uses it to find the round and the commits to focus on.
- **Spec PRs** use the same layout with two changes:
  - Replace "🎯 Spec and acceptance criteria" with `## 📐 Spec readiness`: ready or needs work, and the `readiness_reason`.
  - Add `## ❓ Questions for the author` with the spec-reviewer's `questions`, as a numbered list (omit it if empty).
  - The 🛡️ Security section says whether security-audit ran (`--security`) or that the spec-reviewer covered the design's security implications.
- Post it:
  1. Write the payload as JSON with the Write tool into your session's scratchpad directory, never `/tmp` or the repo. Build it with a JSON serializer (e.g. a short Python script in the scratchpad), because comment bodies contain quotes, backticks and newlines.
     ```json
     { "commit_id": "<headRefOid>", "event": "COMMENT", "body": "<summary>",
       "comments": [ { "path": "…", "line": <end_line>, "side": "RIGHT",
                       "start_line": <start_line>, "start_side": "RIGHT", "body": "…" } ] }
     ```
     Omit `start_line` and `start_side` when `start_line == end_line`.
  2. **Secret scan:** run `python3 -I .claude/skills/review/secret_scan.py <file>`. If it doesn't exit 0, **don't post**: delete the file and tell the user what was found (it's redacted). A secret in a review would be public.
  3. Send it: `gh api --method POST repos/{owner}/{repo}/pulls/<n>/reviews --input <file>`, then delete the file.
  4. If GitHub rejects it (422), it usually doesn't say which comment failed. Move **all** inline comments into the summary (with `path:line`) and post once more. Never post a second review on top of a successful one.

## 6. Report to the user

Three to five lines: the verdict, the counts, whether security ran, the review link. Then stop. Fixing findings is a separate request, and it follows the loop gate in `WORKFLOW.md` §5.
