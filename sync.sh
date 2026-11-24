#!/bin/sh
# The other direction: copies this setup from your Herdr folder back into the repo, so you can
# commit what you changed while developing. Run it, then review with `git diff` before committing.
set -eu

SRC=$(cd "$(dirname "$0")" && pwd)
HOME_DIR=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
MODS="better-icons better-sidebar better-files better-changes better-tabs better-search file-icons filetree"
LAYOUT=awsome
LOCAL_LAYOUT=${HERDR_LAYOUT:-my-layout} # the layout name on this machine; it is stored as $LAYOUT in the repo

for m in $MODS; do
  [ -d "$HOME_DIR/mods/$m" ] || { echo "missing $HOME_DIR/mods/$m" >&2; exit 1; }
  # Files Herdr makes by itself (type files, a hidden picture cache, update backups) stay out.
  rsync -a --delete --exclude 'gpui-kit.d.ts' --exclude 'jsconfig.json' --exclude '.cache' \
    --exclude '.bak-update-*' "$HOME_DIR/mods/$m/" "$SRC/mods/$m/"
  echo "synced mods/$m"
done
cp "$HOME_DIR/layouts/$LOCAL_LAYOUT.json" "$SRC/config/layouts/$LAYOUT.json" 2>/dev/null \
  && echo "synced layout $LOCAL_LAYOUT -> config/layouts/$LAYOUT.json" || echo "no layouts/$LOCAL_LAYOUT.json in $HOME_DIR (skipped; set HERDR_LAYOUT=<name>)"
