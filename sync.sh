#!/bin/sh
# The other direction: copies this setup from your Herdr folder back into the repo, so you can
# commit what you changed while developing. Run it, then review with `git diff` before committing.
set -eu

SRC=$(cd "$(dirname "$0")" && pwd)
HOME_DIR=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
MODS="better-icons better-sidebar better-files better-changes better-tabs better-search file-icons filetree"
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
