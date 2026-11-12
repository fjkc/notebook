#!/usr/bin/env python3
"""PreToolUse hook for the review agents: read-only, default deny, fail closed.

Bash: a quote-aware tokenizer splits the command into words and operators.
Anything it doesn't fully understand is denied (heredocs, expansions, subshells,
unquoted globs, redirects other than 2>&1 and >/dev/null). Every segment must be
an allowlisted command, and every flag must be on that command's flag allowlist,
so abbreviations, flag groups and attached values can't sneak through.

Read / Grep / Glob: deny paths to local env files (.env*, except .env.example).
Used from the frontmatter of the agents in .claude/agents/.
"""
import json
import re
import sys


class Deny(Exception):
    pass


ENV_FILE = re.compile(r"(^|[/:=])\.env(?!\.example\b)[\w.-]*")

# ---------- tokenizer ----------

def tokenize(cmd):
    """Return a list of segments (lists of words). Raise Deny on anything unsafe."""
    segments, words, word, in_word = [], [], "", False
    i, n = 0, len(cmd)

    def end_word():
        nonlocal word, in_word
        if in_word:
            words.append(word)
        word, in_word = "", False

    def end_segment():
        nonlocal words
        end_word()
        if words:
            segments.append(words)
        words = []

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
                if cmd[j] in "$`":
                    raise Deny("expansions are not allowed (use single quotes)")
                if cmd[j] == "\\" and j + 1 < n:
                    j += 1
                word += cmd[j]
                j += 1
            if j >= n:
                raise Deny("unbalanced quote")
            in_word, i = True, j
        elif ch == "\\":
            if i + 1 >= n or cmd[i + 1] == "\n":
                raise Deny("line continuations are not allowed")
            word += cmd[i + 1]
            in_word, i = True, i + 1
        elif ch in "$`":
            raise Deny("expansions and command substitution are not allowed")
        elif ch in "*?[]{}":
            raise Deny("unquoted globs and braces are not allowed (quote them)")
        elif ch in "()":
            raise Deny("subshells are not allowed")
        elif ch == "#" and not in_word:
            raise Deny("comments are not allowed")
        elif ch == "<":
            raise Deny("input redirection and heredocs are not allowed")
        elif ch == ">":
            rest = cmd[i:]
            m = re.match(r"(?:>&1|>\s*/dev/null)(?=$|[\s|;&])", rest)
            if m and (word in ("", "1", "2") and (word != "" or rest.startswith(">"))):
                if m.group(0) == ">&1" and word != "2":
                    raise Deny("output redirection is not allowed")
                word, in_word = "", False
                i += m.end()
                continue
            raise Deny("output redirection is not allowed (only 2>&1 and >/dev/null)")
        elif ch in "|;\n":
            if ch == "|" and cmd[i + 1:i + 2] == "&":
                raise Deny("|& is not allowed")
            end_segment()
            if ch == "|" and cmd[i + 1:i + 2] == "|":
                i += 1
        elif ch == "&":
            if cmd[i + 1:i + 2] != "&":
                raise Deny("background jobs are not allowed")
            end_segment()
            i += 1
        else:
            word += ch
            in_word = True
        i += 1
    end_segment()
    return segments


# ---------- per-command rules ----------

def check_flags(args, short_bool, long_bool, long_valued, short_valued=(), short_attached=None, valued_next=()):
    """Allowlist flags. Positionals (not starting with '-') pass. '--' ends flags."""
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--":
            return
        if not a.startswith("-") or a == "-":
            i += 1
            continue
        if a.startswith("--"):
            name, eq, _ = a[2:].partition("=")
            if eq and name in long_valued:
                pass
            elif not eq and name in long_bool:
                pass
            elif not eq and name in long_valued:
                i += 1  # value in the next word
            else:
                raise Deny(f"flag {a.split('=')[0]} is not on the allowlist")
        elif a in valued_next:
            i += 1
        elif short_attached and re.fullmatch(short_attached, a):
            pass
        elif a[1:].isdigit():
            pass
        elif all(c in short_bool for c in a[1:]):
            pass
        else:
            raise Deny(f"flag {a} is not on the allowlist")
        i += 1


GIT_SUB = {"diff", "show", "log", "ls-files", "grep", "rev-parse", "status", "blame", "cat-file"}
GIT_SHORT = set("pbwRMzinlEFchHvsatqLu")  # no O (pager), no o-ambiguity worries: all read-only
GIT_LONG_BOOL = {
    "stat", "numstat", "shortstat", "summary", "name-only", "name-status", "oneline", "patch", "no-patch",
    "graph", "decorate", "all", "reverse", "follow", "first-parent", "no-merges", "merges", "topo-order",
    "porcelain", "short", "branch", "show-toplevel", "verify", "cached", "staged", "count", "ignore-case",
    "line-number", "files-with-matches", "no-color", "merge-base", "no-renames", "find-renames", "heading",
    "break", "function-context", "show-function", "full-name", "others", "ignored", "exclude-standard",
    "deleted", "modified", "stage", "error-unmatch", "quiet", "exit-code", "ignore-all-space",
    "ignore-space-change", "relative", "word-diff", "full-history", "abbrev-ref", "extended-regexp",
    "fixed-strings", "word-regexp", "invert-match", "untracked-files",
}
GIT_LONG_VALUED = {
    "format", "pretty", "max-count", "since", "until", "after", "before", "author", "grep", "diff-filter",
    "unified", "color", "abbrev", "date", "untracked-files", "word-diff", "short", "find-renames",
}


def rule_git(args):
    while args[:1] == ["--no-pager"] or (args[:1] == ["-C"] and len(args) > 1):
        args = args[1:] if args[0] == "--no-pager" else args[2:]
    if not args or args[0] not in GIT_SUB:
        raise Deny("git: only " + ", ".join(sorted(GIT_SUB)) + " (global options: -C <dir>, --no-pager)")
    check_flags(args[1:], GIT_SHORT, GIT_LONG_BOOL, GIT_LONG_VALUED,
                short_attached=r"-[UABCnSGL].+", valued_next=("-e", "-n", "-A", "-B", "-C", "-U", "-S", "-G", "-L"))


def rule_gh(args):
    if args[:2] in (["pr", "view"], ["pr", "diff"], ["pr", "checks"]):
        check_flags(args[2:], set("c"), {"comments", "name-only", "patch"}, {"json", "jq", "color", "template"},
                    valued_next=("-q", "-t"))
    elif args[:1] == ["api"]:
        rest = args[1:]
        check_flags(rest, set("i"), {"paginate", "slurp", "include", "silent"}, {"jq", "cache"},
                    valued_next=("-q",))
        endpoints = [a for a in rest if not a.startswith("-")]
        if any(e == "graphql" for e in endpoints):
            raise Deny("gh api graphql is not allowed")
    else:
        raise Deny("gh: only pr view, pr diff, pr checks and api (GET)")


def rule_simple(cmd, args):
    if cmd in ("head", "tail"):
        check_flags(args, set("qv"), set(), {"lines", "bytes"}, short_attached=r"-[nc]\d+",
                    valued_next=("-n", "-c"))
    elif cmd == "wc":
        check_flags(args, set("lwcm"), set(), set())
    elif cmd == "cut":
        check_flags(args, set("s"), set(), {"delimiter", "fields", "characters", "bytes"},
                    short_attached=r"-[dfcb].+", valued_next=("-d", "-f", "-c", "-b"))
    elif cmd == "jq":
        check_flags(args, set("rcensjS"), {"raw-output", "compact-output", "slurp", "exit-status", "sort-keys"},
                    {"arg"}, valued_next=())
    elif cmd == "grep":
        check_flags(args, set("inlvcwhHoErFqsLZ"), {"color", "count", "ignore-case", "line-number"},
                    {"color", "include", "exclude", "context"}, short_attached=r"-[ABCme]\S*",
                    valued_next=("-e", "-A", "-B", "-C", "-m"))
    elif cmd == "sed":
        flags = [a for a in args if a.startswith("-")]
        script = [a for a in args if not a.startswith("-")]
        if flags != ["-n"] or not script or not re.fullmatch(r"[0-9$,;p ]+", script[0]):
            raise Deny("sed: only `sed -n '<lines>p'`")
    elif cmd == "ls":
        check_flags(args, set("la1AhR"), set(), set())
    elif cmd in ("echo", "printf", "cat"):
        if cmd == "cat":
            check_flags(args, set("n"), set(), set())
    elif cmd in ("python3", "python"):
        if [a for a in args if a != "-I"] != [".claude/skills/review/diff_lines.py"]:
            raise Deny("python: only .claude/skills/review/diff_lines.py")
    elif cmd == "npm":
        if args not in (["audit"], ["audit", "--json"]):
            raise Deny("npm: only `npm audit` (no scripts: tests and lint run in CI)")
    else:
        raise Deny(f"`{cmd}` is not on the review allowlist")


def check_bash(command):
    for words in tokenize(command):
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", words[0]):
            raise Deny("environment assignments are not allowed")
        if any(ENV_FILE.search(w) for w in words):
            raise Deny("local env files (.env*) are off limits")
        cmd, args = words[0], words[1:]
        if cmd == "git":
            rule_git(args)
        elif cmd == "gh":
            rule_gh(args)
        else:
            rule_simple(cmd, args)


def check(tool, ti):
    if tool == "Bash":
        check_bash(ti.get("command", ""))
    elif tool in ("Read", "Grep", "Glob"):
        for key in ("file_path", "path", "pattern", "glob"):
            v = ti.get(key)
            if isinstance(v, str) and ENV_FILE.search(v):
                raise Deny("local env files (.env*) are off limits")


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
