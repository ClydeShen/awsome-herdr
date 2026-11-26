#!/bin/sh
# The other direction: copies this setup from your Herdr folder back into the repo, so you can
# commit what you changed while developing. Run it, then review with `git diff` before committing.
set -eu

SRC=$(cd "$(dirname "$0")" && pwd)
HOME_DIR=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
MODS="awsome-icons awsome-config awsome-sidebar awsome-viewer awsome-changes awsome-tabs awsome-filetree awsome-menu awsome-statusline"
LAYOUT=awsome
LOCAL_LAYOUT=${HERDR_LAYOUT:-$LAYOUT} # the layout name on this machine (install.sh names it awsome); stored as $LAYOUT in the repo

for m in $MODS; do
  [ -d "$HOME_DIR/mods/$m" ] || { echo "missing $HOME_DIR/mods/$m" >&2; exit 1; }
  # Files Herdr makes by itself (type files, a hidden picture cache, update backups) stay out.
  # Plain cp instead of rsync, so this also runs in Git Bash on Windows (no rsync there).
  rm -rf "$SRC/mods/$m"
  cp -R "$HOME_DIR/mods/$m" "$SRC/mods/$m"
  find "$SRC/mods/$m" \( -name 'gpui-kit.d.ts' -o -name 'jsconfig.json' -o -name '.cache' \
    -o -name '.bak-update-*' \) -prune -exec rm -rf {} +
  echo "synced mods/$m"
done
cp "$HOME_DIR/layouts/$LOCAL_LAYOUT.json" "$SRC/config/layouts/$LAYOUT.json" 2>/dev/null \
  && echo "synced layout $LOCAL_LAYOUT -> config/layouts/$LAYOUT.json" || echo "no layouts/$LOCAL_LAYOUT.json in $HOME_DIR (skipped; set HERDR_LAYOUT=<name>)"
for f in "$SRC"/config/themes/*.json; do # only the themes this repo ships
  [ -e "$f" ] || continue
  cp "$HOME_DIR/themes/$(basename "$f")" "$f" 2>/dev/null && echo "synced theme $(basename "$f")"
done
