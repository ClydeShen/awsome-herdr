// Discard (docs/REQUIREMENTS.md §4.5, §4.5b B2): files in Unstaged go back to how the index has
// them; new (untracked) files go to the system's Recycle Bin / Trash. Before anything changes, a
// snapshot of every tracked change is kept under a hidden ref, so a mistake can be undone with
// Git (`git stash apply <ref>`), without crowding the stash list.
import { exec, window } from "herdr";

const SNAPSHOTS = "refs/awsome-changes/discard";

// Herdr has no Recycle Bin call, so each system's own: PowerShell's VisualBasic FileIO on Windows,
// Finder on macOS, gio on Linux (§4.4's platform table). One call per file keeps quoting simple.
export function trashCommand(platform, path) {
  if (platform === "windows") return null; // Not yet verified (REQUIREMENTS §4.3c): no command.
  if (platform === "macos") {
    const quoted = path.split(String.fromCharCode(92)).join(String.fromCharCode(92, 92)).split('"').join(String.fromCharCode(92) + '"');
    return ["osascript", ["-e", `tell application "Finder" to delete POSIX file "${quoted}"`]];
  }
  return ["gio", ["trash", "--", path]];
}

// What a discard of these files would do: which go back to the index, which to the bin.
export function discardPlan(files) {
  const restore = files.filter((f) => !f.fresh && !f.conflict).map((f) => f.path);
  const trash = files.filter((f) => f.fresh).map((f) => f.path);
  return { restore, trash };
}

export const discardMethods = {
  // The bin's name on this system (§2.5).
  binName() {
    return window()?.platform === "macos" ? "Trash" : "Recycle Bin";
  },

  // The confirmation's words (§2.6): a question with the count, the names, a red button that
  // says what happens.
  discardText(files) {
    const { restore, trash } = discardPlan(files);
    const one = files.length === 1 ? files[0].path.split("/").pop() : null;
    const onlyNew = !restore.length;
    const title = onlyNew
      ? `Move ${one ?? `${files.length} files`} to the ${this.binName()}?`
      : `Discard changes in ${one ?? `${files.length} files`}?`;
    return {
      title,
      names: files.map((f) => f.path),
      note: !onlyNew && trash.length ? `${trash.length} new ${trash.length === 1 ? "file" : "files"} → ${this.binName()}` : undefined,
      action: onlyNew ? `Move to ${this.binName()}` : "Discard changes",
      danger: true,
      dontAsk: null,
    };
  },

  // The Unstaged files under a path ("" = all of them; a folder; or one file).
  unstagedUnder(path) {
    const all = (this.allFiles ?? []).filter((f) => f.unstaged && !f.conflict);
    if (!path) return all;
    return all.filter((f) => f.path === path || f.path.startsWith(`${path}/`));
  },

  async discardFiles(files, root, on) {
    const { restore, trash } = discardPlan(files);
    // A remote machine's system isn't known here; gio is the common one there.
    const platform = on ? "linux" : window()?.platform;
    // Not yet verified on Windows (REQUIREMENTS §4.3c): refuse before anything is touched.
    if (trash.length && platform === "windows") throw Error("Not yet verified on Windows");
    const git = (args) => exec("git", args, { cwd: root, on });
    if (restore.length && this.settings.discard?.snapshot !== false) {
      const snap = await git(["stash", "create", "awsome-changes discard"]);
      const hash = snap.stdout.trim();
      if (snap.code !== 0) throw Error((snap.stderr || "Could not keep a snapshot").trim());
      if (hash) await git(["update-ref", `${SNAPSHOTS}/${Date.now()}`, hash]);
    }
    for (let i = 0; i < restore.length; i += 200) {
      const result = await git(["--literal-pathspecs", "restore", "--worktree", "--", ...restore.slice(i, i + 200)]);
      if (result.code !== 0) throw Error((result.stderr || result.stdout).trim());
    }
    for (const path of trash) {
      const [command, args] = trashCommand(platform, `${root}/${path}`);
      const result = await exec(command, args, { cwd: root, on, timeout: 20000 });
      if (result.code !== 0) throw Error((result.stderr || result.stdout || `Could not move ${path} to the ${this.binName()}`).trim());
    }
  },

  // Asks first (unless confirm.discard is off), then discards. `path`: a file, a folder, or
  // null for the whole group.
  askDiscard(path, cx) {
    const files = this.unstagedUnder(path);
    if (!files.length || !this.root) return;
    if (this.settings.confirm?.discard === false) {
      this.discard(files.map((f) => f.path), cx);
      return;
    }
    this.openDiscardDialog(files);
    cx.notify();
  },

  discard(paths, cx) {
    if (!this.root || this.busy) return;
    const files = (this.allFiles ?? []).filter((f) => paths.includes(f.path) && f.unstaged && !f.conflict);
    if (!files.length) return;
    const root = this.root;
    const on = this.on;
    this.busy = true;
    this.note = null;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        await this.discardFiles(files, root, on);
        this.notifyDone(files);
      } catch (error) {
        this.note = `Discard failed: ${error.message}`;
      } finally {
        this.busy = false;
        this.refresh(cx);
        cx.notify();
      }
    });
  },
};
