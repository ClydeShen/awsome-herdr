# Notice

Everything under `mods/` was written by other people and is redistributed here under its own licence. `install.sh`, `sync.sh`, `config/` and this README are the only parts written for this repo.

## Where each mod came from

| Folder in `mods/` | Started from | Upstream | Commit copied | Licence |
| --- | --- | --- | --- | --- |
| `awsome-icons`, `awsome-config`, `awsome-sidebar`, `awsome-viewer`, `awsome-changes`, `awsome-tabs` | `better-icons`, `better-config`, `better-sidebar`, `better-files`, `better-changes`, `better-tabs` | https://github.com/munza/herdr-mods | `bad7512b6148b7092068cd3a6478c45706731c18` (2026-11-23) | Apache-2.0, see `licenses/LICENSE-munza-herdr-mods` and `licenses/NOTICE-munza-herdr-mods` |
| `awsome-filetree` | `filetree` | https://github.com/cybertron288/herdr-mods | `34e7c3348e954fd0a1147b846898db8c3e37e526` (2026-11-03) | MIT, see `licenses/LICENSE-cybertron288-herdr-mods` and `licenses/THIRD_PARTY_NOTICES-cybertron288.md` |

`better-search` (munza) and `file-icons` (cybertron288) were in the first version of this repo and have been removed.

The interface icons in `awsome-icons/ui/` come from Phosphor Icons (https://github.com/phosphor-icons/core, regular weight, MIT). Their licence text sits beside them as `LICENSE-phosphor.txt`. The file icons come from the Material Icon Theme for VS Code (MIT). Its licence text sits beside the icons as `LICENSE-material-icon-theme.txt` inside `awsome-icons`. `filetree` is a port of claude-code-filetree by Kurt Buhler (MIT), and `file-icons` is modified from Herdr Desktop's own `files` mod (Apache-2.0), as the notices above say.

## What was changed from upstream

Changed files are marked here, as the Apache licence asks. Changes are made in this repo; these mods no longer follow upstream.

- `mods/awsome-config` was added later (2026-11-25) from `better-config` (same upstream commit), renamed the same way; the only other change is its name.
- **Renamed** (2026-11-25), with every internal reference changed to match (mod names, titles, class names, shared-state keys such as `awsome-viewer.viewers`): `better-icons` to `awsome-icons`, `better-sidebar` to `awsome-sidebar`, `better-files` to `awsome-viewer`, `better-changes` to `awsome-changes`, `better-tabs` to `awsome-tabs`, `filetree` to `awsome-filetree`. This touched the `.js`, `.json` and `.ts` files of all six.
- `mods/awsome-filetree/main.js`: added `openViewer()`, which opens a file in an Awsome Viewer tab instead of previewing it in the panel, and made `wanted()`/`location()` keep the current folder while the focused tab has no terminal. A new value for `open` in `config.json`, `"awsome-viewer"`, switches the first behaviour on. Its own icon matching was replaced by the shared `file-icons.js` loader, reading the icons from `awsome-icons`; its bundled `icons.js` table was removed.
- `mods/awsome-filetree/main.js` (2026-11-25, prototype of the redesign): a more compact header with Phosphor icon buttons, a shorter summary, indent guides, an "Up a folder" button and keys, and "Open as root" for entering a folder.
- `mods/awsome-filetree/main.js` (2026-11-25): "Up a folder" and "Into the folder" now arrive as key commands (`nextCommand()`, keys.json section `mod:awsome-filetree`) instead of being read in the view, so they can be rebound; the old extra keys were removed. `mods/awsome-filetree/mod.schema.json` was added to describe these two key settings, and `mod.json` points to it.
- `mods/awsome-config/model.js`, `main.js` (2026-11-25): a key setting may name its keys.json section with `x-section` (default `global`); `rebind()` writes into that section.
- `mods/awsome-changes/mod.schema.json`, `mods/awsome-sidebar/mod.schema.json` (2026-11-25): the titles "Git refresh" and "Git retry" became "Changes list refresh" and "Sidebar branch check".
- `mods/awsome-tabs/views/drags.js`, `mod.schema.json` (2026-11-25): a tab drag starts after the pointer moves 6px, with no hold (was 400ms and 12px); `drag_delay` still adds a hold if set.
- `mods/awsome-sidebar/views/spaces.js` (2026-11-25): the current space also gets a 4×24px accent bar at its left, after Primer's current-item indicator.
- `config/layouts/awsome.json` (2026-11-25): the sidebar footer block shows `awsome-sidebar`'s footer instead of `workspace-chrome`; the root names a theme pair, `primer-dark` and `primer-light`.
- `config/themes/primer-dark.json`, `primer-light.json` (2026-11-25): colors taken unchanged from GitHub's Primer design system (`@primer/primitives` 11.10.0, `dist/css/functional/themes/dark.css` and `light.css`), MIT, see `licenses/LICENSE-primer-primitives`. Each Herdr color names one Primer token; the semi-transparent selection color is flattened onto the background because Herdr needs `#rrggbb`.
- `mods/awsome-filetree/config.json`: `"open": "awsome-viewer"` (upstream default is `"preview"`).
- `mods/awsome-filetree/file-icons.js`: added; an identical copy of the loader in `awsome-icons`, since a mod cannot import from another's folder.
- `mods/awsome-sidebar/mod.json`: added `"settings": {"pull_request_status": false}`.
- `mods/awsome-changes/mod.json`: added `"settings": {"default": {"diff": "split"}, "limits": {"files": 200}}`. The limit is lower than the upstream 1000 because drawing that many files on the Changes tab was interrupted by Herdr (0.1.18, Windows).
- Left out of every mod folder: the files Herdr generates by itself (`gpui-kit.d.ts`, `jsconfig.json`), a hidden `.cache`, and update backups.
- `config/layouts/awsome.json` is Herdr's shipped `main` layout (0.1.18), edited to use these mods and to put the Files and Changes panel left of the terminal.
