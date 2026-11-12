---
name: review
description: Review a pull request in this repo with the reviewer, bugfinder and optional security-audit agents, running in the background, and post the result as one GitHub review with inline comments and a summary. Use when the user asks to review a PR or MR, e.g. "/review 5", "review PR 5", "review this PR", "let the agents review the MR", "run a security review on PR 7". Only when the user asks for a review; never start one on your own initiative, e.g. not automatically after opening a PR.
argument-hint: "[PR number] [--security | --no-security]"
---

# Review a pull request

You are the dispatcher. The agents review, and you collect, merge and post. The rules for PRs are in `WORKFLOW.md`, and the agents' shared rules are in `.claude/skills/review/protocol.md`.

Arguments: `$ARGUMENTS`

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
  - The subtask ID comes from the title (`feat(NB-003.2): …` gives `NB-003.2`).
  - The spec path comes from the spec link in the body (`specs/NB-003-….md`).
  - If either is missing, use `none`. The reviewer then flags the missing link.
- `local_head_matches`: `true` only if `git rev-parse HEAD` equals `headRefOid` and `git status --porcelain` is empty.
- Commentable lines: `gh pr diff <n> | python3 -I .claude/skills/review/diff_lines.py`. Keep the output for step 4.

## 2. Decide on security-audit up front

Run it from the start if `--security` is set, or if any changed file matches:
- `infra/**`
- `frontend/src/app/api/**`, `frontend/src/proxy.ts`, `frontend/src/middleware.ts`, `frontend/src/lib/owner.ts`, `frontend/src/lib/supabase/**`, `frontend/next.config.*`, `frontend/vercel.json`
- `backend/src/db/**`, `backend/src/services/**`, `backend/src/supabase.ts`, `backend/src/env.ts`, `backend/src/rag/url-guard.ts`, `backend/src/rag/extract.ts`, `backend/src/ai/prompts.ts`
- `**/package.json`, `package-lock.json`, `**/.env.example`, `.github/**`, `.claude/**`

Remember the trigger (user, paths, or none yet) for the summary.

## 3. Launch the agents in the background

In **one** message, launch `reviewer`, `bugfinder` and, if triggered, `security-audit` with the Agent tool, in the background.

**Fresh eyes:** each agent starts without any context from this conversation.
- Launch them by their agent type. Never use a fork of this conversation.
- The prompt is **only** the input block below. Add no summary of the change, no reasoning from whoever wrote it, no hints, and no findings from earlier reviews.

Give each the same input block:

```
Review PR #<n> (<url>).
pr: <n>
head_sha: <headRefOid>
base: <baseRefName>
spec: <path or none>
subtask: <id or none>
local_head_matches: <true|false>
changed_files:
- <path>
Follow .claude/skills/review/protocol.md.
```

Then tell the user in one or two lines which agents are running, and why security-audit is or isn't among them. End your turn. Don't wait idle, and don't guess results.

**While agents run, leave the working tree alone.** Don't switch branches, pull, edit or commit until all agents have reported. Some agents read and test the local checkout. If the user asks for something that changes files, say the review is still running and do it once the review is posted, or offer to stop the review.

When the reviewer reports: if its `security_triage.needed` is `true`, security-audit isn't running yet, and `--no-security` wasn't given, launch security-audit now with the same input block and tell the user. Post only once **all** launched agents have reported.

## 4. Merge the findings

- Take the JSON block at the end of each agent's answer.
- **If an agent returned no valid block,** the review is incomplete:
  - The verdict is ⚠️ **Review incomplete**, never ✅. Name the missing agent in the summary and continue with the others.
  - If the **reviewer** is missing: mark every acceptance criterion 👀. Its security triage is also missing, so launch security-audit before posting unless it already ran or `--no-security` was given. Say so in the summary.
- **De-duplicate:** findings with the same file, overlapping lines and the same problem become one. Keep the highest severity and list all agents that found it.
- **Place each finding:**
  - **Inline** if `general` is `false` and `start_line..end_line` lies inside one range from step 1 for that path.
  - **Summary** otherwise (general, or outside the diff), with `path:start_line`.
- **Verdict**, first match wins:
  - 🔁 **Changes needed:** any blocker, or an acceptance criterion "not met".
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

Reviewed by reviewer, bugfinder, security-audit at <short sha>.

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
- Post it:
  1. Write the payload as JSON with the Write tool into your session's scratchpad directory, never `/tmp` or the repo. Build it with a JSON serializer (e.g. a short Python script in the scratchpad), because comment bodies contain quotes, backticks and newlines.
     ```json
     { "commit_id": "<headRefOid>", "event": "COMMENT", "body": "<summary>",
       "comments": [ { "path": "…", "line": <end_line>, "side": "RIGHT",
                       "start_line": <start_line>, "start_side": "RIGHT", "body": "…" } ] }
     ```
     Omit `start_line` and `start_side` when `start_line == end_line`.
  2. Send it: `gh api --method POST repos/{owner}/{repo}/pulls/<n>/reviews --input <file>`, then delete the file.
  3. If GitHub rejects it (422), it usually doesn't say which comment failed. Move **all** inline comments into the summary (with `path:line`) and post once more. Never post a second review on top of a successful one.

## 6. Report to the user

Three to five lines: the verdict, the counts, whether security ran, the review link. Then stop. Fixing findings is a separate request.
