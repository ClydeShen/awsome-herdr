# Notice

Everything under `mods/` was written by other people and is redistributed here under its own licence. `install.sh`, `sync.sh`, `config/` and this README are the only parts written for this repo.

## Where each mod came from

| Folder in `mods/` | Upstream | Commit copied | Licence |
| --- | --- | --- | --- |
| `better-icons`, `better-sidebar`, `better-files`, `better-changes`, `better-tabs`, `better-search` | https://github.com/munza/herdr-mods | `bad7512b6148b7092068cd3a6478c45706731c18` (2026-11-23) | Apache-2.0, see `licenses/LICENSE-munza-herdr-mods` and `licenses/NOTICE-munza-herdr-mods` |
| `filetree`, `file-icons` | https://github.com/cybertron288/herdr-mods | `34e7c3348e954fd0a1147b846898db8c3e37e526` (2026-11-03) | MIT, see `licenses/LICENSE-cybertron288-herdr-mods` and `licenses/THIRD_PARTY_NOTICES-cybertron288.md` |

The icons come from the Material Icon Theme for VS Code (MIT). Its licence text sits beside the icons as `LICENSE-material-icon-theme.txt` inside `better-icons`, `file-icons` and `filetree`. `filetree` is a port of claude-code-filetree by Kurt Buhler (MIT), and `file-icons` is modified from Herdr Desktop's own `files` mod (Apache-2.0), as the notices above say.

## What was changed from upstream

Changed files are marked here, as the Apache licence asks.

- `mods/filetree/main.js`: added `openViewer()`, which opens a file in a Better Files viewer tab instead of previewing it in the panel, and made `wanted()`/`location()` keep the current folder while the focused tab has no terminal. A new value for `open` in `config.json`, `"better-files"`, switches the first behaviour on.
- `mods/filetree/config.json`: `"open": "better-files"` (upstream default is `"preview"`).
- `mods/better-sidebar/mod.json`: added `"settings": {"pull_request_status": false}`.
- `mods/better-changes/mod.json`: added `"settings": {"default": {"diff": "split"}}`.
- Left out of every mod folder: the files Herdr generates by itself (`gpui-kit.d.ts`, `jsconfig.json`), a hidden `.cache`, and update backups.
- `config/layouts/awsome.json` is Herdr's shipped `main` layout (0.1.18), edited to use these mods and to put the Files and Changes panel left of the terminal.

Upstream mods other than these were not modified.
