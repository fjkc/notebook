#!/usr/bin/env python3
"""Read a unified diff on stdin and print, as JSON, the line ranges of the new
version that GitHub accepts inline review comments on: {"path": [[start, end], ...]}.

A multi-line comment must lie inside a single range (one diff hunk).
Usage: gh pr diff <n> | python3 .claude/skills/review/diff_lines.py
"""
import json
import re
import sys

HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")

ranges = {}
path = None
for line in sys.stdin:
    if line.startswith("diff --git "):
        path = None
    elif line.startswith("+++ "):
        target = line[4:].rstrip("\n")
        path = None if target == "/dev/null" else re.sub(r"^b/", "", target)
    elif path and (m := HUNK.match(line)):
        start, count = int(m.group(1)), int(m.group(2) or 1)
        if count > 0:
            ranges.setdefault(path, []).append([start, start + count - 1])

print(json.dumps(ranges, separators=(",", ":")))
