# awsome-herdr

My [Herdr](https://herdr.dev/) setup in one repo: a set of mods, a layout that uses them, and one script that puts it all on a new machine.

一键安装我的 Herdr 配置：8 个 mod、一个布局、一个键位和一个设置。

## Install

```sh
git clone https://github.com/ClydeShen/awsome-herdr.git
cd awsome-herdr
./install.sh
```

Needs Herdr 0.1.16 or newer (start it once first, so its folder exists), `git` and `python3`. The script is safe to run again: anything it replaces is moved to `~/.config/herdr-app/.awsome-herdr-backup-<time>/`, and nothing is deleted. `HERDR_APP_HOME` is honoured if your Herdr folder is somewhere else.

It does five things:

1. Copies the mods in `mods/` into `~/.config/herdr-app/mods/`.
2. Copies `config/layouts/awsome.json` into `layouts/`.
3. Adds the key in `config/keys.merge.json` to your `keys.json`. A key you already use is left alone and reported.
4. Adds the setting in `config/settings.merge.json` (`telemetry: false`) to your `settings.json` if you have not set it.
5. Runs `herdr-app check` on every mod and switches to the `awsome` layout. If Herdr is not running, switch with `ctrl-shift-l`.

It was tested against a throwaway Herdr folder (backups, merging, `herdr-app check` on every mod). It has not been run on a second, clean computer yet.

## What is in it

| Mod | What it does here | Source |
| --- | --- | --- |
| `better-sidebar` | Spaces list with each space's Git branch. Pull request status is **off** (`pull_request_status: false`), so it never calls GitHub. | [munza/herdr-mods](https://github.com/munza/herdr-mods) |
| `better-tabs` | Tab bar with draggable, wrapping tabs, and the Files/Changes toolbar. | munza/herdr-mods |
| `better-changes` | Git changes panel and diff tabs. Diffs open **side by side** by default. | munza/herdr-mods |
| `better-files` | Read-only file viewer tabs (preview, Keep tab, Open in editor). Its own tree is not shown. | munza/herdr-mods |
| `better-icons` | Material icon set read by the Better mods. | munza/herdr-mods |
| `better-search` | One popup to find tabs, agents, commands and files, on `cmd-alt-p`. | munza/herdr-mods |
| `filetree` | The Files panel: Git colours, line counts, filter, Recent. **Patched** so a click opens a Better Files viewer tab. | [cybertron288/herdr-mods](https://github.com/cybertron288/herdr-mods) |
| `file-icons` | The icons `filetree` draws from. | cybertron288/herdr-mods |

The `awsome` layout is Herdr's `main` layout with the Files and Changes panel moved to the left of the terminal, and the spaces, files, changes and tabs blocks pointed at the mods above.

Exact versions, licences and what I changed are in [NOTICE.md](NOTICE.md) and [licenses/](licenses/).

## What it reaches out to

- **GitHub / network:** nothing on its own with these settings. `better-files` downloads a picture with `curl` only when a Markdown file you preview links to a web image. Links you click open in your browser.
- **Your repositories:** `better-changes` has Stage, Unstage, Commit and Amend buttons that run `git add`, `git reset`, `git commit` and `git commit --amend`. They run only when you click them. It never pushes or pulls.
- **Programs:** `git` (read-only for the most part), `sh`, `find`, `du`, `mkdir`, `open`/`xdg-open`, and `hc` to send a file path to an agent.
- **Herdr itself:** the installer turns Herdr's anonymous daily usage report off. Remove `config/settings.merge.json` if you want it left as it was.

## Working on it

Herdr reloads mods as you save them, so develop in `~/.config/herdr-app/`, then bring the changes back here:

```sh
./sync.sh        # copies the mods and your layout back into the repo
git diff         # look at what changed
git commit -am "..." && git push
```

`sync.sh` assumes your layout on this machine is called `my-layout` and stores it as `awsome`; set `HERDR_LAYOUT=<name>` if yours is called something else. It leaves out the files Herdr generates itself (`gpui-kit.d.ts`, `jsconfig.json`, caches).

To change a Better mod without losing the change on its next update, copy it first: `herdr-app do mod.clone '{"name":"better-changes","as":"my-changes"}'`.

## Undo

Delete `~/.config/herdr-app/mods/<name>` and `layouts/awsome.json`, put the original files back from the backup folder, and switch layout with `ctrl-shift-l`.

## Known rough edges

- Windows is not supported by `install.sh` (it needs a POSIX shell and `python3`). Copy the folders by hand.
- The `filetree` patch depends on `better-files` writing its viewer list in the form it uses today.
- Installing a mod can make Herdr add a duplicate panel to the layout you are looking at. If a second Better Changes panel appears on the right, delete that block from your layout.
