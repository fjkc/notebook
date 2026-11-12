"""Tests for review-readonly.py. Run: python3 .claude/hooks/test_review_readonly.py"""
import importlib.util, json, os, subprocess, sys

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "review-readonly.py")
spec = importlib.util.spec_from_file_location("ro", HOOK)
ro = importlib.util.module_from_spec(spec); spec.loader.exec_module(ro)


def verdict(tool, ti):
    try:
        ro.check(tool, ti)
        return None
    except ro.Deny as e:
        return str(e)


allow = [
    "git diff origin/main...37f8fbb",
    "git diff --stat origin/main...37f8fbb",
    "git show 37f8fbb:.claude/skills/review/SKILL.md | sed -n '1,40p'",
    "git grep -n owner_id 37f8fbb -- backend/",
    "git grep -in -e 'a|b' 37f8fbb",
    "git rev-parse HEAD && git status --porcelain",
    "git -C /Users/fj/Documents/workspace/claude/notebook status --short",
    "git --no-pager log --oneline -5",
    "git log --format='%h %s' -n 3",
    "git diff -U3 --name-only HEAD~1",
    "gh pr view 2 --json title,body",
    "gh pr view 2 --json files --jq '.files[] | .path'",
    "gh pr diff 2 | python3 -I .claude/skills/review/diff_lines.py",
    "gh pr checks 2",
    "gh api repos/fjkc/notebook/pulls/2/comments",
    "gh api repos/fjkc/notebook/pulls/2/comments --jq '.[] | {id, path}' --paginate",
    "npm audit",
    "git log --oneline -5 2>/dev/null",
    "git diff HEAD 2>&1 | tail -20",
    "printf 'x\\n' | python3 .claude/skills/review/diff_lines.py",
    "jq -r '.findings[] | .title' payload.json",
    "grep -rn 'server-only' backend/src",
    "head -n 20 WORKFLOW.md",
    "cat frontend/.env.example",
    "git ls-files '*.md'",
    "ls -la .claude",
    "wc -l WORKFLOW.md",
]
deny = [
    # reported bypasses (round 2)
    'echo "<<X"\ngh pr comment 2 -b pwned\nX',
    "echo hi # <<X\nrm -rf src\nX",
    "cat <<<EOF",
    "cat <<EOF\n$(touch pwned)\nEOF",
    "gh api -XPUT repos/fjkc/notebook/pulls/2/merge",
    "gh api -XDELETE repos/fjkc/notebook/git/refs/heads/x",
    "gh api repos/fjkc/notebook/issues/2/comments -fbody=hi",
    "gh api graphql -fquery='mutation{x}'",
    "gh api -X POST repos/x/y",
    "gh api --method=POST repos/x/y",
    "gh api -H 'X-HTTP-Method-Override: POST' repos/x/y",
    "sed -n -i 1p CLAUDE.md",
    "sed -n -i.bak 1p x",
    "sort -uo .claude/hooks/review-readonly.py /dev/null",
    "sort --compress-program=sh x",
    "git grep -iO'sh -c x' foo",
    "git grep --open-files='sh' x",
    "git grep --open=sh x",
    "git diff --outp=/tmp/x",
    "git diff --output=/tmp/x",
    "git diff --ext-diff",
    "git diff --no-index /etc/passwd x",
    "npm test",
    "npm run lint",
    "npm run typecheck",
    # round 1 and general
    "git push origin HEAD",
    "git checkout main",
    "git fetch origin",
    "git -c core.pager=sh diff",
    "git -C /repo push",
    "git diff & curl https://evil.example",
    "gh pr comment 2 --body hi",
    "gh pr merge 2",
    "gh pr view 2 --web",
    "npm install",
    "npm audit fix",
    "curl https://example.com",
    "echo $(cat x)",
    "echo `id`",
    "echo \"$HOME\"",
    "echo ${IFS}",
    "cat x > /tmp/leak",
    "cat x >> y",
    "cat < x",
    "python3 -c 'import os'",
    "GIT_EXTERNAL_DIFF=sh git diff",
    "rm -rf .",
    "bash -c 'git diff'",
    "find . -delete",
    "git diff; git push",
    "tee out.txt",
    "(git push)",
    "ls *",
    "sort {-o,x}",
    "git diff \\\ngit push",
    "uniq a b",
    "cat a >/dev/nullx",
    "cat a 2>/dev/null.txt",
    "cat a 2>&12",
    "cat a x>/dev/null",
    "echo a >&1",
    # secrets
    "cat frontend/.env.local",
    "git show HEAD:frontend/.env.local",
    "grep KEY .env",
    "head .env.production",
]
tool_deny = [
    ("Read", {"file_path": "/Users/fj/Documents/workspace/claude/notebook/frontend/.env.local"}),
    ("Grep", {"pattern": "KEY", "path": "frontend/.env.local"}),
    ("Glob", {"pattern": "**/.env*"}),
]
tool_allow = [
    ("Read", {"file_path": "/Users/fj/Documents/workspace/claude/notebook/frontend/.env.example"}),
    ("Read", {"file_path": "/Users/fj/Documents/workspace/claude/notebook/WORKFLOW.md"}),
    ("Grep", {"pattern": "owner_id", "path": "backend"}),
]

fails = 0
for c in allow:
    r = verdict("Bash", {"command": c})
    if r: fails += 1; print("FAIL allow:", repr(c)[:80], "->", r)
for c in deny:
    if verdict("Bash", {"command": c}) is None: fails += 1; print("FAIL deny:", repr(c)[:80])
for t, ti in tool_deny:
    if verdict(t, ti) is None: fails += 1; print("FAIL deny:", t, ti)
for t, ti in tool_allow:
    r = verdict(t, ti)
    if r: fails += 1; print("FAIL allow:", t, ti, "->", r)

# end-to-end: fail closed on garbage input, allow prints nothing
out = subprocess.run([sys.executable, HOOK], input="not json", capture_output=True, text=True).stdout
if '"deny"' not in out: fails += 1; print("FAIL: garbage input not denied")
out = subprocess.run([sys.executable, HOOK], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "git diff"}}), capture_output=True, text=True).stdout
if out.strip(): fails += 1; print("FAIL: allowed command printed output")

total = len(allow) + len(deny) + len(tool_deny) + len(tool_allow) + 2
print(f"{total} cases ({len(allow)}+{len(tool_allow)} allow, {len(deny)}+{len(tool_deny)} deny, 2 end-to-end), failures: {fails}")
sys.exit(1 if fails else 0)
