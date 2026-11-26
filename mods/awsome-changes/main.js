// Awsome Changes: a Git sidebar, and the diff tab it opens in the centre. One
// class plays both roles; shared("awsome-changes.*") connects the copies.
// The class is built from separate files, so a method used here may live in any of:
//   git/repository.js   following the repository, the index, history, commit and amend
//   views/sidebar.js    the tabs, options menu, file groups and commit views
//   views/diff.js       opening a file in the centre tab, reading it, and drawing it
//   views/pane-header.js  the header row above a pane
// git/reads.js reads from Git, git/model.js parses its output, views/ui.js holds every look
// but the token colours: syntax.js colours a diff's code, and Awsome Viewer has the same file.
import { View } from "gpui-kit";
import { TextareaState } from "gpui-base";
import { props, shared, setShared, nextCommand, layout, run, notify, closeOverlay, checking, window } from "herdr";
import { loadSettings, duration } from "./settings.js";
import { followFileIcons } from "./file-icons.js";
import { panelCommands } from "./panel.js";
import { gitMethods } from "./git/repository.js";
import { sidebarMethods } from "./views/sidebar.js";
import { diffMethods } from "./views/diff.js";
import { paneHeaderMethods } from "./views/pane-header.js";
import { discardMethods } from "./git/discard.js";

const CONTEXT_POLL_MS = 300;
const STATUS_POLL_MS = 10000;
// Preferences a person may change in the installed mod.json under `settings`.
const DEFAULT_SETTINGS = {
  refresh: { status: "10s" },
  limits: { files: 1000, diff_lines: 1500, line_length: 4000, commits_per_page: 50 },
  default: { view: "tree", diff: "inline", history: "list" },
  panel: { toggle: false },
  confirm: { discard: true },
  discard: { snapshot: true },
};

function savedCollapsed() {
  try {
    const saved = JSON.parse(localStorage.getItem("collapsed") ?? "[]");
    return Array.isArray(saved) ? saved.filter((scope) => typeof scope === "string") : [];
  } catch {
    return [];
  }
}

class AwsomeChanges extends View {
  init(given, cx) {
    const p = props() ?? given ?? {};
    // Herdr hands a pane header its pane. One copy runs per pane, so it reads no Git.
    if (p.pane) {
      this.mode = "pane-header";
      this.hovered = false;
      return;
    }
    // Discard's confirmation: this mod opened again as a dialog (the shared confirm.js).
    if (p.ask) {
      this.mode = "ask";
      this.ask = p.ask;
      this.menuHandle = cx.focus_handle();
      this.menuHandle.focus();
      return;
    }
    // A row's right-click menu: this mod opened again as a popup (as Awsome Files does).
    if (p.menu) {
      this.mode = "menu";
      this.menu = p.menu;
      this.menuHandle = cx.focus_handle();
      this.menuHandle.focus();
      this.at = -1;
      return;
    }
    if (p.overlay) {
      this.mode = "panel-key";
      if (!checking()) this.runPanelKey(p.overlay, cx);
      return;
    }
    this.mode = p.mode ?? "sidebar";
    this.diffSpace = p.space;
    this.source = p.source;
    this.settings = DEFAULT_SETTINGS;
    this.tab = localStorage.getItem("tab") === "commit" ? "commit" : "changes";
    this.view = localStorage.getItem("view") === "flat" ? "flat" : "tree";
    this.diffLayout =
      shared("awsome-changes.diff-layout") ??
      (localStorage.getItem("diff-layout") === "split" ? "split" : "inline");
    if (this.mode === "sidebar") setShared("awsome-changes.diff-layout", this.diffLayout);
    // The panel's keyboard, for Esc on a commit's details (§4.6a).
    this.focus = cx.focus_handle();
    this.historyView = localStorage.getItem("commit-view") === "graph" ? "graph" : "list";
    this.range = localStorage.getItem("commit-range") === "all" ? "all" : "current";
    this.hoverKey = null;
    // A choice left in shared state from before a restart is never run again (a discard!).
    this.rowActionAt = shared("awsome-changes.row-action")?.at;
    this.wantMore = false;
    this.closed = new Set();
    this.collapsed = new Set(savedCollapsed());
    this.files = [];
    this.rows = [];
    this.splitOffset = 0;
    this.diffToken = 0;
    this.resetCommits();
    if (this.mode === "sidebar") this.initCommitBox(cx);

    if (checking()) return;
    this.restoreDiffSelection(p);
    // Awsome Tabs draws this on the diff tab.
    setShared("mod-icons", {
      ...(shared("mod-icons") ?? {}),
      "awsome-changes": "mods/awsome-changes/icons/file.svg",
    });
    followFileIcons(this, cx);
    cx.timer.every(CONTEXT_POLL_MS, (cx) => this.follow(cx));
    this.applySettings(cx);
    cx.spawn(async (cx) => {
      for (;;) this.command(await nextCommand(), cx);
    });
    this.refresh(cx);
  }

  close() {
    this.stopWatching();
  }

  // `mod.open:awsome-changes` from a key. `<mod>.<command>` can't reach a hidden
  // panel, so a copy opens as an overlay for a moment and acts on the layout.
  runPanelKey(overlay, cx) {
    cx.spawn(async () => {
      try {
        const { settings } = await loadSettings("awsome-changes", DEFAULT_SETTINGS);
        const commands = panelCommands(layout(), "awsome-changes", settings.panel.toggle);
        if (commands) for (const [name, args] of commands) run(name, args);
        else notify({ title: "Awsome Changes isn't in this layout" });
      } finally {
        closeOverlay(overlay);
      }
    });
  }

  initCommitBox(cx) {
    this.message = "";
    this.messageRevision = 0;
    this.commitMode = "commit";
    this.commitMenuOpen = false;
    this.commitMenuFocus = cx.focus_handle();
    this.amendToken = 0;
    this.amendLoading = false;
    this.amendHead = null;
    this.typing = false;
    this.makeInput("");
  }

  // Enter makes a new line; Ctrl+Enter (macOS Cmd+Enter) commits. The placeholder names the
  // branch (docs/REQUIREMENTS.md §2.9), and a state can't change its placeholder, so a new branch
  // makes a new state that keeps what was typed.
  makeInput(value) {
    this.inputBranch = this.branch ?? null;
    const keys = window()?.platform === "macos" ? "Cmd+Enter" : "Ctrl+Enter";
    const on = this.inputBranch ? ` on ${this.inputBranch}` : "";
    this.input = TextareaState.new({ placeholder: `Message (${keys} to commit${on})`, rows: 4, value });
    this.input.on("change", (_e, cx) => {
      this.message = this.input.value();
      this.messageRevision++;
      cx.notify();
    });
    this.input.on("focus", (_e, cx) => {
      this.typing = true;
      cx.notify();
    });
    this.input.on("blur", (_e, cx) => {
      this.typing = false;
      cx.notify();
    });
  }

  // Read the installed mod.json once, then start the status poll at its pace.
  // The view and diff defaults apply only where nothing was chosen before.
  applySettings(cx) {
    cx.spawn(async (cx) => {
      const { settings, problems } = await loadSettings("awsome-changes", DEFAULT_SETTINGS);
      for (const problem of problems) console.warn(`awsome-changes mod.json settings: ${problem}`);
      // A limit of zero would empty the panel, so it falls back like a bad value.
      for (const key of Object.keys(settings.limits))
        if (!(settings.limits[key] > 0)) settings.limits[key] = DEFAULT_SETTINGS.limits[key];
      this.settings = settings;
      if (localStorage.getItem("view") === null && ["tree", "flat"].includes(settings.default.view))
        this.view = settings.default.view;
      if (localStorage.getItem("commit-view") === null && ["list", "graph"].includes(settings.default.history))
        this.historyView = settings.default.history;
      if (
        this.mode === "sidebar" &&
        localStorage.getItem("diff-layout") === null &&
        ["inline", "split"].includes(settings.default.diff)
      ) {
        this.diffLayout = settings.default.diff;
        setShared("awsome-changes.diff-layout", this.diffLayout);
      }
      // A floor, so a bare number read as milliseconds cannot spin Git.
      cx.timer.every(Math.max(1000, duration(settings.refresh.status, STATUS_POLL_MS)), (cx) =>
        this.refresh(cx),
      );
      cx.notify();
    });
  }

  // `awsome-changes.<command>`, for keys.
  command(command, cx) {
    if (command === "refresh") this.refreshAll(cx);
    if (command === "changes" || command === "commit") this.setTab(command, cx);
    if (command === "flat" || command === "tree") this.setView(command, cx);
    if (command === "inline" || command === "split") this.setDiffLayout(command, cx);
    if (command === "history-list" || command === "history-graph")
      this.setHistoryView(command.slice("history-".length), cx);
    // scripts/ui-open-check.py opens the row menu this way, for the first changed file (L7).
    if (command === "check-open:row" && this.mode === "sidebar") {
      const file = this.files[0];
      if (file) this.openRowMenu(file, file.staged ? "staged" : "unstaged", `file:check:${file.path}`, cx);
    }
    // For checks and screenshots: History with one commit's details (read-only).
    // `check-open:commit` picks the first merge (or the first commit); `check-open:commit:N` the Nth.
    if (command.startsWith("check-open:commit") && this.mode === "sidebar") {
      this.setTab("commit", cx);
      const index = Number(command.split(":")[2]);
      const pick = (cx, tries) => {
        const commit = Number.isInteger(index) ? this.commits[index] : (this.commits.find((c) => c.parents.length > 1) ?? this.commits[0]);
        if (commit) {
          if (this.selectedCommit?.hash !== commit.hash) this.openCommit(commit, cx);
        } else if (tries > 0) cx.timer.after(250, (cx) => pick(cx, tries - 1));
      };
      pick(cx, 20);
    }
    if (command.startsWith("open:")) {
      const file = this.files.find((f) => f.path === command.slice(5));
      if (file)
        this.pick(file, file.conflict ? "conflict" : file.unstaged ? "unstaged" : "staged", cx);
    }
  }

  follow(cx) {
    const style = shared("awsome-changes.diff-layout");
    if (style && style !== this.diffLayout) {
      this.diffLayout = style;
      localStorage.setItem("diff-layout", style);
      cx.notify();
    }
    if (this.contextKey() !== this.context) this.refresh(cx);
    // A row menu's choice, made in the popup copy, runs here where the repository is.
    const action = shared("awsome-changes.row-action");
    if (action && action.at !== this.rowActionAt && this.mode === "sidebar") {
      this.rowActionAt = action.at;
      if (action.context === this.context && Date.now() - action.at < 10000) this.rowAction(action, cx);
    }
    // The graph asked for its next page while drawing; reading starts here, outside the draw.
    if (this.wantMore) {
      this.wantMore = false;
      if (this.tab === "commit" && !this.commitsDone) this.loadCommits(cx, true);
    }
    if (this.mode === "diff") {
      this.syncSelection(cx);
      if (this.root && this.path && this.shownFull !== this.fullFile()) this.loadDiff(cx);
      this.publishHead();
    }
    const reload = shared("awsome-changes.reload");
    if (
      reload &&
      reload.at !== this.reload &&
      reload.root === this.root &&
      reload.on === (this.on ?? null) &&
      !this.loading &&
      !this.busy
    ) {
      this.reload = reload.at;
      this.refresh(cx);
    }
  }
}

Object.assign(AwsomeChanges.prototype, gitMethods, sidebarMethods, diffMethods, paneHeaderMethods, discardMethods);

export default AwsomeChanges;
