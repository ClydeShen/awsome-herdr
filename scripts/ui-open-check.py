#!/usr/bin/env python3
"""Opens an overlay mod for real and checks it actually appeared (docs/UI-LESSONS.md L7).

  python scripts/ui-open-check.py awsome-menu
  python scripts/ui-open-check.py awsome-menu --command awsome-tabs.check-open:looks

The mod reports the size it was laid out at in shared("<mod>.rendered") (menu.js onSize).
This opens it with `herdr-app do mod.open`, waits for a fresh report, closes it again, and fails
when nothing was laid out, the size is zero, or it differs from the size the mod expected.
With --command, the popup is opened by that command (one that passes props, which mod.open
cannot) and closed with overlay.close.
"""
import json
import os
import subprocess
import sys
import time

SHARED = os.path.join(os.environ.get("HERDR_APP_HOME") or os.path.join(os.path.expanduser("~"), ".config", "herdr-app"), "shared.json")


def report(mod):
    try:
        with open(SHARED, encoding="utf-8") as f:
            return json.load(f).get(f"{mod}.rendered")
    except (OSError, ValueError):
        return None


def toggle(mod):
    subprocess.run(["herdr-app", "do", "mod.open", json.dumps({"name": mod})], capture_output=True)


def main():
    args = sys.argv[1:]
    command = args[args.index("--command") + 1] if "--command" in args else None
    mod = next((a for a in args if not a.startswith("--") and a != command), "awsome-menu")
    before = (report(mod) or {}).get("at", 0)
    if command:
        subprocess.run(["herdr-app", "do", command], capture_output=True)
    else:
        toggle(mod)
    got = None
    for _ in range(30):
        time.sleep(0.5)
        r = report(mod)
        if r and r.get("at", 0) > before:
            got = r
            break
    if command:
        subprocess.run(["herdr-app", "do", "overlay.close"], capture_output=True)
    else:
        toggle(mod)
    if not got:
        print(f"ui-open-check: {mod} did not report being laid out within 15 s (did it render at all?)")
        return 1
    exp = got.get("expected") or {}
    problems = []
    if got["width"] <= 0 or got["height"] <= 0:
        problems.append(f"laid out at {got['width']}x{got['height']}: the popup collapsed and shows nothing")
    if exp and (abs(got["width"] - exp.get("width", 0)) > 1 or abs(got["height"] - exp.get("height", 0)) > 1):
        problems.append(f"laid out at {got['width']}x{got['height']}, expected {exp.get('width')}x{exp.get('height')}")
    if problems:
        print(f"ui-open-check: {mod}: " + "; ".join(problems))
        return 1
    print(f"ui-open-check: {mod} ({got.get('scope')}) appeared at {got['width']}x{got['height']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
