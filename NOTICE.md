# Notice

Everything under `mods/` was written by other people and is redistributed here under its own licence. `install.sh`, `sync.sh`, `config/` and this README are the only parts written for this repo.

## Where each mod came from

| Folder in `mods/` | Started from | Upstream | Commit copied | Licence |
| --- | --- | --- | --- | --- |
| `awsome-icons`, `awsome-sidebar`, `awsome-viewer`, `awsome-changes`, `awsome-tabs` | `better-icons`, `better-sidebar`, `better-files`, `better-changes`, `better-tabs` | https://github.com/munza/herdr-mods | `bad7512b6148b7092068cd3a6478c45706731c18` (2026-11-23) | Apache-2.0, see `licenses/LICENSE-munza-herdr-mods` and `licenses/NOTICE-munza-herdr-mods` |
| `awsome-filetree` | `filetree` | https://github.com/cybertron288/herdr-mods | `34e7c3348e954fd0a1147b846898db8c3e37e526` (2026-11-03) | MIT, see `licenses/LICENSE-cybertron288-herdr-mods` and `licenses/THIRD_PARTY_NOTICES-cybertron288.md` |

`better-search` (munza) and `file-icons` (cybertron288) were in the first version of this repo and have been removed.

The icons come from the Material Icon Theme for VS Code (MIT). Its licence text sits beside the icons as `LICENSE-material-icon-theme.txt` inside `awsome-icons`. `filetree` is a port of claude-code-filetree by Kurt Buhler (MIT), and `file-icons` is modified from Herdr Desktop's own `files` mod (Apache-2.0), as the notices above say.

## What was changed from upstream

Changed files are marked here, as the Apache licence asks. Changes are made in this repo; these mods no longer follow upstream.

- **Renamed** (2026-11-25), with every internal reference changed to match (mod names, titles, class names, shared-state keys such as `awsome-viewer.viewers`): `better-icons` to `awsome-icons`, `better-sidebar` to `awsome-sidebar`, `better-files` to `awsome-viewer`, `better-changes` to `awsome-changes`, `better-tabs` to `awsome-tabs`, `filetree` to `awsome-filetree`. This touched the `.js`, `.json` and `.ts` files of all six.
- `mods/awsome-filetree/main.js`: added `openViewer()`, which opens a file in an Awsome Viewer tab instead of previewing it in the panel, and made `wanted()`/`location()` keep the current folder while the focused tab has no terminal. A new value for `open` in `config.json`, `"awsome-viewer"`, switches the first behaviour on. Its own icon matching was replaced by the shared `file-icons.js` loader, reading the icons from `awsome-icons`; its bundled `icons.js` table was removed.
- `mods/awsome-filetree/config.json`: `"open": "awsome-viewer"` (upstream default is `"preview"`).
- `mods/awsome-filetree/file-icons.js`: added; an identical copy of the loader in `awsome-icons`, since a mod cannot import from another's folder.
- `mods/awsome-sidebar/mod.json`: added `"settings": {"pull_request_status": false}`.
- `mods/awsome-changes/mod.json`: added `"settings": {"default": {"diff": "split"}, "limits": {"files": 200}}`. The limit is lower than the upstream 1000 because drawing that many files on the Changes tab was interrupted by Herdr (0.1.18, Windows).
- Left out of every mod folder: the files Herdr generates by itself (`gpui-kit.d.ts`, `jsconfig.json`), a hidden `.cache`, and update backups.
- `config/layouts/awsome.json` is Herdr's shipped `main` layout (0.1.18), edited to use these mods and to put the Files and Changes panel left of the terminal.
