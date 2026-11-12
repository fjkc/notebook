#!/usr/bin/env python3
"""Read a unified diff on stdin and print, as JSON, the line ranges of the new
version that GitHub accepts inline review comments on: {"path": [[start, end], ...]}.

A multi-line comment must lie inside a single range (one diff hunk).
Usage: gh pr diff <n> | python3 -I .claude/skills/review/diff_lines.py
"""
import codecs
import json
import re
import sys

HUNK = re.compile(r"^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


def parse_path(raw):
    """'b/x.md', quoted '"b/\\303\\251.md"', or '/dev/null' -> path or None."""
    raw = raw.rstrip("\n").rstrip("\t")
    if raw == "/dev/null":
        return None
    if raw.startswith('"') and raw.endswith('"'):
        raw = codecs.escape_decode(raw[1:-1].encode())[0].decode("utf-8")
    return raw[2:] if raw.startswith("b/") else raw


ranges = {}
path = None
old_left = new_left = 0  # lines left in the current hunk; headers only count outside hunks
for raw in sys.stdin.buffer:  # bytes, so a non-UTF-8 file in the PR can't crash the parser
    line = raw.decode("utf-8", errors="replace")
    if old_left > 0 or new_left > 0:
        tag = line[:1]
        if tag in (" ", "", "\n", "\r"):  # a context line whose trailing space was trimmed
            old_left, new_left = old_left - 1, new_left - 1
        elif tag == "-":
            old_left -= 1
        elif tag == "+":
            new_left -= 1
        # "\ No newline at end of file" doesn't count
        continue
    if line.startswith("diff --git "):
        path = None
    elif line.startswith("+++ "):
        path = parse_path(line[4:])
    elif m := HUNK.match(line):
        old_left = int(m.group(1) or 1)
        start, new_left = int(m.group(2)), int(m.group(3) or 1)
        if path and new_left > 0:
            ranges.setdefault(path, []).append([start, start + new_left - 1])

print(json.dumps(ranges, separators=(",", ":"), ensure_ascii=False))
