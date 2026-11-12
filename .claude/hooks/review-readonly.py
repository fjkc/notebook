#!/usr/bin/env python3
"""PreToolUse hook for the review agents: allow only read-only Bash commands.

Default deny. A command is allowed only if every pipeline segment is on the
allowlist below. Heredoc bodies are treated as stdin data. Used from the
frontmatter of .claude/agents/{reviewer,bugfinder,security-audit}.md.
"""
import json
import re
import shlex
import sys

HEREDOC = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
SAFE_REDIRECTS = re.compile(r"\s*(2>&1|2>\s*/dev/null|>\s*/dev/null)")
SEPARATORS = re.compile(r"&&|\|\||;|\||\n")

GIT_SUB = {"diff", "show", "log", "ls-files", "grep", "rev-parse", "status", "blame", "cat-file"}
GIT_BAD_FLAGS = ("--output", "--ext-diff", "-O", "--open-files-in-pager", "--no-index")
SIMPLE = {"head", "tail", "wc", "grep", "cut", "jq", "echo", "printf", "ls", "cat", "true"}
DIFF_LINES = ".claude/skills/review/diff_lines.py"


def strip_heredocs(cmd):
    lines, out, pending, i = cmd.split("\n"), [], [], 0
    while i < len(lines):
        out.append(lines[i])
        pending += [m.group(2) for m in HEREDOC.finditer(lines[i])]
        i += 1
        while pending:
            delim = pending.pop(0)
            while i < len(lines) and lines[i].strip() != delim:
                i += 1
            i += 1
    return HEREDOC.sub(" ", "\n".join(out))


def segment_ok(argv):
    """Return None if allowed, else a reason."""
    if not argv:
        return None
    if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", argv[0]):
        return "environment assignments are not allowed"
    cmd, args = argv[0], argv[1:]
    if cmd == "git":
        # Global options that only change where or how git reads: -C <dir>, --no-pager.
        # (-c stays forbidden: config values like core.pager can run commands.)
        while args[:1] == ["--no-pager"] or args[:1] == ["-C"] and len(args) > 1:
            args = args[1:] if args[0] == "--no-pager" else args[2:]
        if not args or args[0] not in GIT_SUB:
            return "git: only diff, show, log, ls-files, grep, rev-parse, status, blame, cat-file"
        if any(a.startswith(GIT_BAD_FLAGS) for a in args):
            return "git: --output, --ext-diff, -O and --no-index are not allowed"
        return None
    if cmd == "gh":
        if args[:2] in (["pr", "view"], ["pr", "diff"]):
            return "gh: --web is not allowed" if any(a in ("--web", "-w") for a in args) else None
        if args[:1] == ["api"]:
            for i, a in enumerate(args):
                if a in ("-f", "-F", "--field", "--raw-field", "--input") or a.startswith(("--field=", "--raw-field=", "--input=")):
                    return "gh api: request fields and --input are not allowed (read-only)"
                if a in ("-X", "--method") and (i + 1 >= len(args) or args[i + 1].upper() != "GET"):
                    return "gh api: only GET requests"
                if a.startswith("--method=") and a.split("=", 1)[1].upper() != "GET":
                    return "gh api: only GET requests"
            return None
        return "gh: only pr view, pr diff and api GET"
    if cmd == "npm":
        if args == ["audit"] or args[:1] == ["audit"] and "fix" not in args:
            return None
        if args in (["test"], ["run", "test"], ["run", "lint"], ["run", "typecheck"]):
            return None
        return "npm: only audit, test, run lint, run typecheck"
    if cmd == "sed":
        script = [a for a in args if not a.startswith("-")]
        if "-n" in args and script and re.fullmatch(r"[0-9$,;p ]+", script[0]):
            return None
        return "sed: only `sed -n '<lines>p'`"
    if cmd == "sort":
        return "sort: -o is not allowed" if any(a.startswith(("-o", "--output")) for a in args) else None
    if cmd in ("python3", "python"):
        rest = [a for a in args if a != "-I"]
        return None if rest == [DIFF_LINES] else f"python: only {DIFF_LINES}"
    if cmd in SIMPLE:
        return None
    return f"`{cmd}` is not on the review allowlist"


def check(command):
    cmd = strip_heredocs(command)
    if "`" in cmd or "$(" in cmd or "<(" in cmd or ">(" in cmd:
        return "command substitution is not allowed"
    cmd = SAFE_REDIRECTS.sub(" ", cmd)
    if ">" in cmd:
        return "output redirection is not allowed"
    for seg in SEPARATORS.split(cmd):
        if seg.strip() in ("", "&"):
            continue
        try:
            argv = shlex.split(seg)
        except ValueError:
            return "could not parse the command"
        if any("&" in a for a in argv):
            return "background jobs are not allowed"
        reason = segment_ok(argv)
        if reason:
            return reason
    return None


if __name__ == "__main__":
    data = json.load(sys.stdin)
    if data.get("tool_name") == "Bash":
        reason = check((data.get("tool_input") or {}).get("command", ""))
        if reason:
            print(json.dumps({"hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": f"Review agents are read-only: {reason}. See .claude/skills/review/protocol.md.",
            }}))
