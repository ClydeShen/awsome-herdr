# awsome-herdr

My [Herdr](https://herdr.dev/) setup in one repo: a set of mods, a layout that uses them, and one script that puts it all on a new machine.

一键安装我的 Herdr 配置：9 个 mod（7 个界面 mod、1 个设置对话框、1 个图标包）、一个布局和一个设置。

## Install

```sh
git clone https://github.com/ClydeShen/awsome-herdr.git
cd awsome-herdr
./install.sh
```

Needs Herdr 0.1.16 or newer (start it once first, so its folder exists), `git` and `python3`. On Windows, run it from Git Bash. The script is safe to run again: anything it replaces is moved to `~/.config/herdr-app/.awsome-herdr-backup-<time>/`, and nothing is deleted. `HERDR_APP_HOME` is honoured if your Herdr folder is somewhere else.

It does five things:

1. Copies the mods in `mods/` into `~/.config/herdr-app/mods/`. The old names (`better-*`, `filetree`, `file-icons`) are moved to the backup folder first.
2. Copies `config/layouts/awsome.json` into `layouts/`.
3. Adds the keys in `config/keys.merge.json` to your `keys.json` (on macOS, the spellings in `config/keys.merge.macos.json` replace the ones bound to the same action, `cmd` where others use `ctrl`). A key you already use is left alone and reported.
4. Adds the setting in `config/settings.merge.json` (`telemetry: false`) to your `settings.json` if you have not set it.
5. Runs `herdr-app check` on every mod and switches to the `awsome` layout. If Herdr is not running, switch with `ctrl-shift-l`.

It was tested against a throwaway Herdr folder (backups, merging, `herdr-app check` on every mod), and on 2026-11-25 installed from a fresh Herdr 0.1.18 folder on Windows 11 with Git Bash.

## What is in it

| Mod | What it does here | Started from |
| --- | --- | --- |
| `awsome-sidebar` | Spaces list with each space's Git branch. Pull request status is **off** (`pull_request_status: false`), so it never calls GitHub. | `better-sidebar` (munza/herdr-mods) |
| `awsome-tabs` | Tab bar with draggable, wrapping tabs, and the Files/Changes toolbar. | `better-tabs` (munza/herdr-mods) |
| `awsome-menu` | Not a panel: the shared pop-up menu, opened by the others: right-click a space, the tab bar's **+**, the status bar's choices. | new |
| `awsome-changes` | Git changes panel and diff tabs. Diffs open **side by side** by default. The list shows at most **200 files** (`limits.files`); see Known rough edges. | `better-changes` (munza/herdr-mods) |
| `awsome-viewer` | File tabs and the preview column, now an editor: edit and save (**Ctrl+S**), unsaved edits kept as drafts when a tab or Herdr closes, Go to line (**Ctrl+G**), comment, move and duplicate lines. Its own tree is not shown. | `better-files` (munza/herdr-mods) |
| `awsome-statusline` | The bottom bar. Keeps Herdr's own items (machine, branch, agents, command hint) and adds the ones other mods register: the editor's line and column, indentation, encoding, line endings, word wrap, read-only. | new, from Herdr's `workspace-status` |
| `awsome-filetree` | The Files panel: Git colours, line counts, filter, Recent. **Patched** so a click opens an Awsome Viewer tab. | `filetree` ([cybertron288/herdr-mods](https://github.com/cybertron288/herdr-mods)) |
| `awsome-config` | Not a panel: one dialog (**Alt+Shift+,**) that shows every mod's settings, checks them, saves them into each mod's own `mod.json`, and can bind a setting to a key. | `better-config` (munza/herdr-mods) |
| `awsome-icons` | Not a panel: holds the Material icon set that the other mods read by path (a mod cannot import from another's folder). | `better-icons` (munza/herdr-mods) |

`better-search` and `file-icons` are no longer used.

The `awsome` layout is Herdr's `main` layout with the Files and Changes panel moved to the left of the terminal, and the spaces, files, changes and tabs blocks pointed at the mods above.

## What it reaches out to

- **GitHub / network:** nothing on its own with these settings. `awsome-viewer` downloads a picture with `curl` only when a Markdown file you preview links to a web image. Links you click open in your browser.
- **Your repositories:** `awsome-changes` has Stage, Unstage, Commit and Amend buttons that run `git add`, `git reset`, `git commit` and `git commit --amend`. They run only when you click them. It never pushes or pulls.
- **Programs:** `git` (read-only for the most part), `sh`, `find`, `du`, `mkdir`, `open`/`xdg-open`, and `hc` to send a file path to an agent.
- **Herdr itself:** the installer turns Herdr's anonymous daily usage report off. Remove `config/settings.merge.json` if you want it left as it was.

## Working on it

Herdr reloads mods as you save them, so develop in `~/.config/herdr-app/`, then bring the changes back here:

```sh
./sync.sh        # copies the mods and your layout back into the repo
git diff         # look at what changed
git commit -am "..." && git push
```

`sync.sh` reads your layout from `layouts/awsome.json`, the name `install.sh` gives it; set `HERDR_LAYOUT=<name>` if yours is called something else. It leaves out the files Herdr generates itself (`gpui-kit.d.ts`, `jsconfig.json`, caches).

## Undo

Delete `~/.config/herdr-app/mods/<name>` and `layouts/awsome.json`, put the original files back from the backup folder, and switch layout with `ctrl-shift-l`.

## Known rough edges

- On Windows, `install.sh` and `sync.sh` need Git Bash (or another POSIX shell) and `python3` on the `PATH`; PowerShell alone will not run them.
- **Big change sets freeze the Changes list.** Herdr stops a view that takes too long to draw. Drawing 600 or more files on the Changes tab did that on Windows (300 was fine), and the panel then sat on "Loading changes…" under a banner "This view could not be re-rendered". So `awsome-changes` is set to show 200 files; the rest are counted but not listed. Raise it in `mods/awsome-changes/mod.json` (`settings.limits.files`) if your machine copes. A mod keeps the tab you last used, so you may never see this if you leave it on Commits.
- `awsome-filetree` and `awsome-viewer` share a viewer list in Herdr's shared state (`awsome-viewer.viewers`). Change its form in one and you must change the other.
- `awsome-viewer` still carries its own file tree (unused in this layout); `awsome-filetree` is the one shown.
- Installing a mod can make Herdr add a duplicate panel to the layout you are looking at. If a second Awsome Changes panel appears on the right, delete that block from your layout.

## UI checks

`python scripts/ui-check.py` checks the mods and themes against the design rules: color sources, contrast, layout alignment, shared files, English UI text, menu labels, icons and design tokens. `python scripts/ui-shot-check.py` checks a live screenshot, and `python scripts/ui-open-check.py awsome-menu` opens the menu for real and checks it was laid out at its full size. After cloning, run `git config core.hooksPath .githooks` once so a commit that breaks a rule is refused. What each rule guards against is in `docs/UI-LESSONS.md`.
