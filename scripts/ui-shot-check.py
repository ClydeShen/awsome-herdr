#!/usr/bin/env python3
"""Checks a real screenshot of Herdr against the design (docs/UI-LESSONS.md L5).

  python scripts/ui-shot-check.py              take a screenshot with `herdr-app shot` and check it
  python scripts/ui-shot-check.py shot.png     check an existing screenshot

What it checks, reading pixels across the middle and up from the bottom of the window:
  S1  the sidebar, the gaps between cards and the cards use the theme's chrome, canvas and
      surface colors (light or dark is detected from the sidebar)
  S2  every gap between cards is the same width
  S3  the sidebar footer's top line and the status bar's top line are on the same row
Needs Pillow (PIL). Wait ~20 s after changing a layout before shooting (Herdr redraws late).
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
problems = []


def rgba(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)], (int(h[6:8], 16) / 255 if len(h) == 8 else 1.0)


def solid(h, under=None):
    c, a = rgba(h)
    if a >= 1 or under is None:
        return tuple(c)
    u = rgba(under)[0]
    return tuple(round(c[i] * a + u[i] * (1 - a)) for i in range(3))


def near(a, b, tol=3):
    return all(abs(a[i] - b[i]) <= tol for i in range(3))


def runs(pixels):
    """Consecutive equal-colored runs: [(start, length, color)]."""
    out = []
    for i, p in enumerate(pixels):
        if out and near(out[-1][2], p, 1):
            out[-1][1] += 1
        else:
            out.append([i, 1, p])
    return out


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), "awsome-ui-shot.png")
    if len(sys.argv) == 1:
        subprocess.run(["herdr-app", "shot", path], check=True, capture_output=True)
    im = Image.open(path).convert("RGB")
    W, H = im.size
    themes = {m: json.load(open(os.path.join(ROOT, "config", "themes", f"awsome-{m}.json"), encoding="utf-8")) for m in ("light", "dark")}

    row = [im.getpixel((x, H // 2)) for x in range(W)]
    segs = runs(row)
    sidebar = max(segs[: max(1, len(segs) // 4)], key=lambda s: s[1])[2]  # the widest run in the left quarter
    mode = min(themes, key=lambda m: sum(abs(sidebar[i] - solid(themes[m]["colors"]["chrome"])[i]) for i in range(3)))
    c = themes[mode]["colors"]
    chrome, canvas, surface = solid(c["chrome"]), solid(c["canvas"]), solid(c["surface"])
    print(f"ui-shot-check: {path} ({W}x{H}), {mode} theme")

    if not near(sidebar, chrome):
        problems.append(f"S1 the sidebar is #{bytes(sidebar).hex()}, the theme's chrome is #{bytes(chrome).hex()}")
    gaps = [s for s in segs if near(s[2], canvas) and 1 < s[1] < 40 and s[0] > 0]
    if not gaps:
        problems.append(f"S1 no gap of the canvas color #{bytes(canvas).hex()} found across the middle of the window")
    if not any(near(s[2], surface) and s[1] > 80 for s in segs):
        problems.append(f"S1 no card of the surface color #{bytes(surface).hex()} found across the middle of the window")
    widths = sorted({s[1] for s in gaps})
    if len(widths) > 1 and widths[-1] - widths[0] > 1:
        problems.append(f"S2 the gaps between cards differ: {widths} px")

    def top_line(x):
        col = [im.getpixel((x, y)) for y in range(H)]
        for y in range(H - 2, H // 2, -1):
            if not near(col[y], col[y + 1], 6) and not near(col[y], col[y - 1], 6)                     and all(near(im.getpixel((x + d, y)), col[y], 6) for d in range(-8, 9) if 0 <= x + d < W):
                return y  # a one-pixel line running across, not the edge of an icon in the status bar
        return None

    sidebar_x = segs[0][0] + segs[0][1] // 2 if segs else 10
    main_x = W * 3 // 4
    a, b = top_line(sidebar_x), top_line(main_x)
    if a is None or b is None or abs(a - b) > 0:
        problems.append(f"S3 the sidebar footer line (y={a}) and the status bar line (y={b}) are not on the same row")

    if problems:
        print(f"ui-shot-check: {len(problems)} problem(s)")
        for p in problems:
            print("  " + p)
        return 1
    print(f"ui-shot-check: sidebar, gaps ({widths} px), cards and the bottom lines (y={a}) match the design")
    return 0


if __name__ == "__main__":
    sys.exit(main())
