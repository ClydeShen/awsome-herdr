#!/usr/bin/env python3
"""UI rules for the awsome-* mods, checked by program instead of by memory.

Each check guards a mistake that was actually made (docs/UI-LESSONS.md). Run it:
  python scripts/ui-check.py            all checks, exit 1 on a failure
  python scripts/ui-check.py --hook     as a Claude Code PostToolUse hook (reads the edited
                                        file from stdin; exit 2 sends the failures back)
  python scripts/ui-check.py --baseline record today's hard-coded colors as the baseline (C4)

Standard library only. Paths are relative to the repository root.
"""
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
SHARED = ["file-icons.js", "settings.js", "syntax.js", "menu.js", "confirm.js"]
BASELINE = P("scripts", "ui-check-baseline.json")
CJK = re.compile(r"[　-〿㐀-䶿一-鿿＀-￯]")

failures = []


def fail(check, lesson, msg, fix):
    failures.append(f"[{check}] {msg}\n      lesson {lesson} - fix: {fix}")


def load(*path):
    with open(P(*path), encoding="utf-8") as f:
        return json.load(f)


# ── colors ─────────────────────────────────────────────────────────────────────
def oklch_hex(s):
    """oklch(L C H [/ A%]) -> #rrggbb or #rrggbbaa (sRGB, CSS Color 4)."""
    m = re.match(r"oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:/\s*([\d.]+)%)?\s*\)", s)
    L, C, H = float(m[1]), float(m[2]), float(m[3])
    a = C * math.cos(math.radians(H)); b = C * math.sin(math.radians(H))
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
           -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
           -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_]
    enc = lambda v: 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
    out = "#" + "".join("%02x" % round(max(0, min(1, enc(v))) * 255) for v in rgb)
    if m[4] is not None:
        out += "%02x" % round(float(m[4]) / 100 * 255)
    return out


def rgba(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)], (int(h[6:8], 16) / 255 if len(h) == 8 else 1.0)


def over(fg, bg, a):
    return [fg[i] * a + bg[i] * (1 - a) for i in range(3)]


def lum(c):
    f = lambda v: (v / 255) / 12.92 if v / 255 <= 0.03928 else (((v / 255) + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def theme_value(theme, key):
    if key.startswith("colors."):
        return theme["colors"].get(key[7:])
    if key.startswith("ansi."):
        return theme["ansi"][int(key[5:])]
    return theme.get(key)


def c1_sources():
    """Every theme color comes from shadcn/ui or Apple (or a stated rule) and matches it."""
    src = load("config", "themes", "sources.json")
    for mode in ("light", "dark"):
        theme = load("config", "themes", f"awsome-{mode}.json")
        listed = set(src[mode])
        have = {"background", "foreground", "selection", "cursor"} | {f"colors.{k}" for k in theme["colors"]} | {f"ansi.{i}" for i in range(len(theme["ansi"]))}
        for key in sorted(have - listed):
            fail("C1", "L1", f"awsome-{mode}: {key} = {theme_value(theme, key)} has no source in config/themes/sources.json",
                 "take the value from shadcn/ui or Apple and register it; never tune a color by hand")
        for key, s in src[mode].items():
            got = (theme_value(theme, key) or "").lower()
            if "oklch" in s:
                want = oklch_hex(s["oklch"])
            elif "rgb" in s:
                want = s["rgb"].lower()
            else:
                want = (s.get("value") or got).lower()
            if got != want:
                fail("C1", "L1", f"awsome-{mode}: {key} is {got}, its source ({s.get('shadcn') or s.get('apple') or s.get('derived')}) gives {want}",
                     "use the source value, or change the source in sources.json with its origin")


def c2_contrast():
    """Text tokens on real backgrounds, plain and under hover/selected, both themes."""
    tok = load("design", "tokens.json")
    need, need_hot, need_bar = (tok["contrast"]["values"][k] for k in ("text", "textOnHoverOrSelected", "indicator"))
    texts = ["foreground", "muted", "accent", "working", "blocked", "done"]
    for mode in ("light", "dark"):
        th = load("config", "themes", f"awsome-{mode}.json"); c = th["colors"]
        plain = {k: rgba(c[k])[0] for k in ("surface", "chrome", "popover")}
        hot = {}
        for base in ("surface", "chrome"):
            for o in ("hover", "selected"):
                col, a = rgba(c[o]); hot[f"{base}+{o}"] = over(col, plain[base], a)
        named = [(k, c[k]) for k in texts] + [(f"ansi{i}", th["ansi"][i]) for i in range(1, 7)]
        for name, val in named:
            for bname, bg in plain.items():
                r = ratio(rgba(val)[0], bg)
                if r < need:
                    fail("C2", "L3", f"awsome-{mode}: {name} on {bname} is {r:.2f}:1 (needs {need})", "pick another source value; do not darken by hand")
            for bname, bg in hot.items():
                r = ratio(rgba(val)[0], bg)
                if r < need_hot:
                    fail("C2", "L3", f"awsome-{mode}: {name} on {bname} is {r:.2f}:1 (needs {need_hot} under hover/selected)", "pick another source value")
        r = ratio(rgba(c["accent"])[0], plain["chrome"])
        if r < need_bar:
            fail("C2", "L3", f"awsome-{mode}: the current-item bar (accent on chrome) is {r:.2f}:1 (needs {need_bar})", "use an accent that stands off the sidebar")
        tint = tok["label"]["tint"][mode]
        for hue in tok["label"]["hues"]:
            row = over(rgba(hue)[0], plain["chrome"], tint)
            r = ratio(rgba(c["muted"])[0], row)
            if r < need:
                fail("C2", "L3", f"awsome-{mode}: muted on a {tint:.0%} {hue} space row is {r:.2f}:1 (needs {need})", "lower label.tint in design/tokens.json")
            col, a = rgba(c["selected"])
            r = ratio(rgba(c["muted"])[0], over(col, row, a))
            if r < need_hot:
                fail("C2", "L3", f"awsome-{mode}: muted on a selected {tint:.0%} {hue} space row is {r:.2f}:1 (needs {need_hot})", "lower label.tint in design/tokens.json")


# ── layout ─────────────────────────────────────────────────────────────────────
def find(node, ident):
    if isinstance(node, dict):
        if node.get("id") == ident:
            return node
        for ch in node.get("children", []):
            hit = find(ch, ident)
            if hit:
                return hit
    return None


def c3_layout():
    """Invisible alignment lines and one gap / one radius across the awsome layout."""
    v = load("design", "tokens.json")["layout"]["values"]
    L = load("config", "layouts", "awsome.json")
    px = lambda ident: (find(L, ident) or {}).get("size", {}).get("px")
    checks = [
        (px("sidebar-footer") == px("status") == v["bar"], f"sidebar footer ({px('sidebar-footer')}) and status bar ({px('status')}) must both be {v['bar']}px so their top lines meet"),
        (px("brand") == (px("tabs") or 0) + (find(L, "work-body") or {}).get("padding", -1), f"brand height ({px('brand')}) must equal tab bar ({px('tabs')}) + work-body padding, so the card tops line up with the sidebar"),
        ((find(L, "work-body") or {}).get("padding") == (find(L, "work-body") or {}).get("gap") == v["gap"], f"work-body padding and gap must both be {v['gap']}px"),
        ((find(L, "main") or {}).get("content", {}).get("pane", {}).get("gap") == v["gap"], f"terminal pane gap must be {v['gap']}px"),
        ((find(L, "panel") or {}).get("radius") == (find(L, "main") or {}).get("content", {}).get("pane", {}).get("radius") == v["cardRadius"], f"Files/Changes card and terminal panes must share radius {v['cardRadius']}"),
    ]
    for ok, msg in checks:
        if not ok:
            fail("C3", "L5", msg, "change config/layouts/awsome.json, or design/tokens.json layout first")


# ── code ───────────────────────────────────────────────────────────────────────
def mod_js():
    for mod in sorted(os.listdir(P("mods"))):
        base = P("mods", mod)
        if not os.path.isdir(base):
            continue
        for dirpath, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for f in files:
                if f.endswith(".js") and not f.startswith("gpui-kit"):
                    full = os.path.join(dirpath, f)
                    yield os.path.relpath(full, ROOT).replace("\\", "/"), open(full, encoding="utf-8").read()


def strip_comments(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return "\n".join(re.sub(r"(^|[^:\"'`])//.*$", r"\1", line) for line in src.split("\n"))


HEX = re.compile(r"""["'`]#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})["'`]""")


def hex_counts():
    return {path: n for path, src in mod_js() if (n := len(HEX.findall(strip_comments(src))))}


def c4_no_new_hex():
    """No new hard-coded colors in mod code; the baseline may only shrink."""
    base = json.load(open(BASELINE, encoding="utf-8")) if os.path.exists(BASELINE) else {}
    for path, n in hex_counts().items():
        if n > base.get(path, 0):
            fail("C4", "L1", f"{path} has {n} hard-coded colors (baseline {base.get(path, 0)})", "use a theme() token; if a color has no token, add it to the theme with a source")


def c5_shared():
    """Shared files stay byte-identical in every mod that carries them."""
    for name in SHARED:
        copies = {}
        for mod in sorted(os.listdir(P("mods"))):
            f = P("mods", mod, name)
            if os.path.isfile(f):
                copies[f"mods/{mod}/{name}"] = open(f, "rb").read()
        if len(set(copies.values())) > 1:
            groups = {}
            for path, data in copies.items():
                groups.setdefault(data, []).append(path)
            fail("C5", "L4", f"{name} differs between copies: " + " | ".join(", ".join(g) for g in groups.values()), "edit one copy and copy it over the others")


def c6_english():
    """Interface text is English: no Chinese or Japanese in strings."""
    for path, src in mod_js():
        for i, line in enumerate(strip_comments(src).split("\n"), 1):
            for lit in re.findall(r"""(["'`])((?:\\.|(?!\1).)*)\1""", line):
                if CJK.search(lit[1]):
                    fail("C6", "L4", f"{path}:{i} has non-English text in a string: {lit[1][:40]!r}", "write interface text in English")


PROPER = {"File", "Explorer", "Finder", "Recycle", "Bin", "Git", "GitHub", "Herdr", "PowerShell", "Windows", "WSL", "Command", "Prompt",
          "Bash", "Claude", "Codex", "Gemini", "Kiro", "macOS", "Linux", "Material", "Phosphor", "Ubuntu", "Debian", "Trash", "HEAD", "PR"}


def c7_menus():
    """Menu labels in sentence case; popups sized by menuHeight/confirmHeight, never by hand."""
    for path, src in mod_js():
        code = strip_comments(src)
        for m in re.finditer(r"""label:\s*"([^"]+)\"""", code):
            words = re.findall(r"[A-Za-z][\w'’]*", m[1])
            bad = [w for w in words[1:] if w[0].isupper() and w not in PROPER and not w.isupper()]
            if bad:
                line = code[: m.start()].count("\n") + 1
                fail("C7", "L4", f"{path}:{line} menu label {m[1]!r} is not sentence case ({', '.join(bad)})", "capitalise only the first word and proper nouns (add real proper nouns to PROPER)")
        for m in re.finditer(r"openOverlay\(\{[^}]*kind:\s*\"popup\"[^}]*\}", code):
            if re.search(r"height:\s*[^,}]*\d\s*\*", m[0]) and "Height(" not in m[0]:
                line = code[: m.start()].count("\n") + 1
                fail("C7", "L2", f"{path}:{line} sizes a popup by hand", "use menuHeight(entries) / confirmHeight(...)")


def c8_icons():
    """Every UI("name") / ic("name") icon exists in awsome-icons/ui."""
    have = {f[:-4] for f in os.listdir(P("mods", "awsome-icons", "ui")) if f.endswith(".svg")}
    for path, src in mod_js():
        for m in re.finditer(r"""\b(?:UI|ic)\(\s*["'`]([a-z0-9-]+)["'`]""", strip_comments(src)):
            if m[1] not in have:
                fail("C8", "L4", f"{path} uses icon {m[1]!r}, which is not in mods/awsome-icons/ui", "download it from phosphor-icons/core (regular) into awsome-icons/ui")


def c9_tokens():
    """The shared menu/confirm constants match design/tokens.json."""
    tok = load("design", "tokens.json")
    for name, const, key in (("menu.js", "MENU", "menu"), ("confirm.js", "CONFIRM", "confirm")):
        for mod in sorted(os.listdir(P("mods"))):
            f = P("mods", mod, name)
            if not os.path.isfile(f):
                continue
            m = re.search(r"export const %s = \{([^}]*)\}" % const, open(f, encoding="utf-8").read())
            got = {k: float(v) for k, v in re.findall(r"(\w+):\s*([\d.]+)", m[1])} if m else {}
            want = {k: float(v) for k, v in tok[key]["values"].items()}
            if got != want:
                diff = sorted(set(got.items()) ^ set(want.items()))
                fail("C9", "L2", f"mods/{mod}/{name} {const} differs from design/tokens.json {key}: {diff}", "change design/tokens.json first (with its source), then the constant")


def c10_way_back():
    """A menu item never replaces the menu with another menu: nested menus are submenus."""
    for path, src in mod_js():
        code = strip_comments(src)
        if "menu.js" not in code:
            continue
        for m in re.finditer(r"run:\s*\([^)]*\)\s*=>\s*\{?\s*openOverlay\(\{\s*mod:\s*NAME(?![A-Za-z0-9_])", code):
            line = code[: m.start()].count(chr(10)) + 1
            fail("C10", "L6", f"{path}:{line} a menu item opens another copy of its own menu, so there is no way back",
                 "give the item `submenu: [...]` so it opens beside the item (menu.js)")


def c11_flows():
    """Every way in has a way out: each flow in design/flows.json goes back by every means it goes forward."""
    code_of = {}
    for path, src in mod_js():
        code_of.setdefault(path.split("/")[1], []).append(src)
    for f in load("design", "flows.json")["flows"]:
        fid, mod = f.get("id"), f.get("mod")
        fw, bk = f.get("forward", {}), f.get("back", {})
        for means in ("mouse", "keys"):
            if fw.get(means) and not bk.get(means):
                fail("C11", "L6", f"flow {fid} ({mod}): goes forward by {means} ({fw[means]}) but has no way back by {means}",
                     "add the way back (same means), build it, and list it in design/flows.json")
        src = "".join(code_of.get(mod, []))
        for side, part in (("forward", fw), ("back", bk)):
            for needle in part.get("code", []):
                if needle not in src:
                    fail("C11", "L6", f"flow {fid} ({mod}): {side} code {needle!r} is not in the mod", "build the step, or correct design/flows.json")


def c12_conventions():
    """Each interaction names how two well-known apps do it, says what we do, and is really built."""
    code_of = {}
    for path, src in mod_js():
        code_of.setdefault(path.split("/")[1], []).append(src)
    for c in load("design", "conventions.json")["conventions"]:
        cid = c.get("id")
        refs = [r for r in c.get("references", []) if r.get("app") and r.get("behavior")]
        if len(refs) < 2:
            fail("C12", "L8", f"convention {cid}: names {len(refs)} reference app(s); two are needed",
                 "look up how two well-known apps do it and write it in design/conventions.json")
        if not c.get("ours"):
            fail("C12", "L8", f"convention {cid}: says nothing about what we do", "fill in 'ours'")
        if c.get("planned"):
            continue
        for mod, needles in (c.get("code") or {}).items():
            src = "".join(code_of.get(mod, []))
            for needle in needles:
                if needle not in src:
                    fail("C12", "L8", f"convention {cid}: {needle!r} is not in {mod}", "build it as written, or correct design/conventions.json")


CHECKS = [c1_sources, c2_contrast, c3_layout, c4_no_new_hex, c5_shared, c6_english, c7_menus, c8_icons, c9_tokens, c10_way_back, c11_flows, c12_conventions]


def main():
    args = sys.argv[1:]
    if "--baseline" in args:
        with open(BASELINE, "w", encoding="utf-8", newline="\n") as f:
            json.dump(hex_counts(), f, indent=2, sort_keys=True); f.write("\n")
        print(f"baseline written: {BASELINE}")
        return 0
    if "--hook" in args:
        try:
            event = json.load(sys.stdin)
        except Exception:
            return 0
        path = (event.get("tool_input") or {}).get("file_path") or ""
        rel = os.path.relpath(os.path.abspath(path), ROOT).replace("\\", "/") if path else ""
        if not re.match(r"^(mods|config|design|scripts)/", rel):
            return 0
    for check in CHECKS:
        try:
            check()
        except Exception as e:  # a broken check is a failure, never a silent pass
            fail(check.__name__.split("_")[0].upper(), "-", f"{check.__name__} crashed: {e!r}", "fix scripts/ui-check.py")
    if failures:
        out = sys.stderr
        print(f"ui-check: {len(failures)} problem(s). See docs/UI-LESSONS.md.", file=out)
        for f in failures:
            print("  " + f, file=out)
        return 2 if "--hook" in args else 1
    if "--hook" not in args:
        print(f"ui-check: all {len(CHECKS)} checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
