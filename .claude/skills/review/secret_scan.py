#!/usr/bin/env python3
"""Refuse to post a review that contains something that looks like a secret.

Usage: python3 -I .claude/skills/review/secret_scan.py <payload.json>
Exit 0: clean. Exit 1: possible secrets found (printed redacted). Exit 2: bad input.
"""
import re
import sys

PATTERNS = {
    "Supabase secret key": r"sb_secret_[A-Za-z0-9_-]{8,}",
    "Google API key": r"AIza[0-9A-Za-z_-]{20,}",
    "JWT (e.g. legacy Supabase key)": r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}",
    "GitHub token": r"(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}",
    "Private key": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    "Env assignment of a secret": r"(SUPABASE_SECRET_KEY|GOOGLE_GENERATIVE_AI_API_KEY)\s*=\s*\S{8,}",
}

try:
    text = open(sys.argv[1], encoding="utf-8").read()
except (IndexError, OSError) as e:
    print(f"secret_scan: cannot read payload ({e})")
    sys.exit(2)

hits = []
for name, pattern in PATTERNS.items():
    for m in re.finditer(pattern, text):
        hits.append(f"{name}: {m.group(0)[:6]}… (redacted)")

if hits:
    print("Possible secrets in the review payload. Not posting:")
    print("\n".join(f"- {h}" for h in hits))
    sys.exit(1)
print("secret_scan: clean")
