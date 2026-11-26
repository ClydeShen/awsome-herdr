#!/bin/sh
# Installs this Herdr setup: the mods, the "awsome" layout, one key and one setting.
# Safe to run again. Anything it replaces is moved to a backup folder first, never deleted.
set -eu

SRC=$(cd "$(dirname "$0")" && pwd)
HOME_DIR=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
MODS="awsome-icons awsome-config awsome-sidebar awsome-viewer awsome-changes awsome-tabs awsome-filetree awsome-menu awsome-statusline"
LEGACY="better-changes better-icons better-sidebar better-files better-tabs better-search file-icons filetree" # names this repo used before the awsome-* rename
LAYOUT=awsome

say() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

[ -d "$HOME_DIR" ] || fail "$HOME_DIR not found. Start Herdr once so it creates its folder, then run this again."
command -v python3 >/dev/null 2>&1 || fail "python3 is needed to merge keys.json and settings.json."
mkdir -p "$HOME_DIR/mods" "$HOME_DIR/layouts"

BACKUP="$HOME_DIR/.awsome-herdr-backup-$(date +%Y%m%d-%H%M%S)"
backup() { # backup <path> : move an existing path into the backup folder, keeping its place
  [ -e "$1" ] || return 0
  rel=${1#"$HOME_DIR"/}
  mkdir -p "$BACKUP/$(dirname "$rel")"
  mv "$1" "$BACKUP/$rel"
  say "  backed up $rel"
}

say "Mods -> $HOME_DIR/mods"
for m in $LEGACY; do backup "$HOME_DIR/mods/$m"; done # the old names, now replaced by the awsome-* mods
for m in $MODS; do
  backup "$HOME_DIR/mods/$m"
  cp -R "$SRC/mods/$m" "$HOME_DIR/mods/$m"
  say "  installed $m"
done

# The mods go first and the layout second: a mod that names a place gets added to the shown
# layout when it appears, and this order keeps that away from the new layout.
sleep 2
say "Layout -> layouts/$LAYOUT.json"
backup "$HOME_DIR/layouts/$LAYOUT.json"
cp "$SRC/config/layouts/$LAYOUT.json" "$HOME_DIR/layouts/$LAYOUT.json"

say "Themes -> themes/"
mkdir -p "$HOME_DIR/themes"
for f in "$SRC"/config/themes/*.json; do
  [ -e "$f" ] || continue
  backup "$HOME_DIR/themes/$(basename "$f")"
  cp "$f" "$HOME_DIR/themes/$(basename "$f")"
  say "  installed $(basename "$f")"
done

say "Keys and settings (only adds what is missing; nothing of yours is replaced)"
python3 -I - "$HOME_DIR" "$SRC/config" <<'PY'
import json, os, sys
home, cfg = sys.argv[1], sys.argv[2]
def load(p, default):
    try:
        with open(p) as f: return json.load(f)
    except FileNotFoundError: return default
def save(p, d):
    with open(p, "w") as f:
        json.dump(d, f, indent=2); f.write("\n")

keys_path = os.path.join(home, "keys.json")
keys = load(keys_path, {})
add = load(os.path.join(cfg, "keys.merge.json"), {})
# macOS spellings of the same actions (cmd where others use ctrl) replace the ones in keys.merge.json.
if sys.platform == "darwin":
    for section, binds in load(os.path.join(cfg, "keys.merge.macos.json"), {}).items():
        actions = set(binds.values())
        kept = {k: a for k, a in add.get(section, {}).items() if a not in actions}
        kept.update(binds)
        add[section] = kept
changed = False
for section, binds in add.items():
    have = keys.setdefault(section, {})
    for key, action in binds.items():
        if key in have and have[key] != action:
            print(f"  keys.json: {key} is already {have[key]!r}; left alone (wanted {action!r})")
        elif key not in have:
            have[key] = action; changed = True; print(f"  keys.json: added {key} -> {action}")
if changed: save(keys_path, keys)

set_path = os.path.join(home, "settings.json")
settings = load(set_path, {})
add = load(os.path.join(cfg, "settings.merge.json"), {})
changed = False
for key, value in add.items():
    if key in settings and settings[key] != value:
        print(f"  settings.json: {key} is already {settings[key]!r}; left alone (wanted {value!r})")
    elif key not in settings:
        settings[key] = value; changed = True; print(f"  settings.json: set {key} = {value!r}")
if changed: save(set_path, settings)
PY

if command -v herdr-app >/dev/null 2>&1; then
  say "Checking the mods"
  for m in $MODS; do
    if herdr-app check "$HOME_DIR/mods/$m" >/dev/null 2>&1; then say "  ok   $m"; else say "  FAIL $m (run: herdr-app check $HOME_DIR/mods/$m)"; fi
  done
  say "Switching to the $LAYOUT layout"
  herdr-app do layout.switch "{\"name\":\"$LAYOUT\"}" >/dev/null 2>&1 \
    || say "  Herdr is not running; switch later with ctrl-shift-l."
else
  say "herdr-app is not on PATH; open Herdr and switch layout with ctrl-shift-l."
fi

[ -d "$BACKUP" ] && say "Replaced files were moved to $BACKUP"
say "Done."
