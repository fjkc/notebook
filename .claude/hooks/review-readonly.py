#!/usr/bin/env python3
"""PreToolUse hook for the review agents: a deliberately small, read-only tool surface.

Bash allows only:
  git diff | show | log | grep | rev-parse | status | ls-files   (exact per-command flag lists)
  gh pr view | diff | checks <number>                           (no --jq/--template)
  optionally followed by `| head -n N` or `| tail -n N`
Every flag must match an allowed token exactly: no flag groups, no attached values,
no abbreviations. Anything the tokenizer doesn't fully understand is denied.

Read / Grep / Glob: only paths inside the project, never local env files (any letter case,
also checked on the symlink-resolved path). Grep's `glob` parameter is denied.

Default deny. Fails closed: errors deny here, and the agent frontmatter adds `|| exit 2`
so even a crash of this script blocks the tool call.
"""
import json
import os
import re
import sys


class Deny(Exception):
    pass


PROJECT = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
# Case-insensitive: macOS file systems are, so `.ENV.local` opens `.env.local`.
ENV_FILE = re.compile(r"(^|[/:=])\.env(?!\.example$)[\w.-]*$|(^|[/:=])\.env(?!\.example\b)[\w.-]*[/:]", re.IGNORECASE)
NUM = r"\d{1,6}"

# ---------- tokenizer ----------

def tokenize(cmd):
    """Return a list of pipeline stages (lists of words). Raise Deny on anything unsafe.

    Only `|` joins stages; `;`, `&&`, `||`, `&` and newlines are denied, so a call
    is exactly one pipeline.
    """
    stages, words, word, in_word = [], [], "", False
    i, n = 0, len(cmd)

    def end_word():
        nonlocal word, in_word
        if in_word:
            words.append(word)
        word, in_word = "", False

    while i < n:
        ch = cmd[i]
        if ch in " \t":
            end_word()
        elif ch == "'":
            j = cmd.find("'", i + 1)
            if j < 0:
                raise Deny("unbalanced quote")
            word += cmd[i + 1:j]
            in_word, i = True, j
        elif ch == '"':
            j = i + 1
            while j < n and cmd[j] != '"':
                if cmd[j] in "$`\\":
                    raise Deny("expansions and escapes are not allowed (use single quotes)")
                word += cmd[j]
                j += 1
            if j >= n:
                raise Deny("unbalanced quote")
            in_word, i = True, j
        elif ch == "|":
            if cmd[i + 1:i + 2] in ("|", "&"):
                raise Deny("only plain pipes are allowed")
            end_word()
            if not words:
                raise Deny("empty pipeline stage")
            stages.append(words)
            words = []
        elif ch == ">" and not in_word and re.match(r">\s*/dev/null(?=$|\s)", cmd[i:]):
            i += re.match(r">\s*/dev/null", cmd[i:]).end()
            continue
        elif ch == "2" and not in_word and re.match(r"2>(&1|\s*/dev/null)(?=$|\s)", cmd[i:]):
            i += re.match(r"2>(&1|\s*/dev/null)", cmd[i:]).end()
            continue
        elif ch.isalnum() or ch in "-_./:=,@^~+%":
            if ch == "~" and not in_word:
                raise Deny("home paths are not allowed")
            word += ch
            in_word = True
        else:
            raise Deny(f"character {ch!r} is not allowed outside single quotes (one simple command or pipeline per call)")
        i += 1
    end_word()
    if words:
        stages.append(words)
    if not stages:
        raise Deny("empty command")
    return stages


# ---------- argument checks ----------

def check_args(args, flags, valued=(), patterns=(), positional=None):
    """Every '-' word must be an exact token in `flags`, match one of `patterns`, or be
    in `valued` (then the next word is its value). '--' switches to positionals only.
    `positional(word)` validates the rest."""
    i, only_pos = 0, False
    while i < len(args):
        a = args[i]
        if not only_pos and a == "--":
            only_pos = True
        elif not only_pos and a.startswith("-"):
            if a in valued:
                if i + 1 >= len(args):
                    raise Deny(f"{a} needs a value")
                i += 1
            elif a not in flags and not any(re.fullmatch(p, a) for p in patterns):
                raise Deny(f"flag {a} is not allowed here")
        elif positional:
            positional(a)
        i += 1


def repo_word(a):
    """A revision, rev:path, or path inside the repo."""
    path = a.split(":", 1)[1] if ":" in a else a
    if path.startswith("/") or ".." in path.split("/"):
        raise Deny(f"path {a} must be relative and inside the repo")


FMT = r"--(format|pretty)=[^\n]{1,200}"
GIT = {
    "diff": dict(flags={"--stat", "--name-only", "--name-status", "--numstat", "--no-color", "-w", "--merge-base"},
                 patterns=(r"-U" + NUM, r"--unified=" + NUM, r"--diff-filter=[ACDMRTUXB]+"), positional=repo_word),
    "show": dict(flags={"--stat", "--name-only", "--name-status", "--no-patch", "--no-color", "--oneline"},
                 patterns=(FMT,), positional=repo_word),
    "log": dict(flags={"--oneline", "--stat", "--name-only", "--name-status", "--no-color", "--reverse",
                       "--first-parent", "--no-merges", "-p"},
                valued=("-n",), patterns=(r"-" + NUM, r"--max-count=" + NUM, FMT), positional=repo_word),
    "grep": dict(flags={"-n", "-i", "-l", "-w", "-F", "-E", "-c", "--count", "-h", "-I"},
                 valued=("-e",), positional=repo_word),
    "rev-parse": dict(flags={"--short", "--verify", "--abbrev-ref", "--show-toplevel"}, positional=repo_word),
    "status": dict(flags={"--porcelain", "--short"}),
    "ls-files": dict(flags=set(), positional=repo_word),
}


def rule_git(args):
    while args[:1] == ["--no-pager"] or args[:1] == ["-C"]:
        if args[0] == "-C":
            if len(args) < 2 or os.path.realpath(args[1]) != PROJECT:
                raise Deny("git -C is only allowed with the project directory")
            args = args[2:]
        else:
            args = args[1:]
    if not args or args[0] not in GIT:
        raise Deny("git: only " + ", ".join(GIT))
    check_args(args[1:], **GIT[args[0]])


def pr_number(a):
    if not re.fullmatch(NUM, a):
        raise Deny("gh pr: the PR must be given as a number")


def rule_gh(args):
    sub = args[:2]
    if sub == ["pr", "view"]:
        check_args(args[2:], {"--comments"}, valued=("--json",), positional=pr_number)
    elif sub == ["pr", "diff"]:
        check_args(args[2:], {"--name-only", "--patch"}, positional=pr_number)
    elif sub == ["pr", "checks"]:
        check_args(args[2:], set(), positional=pr_number)
    else:
        raise Deny("gh: only pr view, pr diff and pr checks")


def rule_filter(words):
    if words[0] in ("head", "tail") and len(words) == 3 and words[1] == "-n" and re.fullmatch(NUM, words[2]):
        return
    raise Deny("after a pipe only `head -n N` or `tail -n N` is allowed")


def check_bash(command):
    if "\n" in command or "\r" in command:
        raise Deny("one command per call (no newlines)")
    stages = tokenize(command)
    for words in stages:
        if any(ENV_FILE.search(w) for w in words):
            raise Deny("local env files (.env*) are off limits")
    first, rest = stages[0], stages[1:]
    if first[0] == "git":
        rule_git(first[1:])
    elif first[0] == "gh":
        rule_gh(first[1:])
    else:
        raise Deny(f"`{first[0]}` is not allowed; use git, gh, or the Read/Grep/Glob tools")
    for stage in rest:
        rule_filter(stage)


def check_path(value, label):
    if not isinstance(value, str) or not value:
        return
    if ENV_FILE.search(value):
        raise Deny("local env files (.env*) are off limits")
    if label == "pattern":  # Glob tool pattern (lists names only): no env files, no escaping the project
        if ".env" in value.lower() and not value.lower().endswith(".env.example"):
            raise Deny("local env files (.env*) are off limits")
        if value.startswith(("/", "~")) or ".." in value.split("/"):
            raise Deny("glob patterns must stay inside the project")
        return
    full = os.path.realpath(os.path.join(PROJECT, os.path.expanduser(value)))
    if full != PROJECT and not full.startswith(PROJECT + os.sep):
        raise Deny("only files inside the project are readable")
    if ENV_FILE.search(full):  # a harmless-looking symlink may point at an env file
        raise Deny("local env files (.env*) are off limits")


def check(tool, ti):
    if tool == "Bash":
        check_bash(ti.get("command", ""))
    elif tool in ("Read", "Grep", "Glob"):
        check_path(ti.get("file_path"), "path")
        check_path(ti.get("path"), "path")
        if ti.get("glob"):  # ripgrep globs override ignore rules and are easy to disguise
            raise Deny("Grep's glob parameter is not allowed; narrow with path instead")
        if tool == "Glob":
            check_path(ti.get("pattern"), "pattern")
    else:
        raise Deny(f"tool {tool} is not allowed for review agents")


def main():
    try:
        data = json.load(sys.stdin)
        check(data.get("tool_name", ""), data.get("tool_input") or {})
        return
    except Deny as e:
        reason = str(e)
    except Exception as e:  # fail closed
        reason = f"hook error ({type(e).__name__}), denied to be safe"
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": f"Review agents are read-only: {reason}. See .claude/skills/review/protocol.md.",
    }}))


if __name__ == "__main__":
    main()
