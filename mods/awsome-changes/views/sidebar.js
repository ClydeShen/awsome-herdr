// The sidebar: Files' frame (docs/REQUIREMENTS.md §2.9) around the Changes and History views.
import { div } from "gpui-kit";
import { v_flex, h_flex, v_virtual_list, Scrollbar, v_resizable, resizable_panel, TextView } from "gpui-base";
import { theme, shared, setShared, notify, spaces, run, openOverlay, closeOverlay, props, window, exec } from "herdr";
import { menuView, menuHeight, menuWidth, menuKey } from "../menu.js";
import { confirmView, confirmHeight, confirmKey, CONFIRM } from "../confirm.js"; // shared awsome-* confirmation (identical copies in each mod)
import { fileTree, timeAgo, shortAgo, stamp, stampFull, grouped } from "../git/model.js";
import { gitColor, GIT_ORDER, GIT_WORD } from "../git-status.js";
import {
  TEXT,
  SPIN_MS,
  codeFont,
  FileIcon,
  Panel,
  Message,
  Menu,
  MenuOption,
  TextBox,
  SplitButton,
  SplitTrigger,
  PANEL as P,
  HISTORY as H,
  PaneButton,
  FrameHeader,
  GroupTitle,
  TreeRow,
  LaneCell,
  RefLabel,
  UiIcon,
  TextButton,
} from "./ui.js";

// The graph's lane colors, one hue each, blue first like the current branch's label (§4.6a).
const laneColors = (t) => [t.ansi4, t.ansi2, t.ansi5, t.ansi6, t.ansi3, t.ansi1];
const UI = (name) => `mods/awsome-icons/ui/${name}.svg`;

// A commit message is plain text, not Markdown (§4.5b B1): every ASCII punctuation mark is
// escaped, line breaks stay (hard breaks), and web addresses are left as they are so TextView
// links them, as GitHub does. The subject is bold.
const BACKSLASH = String.fromCharCode(92);
function plainMarkdown(text) {
  return text
    .split(/(https?:[/][/][^\s<>]+)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[!-/:-@[-`{-~]/g, (c) => BACKSLASH + c)))
    .join("");
}
// Bodies are usually wrapped at ~72 columns; in a narrower panel that leaves ragged lines, so
// wrapped lines join back into their paragraph. A blank line, a list item and a trailer
// (`Co-authored-by: …`) still start a new line.
const OWN_LINE = /^\s*(?:[-*+]\s|\d+[.)]\s|[A-Za-z][\w-]*:\s)/;
function unwrap(body) {
  const out = [];
  for (const line of body.split("\n")) {
    const last = out.length - 1;
    if (last >= 0 && out[last].trim() && line.trim() && !OWN_LINE.test(line)) out[last] += ` ${line.trim()}`;
    else out.push(line);
  }
  return out;
}
export function messageMarkdown(commit) {
  const subject = `**${plainMarkdown(commit.subject)}**`;
  if (!commit.body) return subject;
  return `${subject}\n\n${unwrap(commit.body).map(plainMarkdown).join("  \n")}`;
}

// The file manager's name on this system (§2.5), as Files' menu writes it.
export function revealLabel() {
  const platform = window()?.platform;
  return platform === "macos" ? "Reveal in Finder" : platform === "windows" ? "Reveal in File Explorer" : "Open in file manager";
}

// Shows a file in the system's file manager (the same commands as Files' menu).
export async function revealExternal(abs) {
  const platform = window()?.platform;
  if (platform === "macos") await exec("open", ["-R", "--", abs]);
  else if (platform === "windows") await exec("explorer.exe", [`/select,${abs.split("/").join(String.fromCharCode(92))}`]);
  else await exec("xdg-open", [abs.replace(/[/][^/]*$/, "") || "/"]);
}

// A changed file's right-click menu (§4.5b B2, VS Code's Source Control order; danger last, §2.6).
// m: { path, scope, conflict, fresh, local }; act(action) runs one in the panel copy.
function rowMenuEntries(m, act) {
  const stage = m.scope === "staged" ? "unstage" : m.scope === "unstaged" || m.scope === "conflict" ? "stage" : null;
  const discard = m.scope === "unstaged" && !m.conflict;
  return [
    { id: "diff", label: "Open diff", icon: UI("git-diff"), keys: "Enter", run: () => act("diff") },
    { id: "preview", label: "Preview", icon: UI("eye"), run: () => act("preview") },
    ...(stage
      ? [
          "-",
          {
            id: stage,
            label: stage === "stage" ? "Stage changes" : "Unstage changes",
            icon: UI(stage === "stage" ? "plus" : "minus"),
            keys: "Space",
            run: () => act(stage),
          },
        ]
      : []),
    "-",
    { id: "reveal", label: revealLabel(), icon: UI("folder-open"), disabled: !m.local, reason: "The file is on another machine", run: () => act("reveal") },
    { id: "rel", label: "Copy relative path", icon: UI("copy"), run: () => act("copy-rel") },
    { id: "abs", label: "Copy absolute path", icon: UI("copy"), run: () => act("copy-abs") },
    ...(m.fresh ? [{ id: "ignore", label: "Add to .gitignore", icon: UI("prohibit"), run: () => act("ignore") }] : []),
    ...(discard ? ["-", { id: "discard", label: "Discard changes…", icon: UI("arrow-counter-clockwise"), danger: true, run: () => act("discard") }] : []),
  ];
}

// A row's tooltip says only what the row doesn't (docs/REQUIREMENTS.md §2.5, UI-LESSONS L20):
// the status in words (the row shows it by color only), facts the row has no place for, and the
// full path only when the row cuts it off. Nothing left to say: no tooltip.
const MONO_13 = 7.8; // px per character of JetBrains Mono 13 (names)
const MONO_11 = 6.6; // px per character of JetBrains Mono 11 (folders)
const capital = (word) => (word ? word[0].toUpperCase() + word.slice(1) : "");
export function tipFor(parts) {
  const text = parts.filter(Boolean).join(" · ");
  return text || null;
}
// Whether a row's name (and its folder, in a flat list) is cut off in `room` pixels.
function cutOff(name, dir, room, nameMax = 220) {
  const nameWidth = name.length * MONO_13;
  if (nameWidth > Math.min(nameMax, room)) return true;
  return Boolean(dir) && nameWidth + 4 + dir.length * MONO_11 > room;
}

const SCOPE_STATUS = {
  staged: (file) => file.stagedStatus,
  unstaged: (file) => file.unstagedStatus,
};

export const sidebarMethods = {
  // ── Preferences ───────────────────────────────────────────────────────────

  setTab(tab, cx) {
    this.tab = tab;
    localStorage.setItem("tab", tab);
    if (tab === "commit") this.loadCommits(cx);
    cx.notify();
  },

  setView(view, cx) {
    this.view = view;
    localStorage.setItem("view", view);
    cx.notify();
  },

  toggleGroup(scope, cx) {
    if (!this.collapsed.delete(scope)) this.collapsed.add(scope);
    localStorage.setItem("collapsed", JSON.stringify([...this.collapsed]));
    cx.notify();
  },

  setDiffLayout(style, cx) {
    this.diffLayout = style;
    localStorage.setItem("diff-layout", style);
    setShared("awsome-changes.diff-layout", style);
    cx.notify();
  },

  // One row at a time shows its actions: the one under the pointer.
  hover(key) {
    return (over, cx) => {
      const next = over ? key : this.hoverKey === key ? null : this.hoverKey;
      if (next === this.hoverKey) return;
      this.hoverKey = next;
      cx.notify();
    };
  },

  // ── Frame ─────────────────────────────────────────────────────────────────

  render() {
    if (this.mode === "panel-key") return div();
    if (this.mode === "pane-header") return this.renderPaneHeader();
    if (this.mode === "diff") return this.renderDiff();
    if (this.mode === "menu") return this.renderRowMenu();
    if (this.mode === "ask") return this.renderAsk();
    return Panel({ id: "awsome-changes" })
      .on_size_change((size, cx) => {
        // The width tells a tooltip whether a name is cut off (tipFor).
        if (Math.abs(size.height - (this.panelHeight ?? 0)) > 4 || Math.abs(size.width - (this.panelWidth ?? 0)) > 4) {
          this.panelHeight = size.height;
          this.panelWidth = size.width;
          cx.notify();
        }
      })
      .track_focus(this.focus)
      .on_key_down((event, cx) => this.key(event, cx))
      .child(this.renderHeader())
      .child(this.tab === "commit" ? this.renderHistory() : this.renderChanges());
  },

  // Ctrl+Enter (macOS Cmd+Enter) commits from the message box; 1 and 2 switch views, as in Files;
  // the arrows, Enter and Space work the changed files (§4.5a); Esc closes a commit's details.
  key(event, cx) {
    if (this.typing) {
      const mod = event.modifiers.control || event.modifiers.platform;
      if (event.key === "enter" && mod && this.canCommit()) {
        cx.stop_propagation();
        this.commit(cx);
      }
      return;
    }
    if (this.tab === "changes" && this.rowKey(event, cx)) {
      cx.stop_propagation();
      return;
    }
    if (event.key === "1" || event.key === "2") {
      cx.stop_propagation();
      this.setTab(event.key === "1" ? "changes" : "commit", cx);
      return;
    }
    if (event.key !== "escape" || !this.selectedCommit) return;
    cx.stop_propagation();
    this.closeCommit(cx);
  },

  // The keyboard cursor over the rows drawn last (navRows, in order): the same keys as Files.
  rowKey(event, cx) {
    const rows = this.navRows ?? [];
    if (!rows.length) return false;
    const at = rows.findIndex((r) => r.key === this.cursor);
    const row = rows[at];
    if (event.key === "down" || event.key === "up") {
      const next = at < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, at + (event.key === "down" ? 1 : -1)));
      this.cursor = rows[next].key;
      cx.notify();
      return true;
    }
    if (!row) return false;
    if (event.key === "enter") {
      if (row.file) this.pick(row.file, row.scope, cx);
      else row.toggle(cx);
      return true;
    }
    if (event.key === "space" && row.file) {
      // In Conflicts, Space stages the file: marks it resolved, as VS Code does (§4.5b B2).
      const stage = row.scope === "staged" ? "unstage" : "stage";
      this.indexAction(stage, row.file.path, cx);
      return true;
    }
    if ((event.key === "left" || event.key === "right") && !row.file) {
      if ((event.key === "left") === row.open) row.toggle(cx);
      return true;
    }
    return false;
  },

  // A row the pointer or the menu acted on becomes the cursor, and the panel takes the keyboard.
  point(key) {
    this.cursor = key;
    this.focus.focus();
  },

  openRowMenu(file, scope, key, cx) {
    this.point(key);
    const m = { path: file.path, scope, conflict: Boolean(file.conflict), fresh: Boolean(file.fresh), local: !this.on, context: this.context };
    const entries = rowMenuEntries(m, () => {});
    openOverlay({ mod: "awsome-changes", kind: "popup", frame: "none", width: menuWidth(entries), height: menuHeight(entries), props: { menu: m } });
    cx.notify();
  },

  // The popup copy: the shared menu (menu.js); a choice is handed to the panel copy.
  renderRowMenu() {
    const close = () => closeOverlay(props().overlay);
    const act = (action) => setShared("awsome-changes.row-action", { ...this.menu, action, at: Date.now() });
    const entries = rowMenuEntries(this.menu, act);
    const runEntry = (e, cx) => {
      close();
      e.run(cx);
    };
    return div()
      .size_full()
      .track_focus(this.menuHandle)
      .on_key_down((ev, cx) => {
        const next = menuKey(entries, this.at, ev.key, (e) => runEntry(e, cx), close);
        if (next === null) return;
        this.at = next;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        menuView({
          id: "changes-menu",
          entries,
          at: this.at,
          run: runEntry,
          mono: codeFont(),
          // scripts/ui-open-check.py reads the size it was really laid out at (L7).
          onSize: (size) =>
            setShared("awsome-changes.rendered", {
              scope: "row",
              width: Math.round(size.width),
              height: Math.round(size.height),
              expected: { width: menuWidth(entries), height: menuHeight(entries) },
              at: Date.now(),
            }),
        }),
      );
  },

  rowAction({ action, path, paths, scope }, cx) {
    // The confirmation dialog's yes: discard exactly the files it listed.
    if (action === "discard-confirmed") {
      this.discard(paths ?? [], cx);
      return;
    }
    const file = this.files.find((f) => f.path === path);
    if (!file) return;
    const abs = `${this.root}/${path}`;
    if (action === "diff") this.pick(file, scope, cx);
    if (action === "preview") this.openFile(path, cx);
    if (action === "stage" || action === "unstage") this.indexAction(action, path, cx);
    if (action === "discard") this.askDiscard(path, cx);
    if (action === "reveal") revealExternal(abs).catch((e) => notify({ title: "Could not open the folder", body: String(e?.message ?? e), level: "error" }));
    if (action === "copy-rel" || action === "copy-abs") {
      const text = action === "copy-rel" ? path : abs;
      cx.write_to_clipboard(text);
      notify({ title: "Copied", body: text, level: "info", timeout: 2000 });
    }
    if (action === "ignore") this.ignoreFile(path, cx);
  },

  // Add to .gitignore (VS Code's, for a new file): one line, the file's path from the repository root.
  ignoreFile(path, cx) {
    const root = this.root;
    const on = this.on;
    const line = `/${path}`;
    // Herdr's fs writes only inside its own folder, so the system appends the line: PowerShell
    // on Windows (no byte-order mark), sh elsewhere and on remote machines. A file that doesn't
    // end in a newline gets one first, so the new line never joins the last one.
    const windows = !on && window()?.platform === "windows";
    const quote = (s) => `'${s.replace(/['\u2018-\u201B]/g, (c) => c + c)}'`;
    const [command, args] = windows
      ? [
          "powershell",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `$f = Join-Path ${quote(root)} '.gitignore'; $nl = [string][char]10; $pre = ''; ` +
              `if ((Test-Path -LiteralPath $f) -and ((Get-Item -LiteralPath $f).Length -gt 0)) { $old = [IO.File]::ReadAllText($f); if (-not $old.EndsWith($nl)) { $pre = $nl } }; ` +
              `[IO.File]::AppendAllText($f, $pre + ${quote(line)} + $nl)`,
          ],
        ]
      : ["sh", ["-c", 'f="$1/.gitignore"; if [ -s "$f" ] && [ "$(tail -c1 "$f" | wc -l)" -eq 0 ]; then echo >> "$f"; fi; echo "$2" >> "$f"', "sh", root, line]];
    cx.spawn(async (cx) => {
      const add = await exec(command, args, { cwd: root, on }).catch((e) => ({ code: 1, stderr: String(e?.message ?? e) }));
      if (add.code !== 0) this.note = `Could not add ${path} to .gitignore: ${(add.stderr || "").trim()}`;
      this.refresh(cx);
      cx.notify();
    });
  },

  // The confirmation (§2.6, the shared confirm.js), opened as a dialog copy of this mod.
  openDiscardDialog(files) {
    const text = this.discardText(files);
    openOverlay({
      mod: "awsome-changes",
      kind: "dialog",
      frame: "none",
      width: CONFIRM.width,
      height: confirmHeight(text),
      props: { ask: { context: this.context, paths: files.map((f) => f.path), text } },
    });
  },

  renderAsk() {
    const close = () => closeOverlay(props().overlay);
    const { context, paths, text } = this.ask;
    const yes = () => {
      close();
      setShared("awsome-changes.row-action", { action: "discard-confirmed", context, paths, at: Date.now() });
    };
    return div()
      .size_full()
      .track_focus(this.menuHandle)
      .on_key_down((ev, cx) => {
        if (confirmKey(ev.key, yes, close)) cx.stop_propagation();
      })
      .child(confirmView({ id: "changes-discard", ...text, onConfirm: yes, onCancel: close, mono: codeFont() }));
  },

  // The toast after a discard (§2.6: a short note for work done in the background).
  notifyDone(files) {
    const name = files.length === 1 ? files[0].path.split("/").pop() : `${files.length} files`;
    const onlyNew = files.every((f) => f.fresh);
    notify({
      title: onlyNew ? `Moved ${name} to the ${this.binName()}` : `Discarded changes in ${name}`,
      level: "info",
      timeout: 3000,
    });
  },

  repoName() {
    const root = (this.root ?? "").split(String.fromCharCode(92)).join("/");
    return root.split("/").filter(Boolean).pop() ?? "";
  },

  // Files' header (§4.3, §2.9): the repository, the two views, that view's tools.
  renderHeader() {
    const unpushed = this.committed?.unpushed.size;
    const views = [
      PaneButton({
        id: "view-changes",
        icon: "mods/changes/changes.svg",
        label: this.total ? `Changes (1) · ${grouped(this.total)} changed files` : "Changes (1)",
        active: this.tab === "changes",
        onClick: (cx) => this.setTab("changes", cx),
      }),
      PaneButton({
        id: "view-history",
        icon: "git-commit",
        label: ["History (2)", unpushed ? `${grouped(unpushed)} not pushed` : "", this.behind ? `${grouped(this.behind)} not pulled` : ""]
          .filter(Boolean)
          .join(" · "),
        active: this.tab === "commit",
        onClick: (cx) => this.setTab("commit", cx),
      }),
    ];
    return FrameHeader({
      name: this.repoName(),
      views,
      tools: this.tab === "commit" ? this.historyTools() : this.changesTools(),
      onName: () => run("layout.select", { stack: "panel-body", child: "files" }),
    });
  },

  refreshButton() {
    return PaneButton({
      id: "refresh",
      icon: "arrows-clockwise",
      label: "Refresh",
      spinning: this.refreshSpinning,
      onClick: (cx) => this.refreshAll(cx),
    });
  },

  // Side by side lives on the diff's own header now, next to what it changes (§4.5b B3, L16).
  changesTools() {
    const tree = this.view === "tree";
    return [
      PaneButton({
        id: "view-tree",
        icon: "tree-structure",
        label: tree ? "Show as list" : "Show as tree",
        active: tree,
        onClick: (cx) => this.setView(tree ? "flat" : "tree", cx),
      }),
      this.refreshButton(),
    ];
  },

  historyTools() {
    const graph = this.historyView === "graph";
    const all = this.range === "all";
    return [
      PaneButton({
        id: "history-graph",
        icon: "git-merge",
        label: graph ? "Show list" : "Show graph",
        active: graph,
        onClick: (cx) => this.setHistoryView(graph ? "list" : "graph", cx),
      }),
      ...(graph
        ? [
            PaneButton({
              id: "history-all",
              icon: "git-fork",
              label: all ? "Show current branch" : "Show all branches",
              active: all,
              onClick: (cx) => this.setRange(all ? "current" : "all", cx),
            }),
          ]
        : []),
      this.refreshButton(),
    ];
  },

  refreshAll(cx) {
    this.refresh(cx);
    if (this.tab === "commit") this.loadCommits(cx);
    if (this.refreshSpinning) return;
    this.refreshSpinning = true;
    cx.notify();
    cx.timer.after(SPIN_MS, (cx) => this.stopSpinningWhenRead(cx));
  },

  // Git usually answers at once, so the icon always makes a full turn to be seen.
  stopSpinningWhenRead(cx) {
    if (this.loading || this.commitsLoading) {
      cx.timer.after(SPIN_MS, (cx) => this.stopSpinningWhenRead(cx));
      return;
    }
    this.refreshSpinning = false;
    cx.notify();
  },

  // ── Changes (§4.5, §4.5a) ─────────────────────────────────────────────────

  // The commit box on top, then the groups.
  renderChanges() {
    this.navRows = [];
    // The list ends with panel.end of space, so its end reads as the end (§4.5b B4).
    const list = v_flex().id("changes-list").flex_1().min_h(0).overflow_y_scrollbar().pb(P.end);
    if (this.error) return v_flex().flex_1().min_h(0).child(Message(this.error, true));
    const conflicts = this.files.filter((f) => f.conflict);
    const unstaged = this.files.filter((f) => f.unstaged && !f.conflict);
    const staged = this.files.filter((f) => f.staged);
    if (!conflicts.length && !unstaged.length && !staged.length)
      if (this.loading || !this.root) list.child(Message("Loading changes…"));
    // VS Code's Source Control groups, named as the user chose (§4.5b B2). The upstream's
    // "Committed, not on origin" group is gone: History's button says what isn't pushed.
    this.addGroup(list, "conflict", "Conflicts", conflicts);
    this.addGroup(list, "staged", "Staged", staged);
    this.addGroup(list, "unstaged", "Unstaged", unstaged);
    const limit = this.settings.limits.files;
    if (this.total > limit)
      list.child(
        div()
          .px(P.px)
          .py(4)
          .text_size(P.secondary)
          .text_color(theme().muted)
          .child(`Showing the first ${grouped(limit)} of ${grouped(this.total)} changed files.`),
      );
    return v_flex().id("changes").flex_1().min_h(0).child(this.renderCommitBox()).child(list);
  },

  renderCommitBox() {
    const t = theme();
    const hint = this.commitBoxHint();
    return v_flex()
      .id("commit-box")
      .flex_none()
      .px(P.px)
      .pt(2)
      .pb(8)
      .gap(8)
      .when(Boolean(this.note), (el) =>
        el.child(div().text_size(P.text).text_color(t.ansi1).whitespace_normal().child(this.note ?? "")),
      )
      .child(TextBox({ id: "commit-message", state: this.input, focused: this.typing, label: "Commit message" }))
      .child(this.renderCommitButton())
      .when(Boolean(hint), (el) =>
        el.child(
          div()
            .text_size(P.secondary)
            .text_color(this.commitMode === "amend" ? t.working : t.muted)
            .whitespace_normal()
            .child(hint ?? ""),
        ),
      );
  },

  commitBoxHint() {
    if (this.amendLoading) return "Loading the latest commit…";
    if (this.conflicts) return "Resolve conflicts and stage the files before committing.";
    if (this.commitMode === "amend") {
      return "Amend rewrites the latest commit. Unstaged changes stay untouched.";
    }
    return null;
  },

  commitButtonLabel() {
    if (this.operation === "commit") return "Committing…";
    if (this.operation === "amend") return "Amending…";
    return this.commitMode === "amend" ? "Amend" : "Commit";
  },

  renderCommitButton() {
    const amend = this.commitMode === "amend";
    return SplitButton({
      id: "commit",
      icon: amend ? "pencil-simple" : "check",
      label: this.commitButtonLabel(),
      enabled: this.canCommit(),
      reason: this.commitBlocker(),
      onClick: (cx) => this.commit(cx),
      menu: this.renderCommitMenu(),
    });
  },

  renderCommitMenu() {
    const amend = this.commitMode === "amend";
    const choose = (mode) => (cx) => this.setCommitMode(mode, cx);
    const options = [
      MenuOption({ id: "mode-commit", icon: "commit", label: "Commit", selected: !amend, onClick: choose("commit") }),
    ];
    if (this.hasHead) {
      options.push(
        MenuOption({ id: "mode-amend", icon: "amend", label: "Amend", selected: amend, onClick: choose("amend") }),
      );
    }
    return Menu({
      id: "commit-menu",
      open: this.commitMenuOpen,
      focus: this.commitMenuFocus,
      anchor: "bottom_right",
      onOpenChange: (open, cx) => {
        this.commitMenuOpen = open;
        cx.notify();
      },
      trigger: SplitTrigger({ id: "commit-options", label: "Commit options" }),
      children: options,
    });
  },

  // A group: its title (with the whole group's actions while hovered), then its rows.
  addGroup(list, scope, label, files) {
    if (!files.length) return;
    const t = theme();
    const collapsed = this.collapsed.has(scope);
    const actions = {
      unstaged: [
        PaneButton({ id: "discard-all", icon: "arrow-counter-clockwise", label: "Discard all changes…", onClick: (cx) => this.askDiscard(null, cx) }),
        PaneButton({ id: "stage-all", icon: "plus", label: "Stage all changes", onClick: (cx) => this.indexAction("stage", null, cx) }),
      ],
      staged: [
        PaneButton({ id: "unstage-all", icon: "minus", label: "Unstage all changes", onClick: (cx) => this.indexAction("unstage", null, cx) }),
      ],
    }[scope] ?? [];
    list.child(
      GroupTitle({
        id: `group-${scope}`,
        open: !collapsed,
        title: [div().flex_none().when(scope === "conflict", (el) => el.text_color(t.ansi5)).child(label)],
        count: grouped(files.length),
        hovered: this.hoverKey === `group:${scope}`,
        onHover: this.hover(`group:${scope}`),
        actions,
        onClick: (cx) => this.toggleGroup(scope, cx),
      }),
    );
    if (collapsed) return;
    const rows = v_flex().px(P.inset);
    if (this.view === "flat") {
      for (const file of files) rows.child(this.fileRow(file, scope, 0));
    } else {
      const closed = new Set(
        [...this.closed].filter((key) => key.startsWith(`${scope}:`)).map((key) => key.slice(scope.length + 1)),
      );
      const statusOf = SCOPE_STATUS[scope] ?? ((file) => file.status);
      for (const row of fileTree(files, closed, statusOf))
        rows.child(
          row.kind === "folder"
            ? this.folderRow(row, scope, closed.has(row.path))
            : this.fileRow(row.file, scope, row.depth),
        );
    }
    list.child(rows);
  },

  folderRow(row, scope, closed) {
    const t = theme();
    const key = `${scope}:${row.path}`;
    const toggle = (cx) => {
      if (closed) this.closed.delete(key);
      else this.closed.add(key);
      cx.notify();
    };
    this.navRows.push({ key: `folder:${key}`, open: !closed, toggle });
    const hovered = this.hoverKey === `folder:${key}`;
    // The whole folder's actions while hovered (§4.5b B2): Unstaged discards or stages it,
    // Staged unstages it.
    const actions = !hovered
      ? null
      : scope === "unstaged"
        ? [
            PaneButton({ id: `discard-${key}`, icon: "arrow-counter-clockwise", label: "Discard changes…", onClick: (cx) => this.askDiscard(row.path, cx) }),
            PaneButton({ id: `stage-${key}`, icon: "plus", label: "Stage changes", onClick: (cx) => this.indexAction("stage", row.path, cx) }),
          ]
        : scope === "staged"
          ? [PaneButton({ id: `unstage-${key}`, icon: "minus", label: "Unstage changes", onClick: (cx) => this.indexAction("unstage", row.path, cx) })]
          : null;
    return TreeRow({
      id: `folder-${key}`,
      depth: row.depth,
      chevron: !closed,
      icon: FileIcon({ icons: this.fileIcons, path: `${this.root}/${row.path}`, dir: true, open: !closed, t, size: P.fileIcon }),
      name: row.name,
      color: gitColor(t, row.status),
      actions,
      // What's inside (the folder shows only its worst status's color); the path only if cut off.
      tip: tipFor([
        cutOff(row.name, "", this.rowRoom(row.depth, false)) ? row.path : "",
        ...GIT_ORDER.filter((s) => row.counts?.[s]).map((s) => `${grouped(row.counts[s])} ${GIT_WORD[s]}`),
      ]),
      ringed: this.ringed(`folder:${key}`),
      onHover: this.hover(`folder:${key}`),
      onClick: (cx) => {
        this.point(`folder:${key}`);
        toggle(cx);
      },
    });
  },

  // A changed file (§4.5b B2): name in its status color, +N −N, and on hover, in the same slot,
  // VS Code's inline actions: Preview, Discard (Unstaged only), Stage or Unstage.
  fileRow(file, scope, depth) {
    const t = theme();
    const parts = file.path.split("/");
    const name = parts.pop();
    const stats = scope === "staged" ? file.stagedStats : scope === "unstaged" ? file.unstagedStats : file;
    const status = (SCOPE_STATUS[scope] ?? ((f) => f.status))(file) ?? (file.conflict ? "U" : null);
    const open = shared("awsome-changes.selection");
    const key = `file:${scope}:${file.path}`;
    this.navRows.push({ key, file, scope });
    const hovered = this.hoverKey === key;
    // In Conflicts, staging marks the file resolved (VS Code).
    const stage = scope === "staged" ? "unstage" : "stage";
    const actions = hovered
      ? [
          PaneButton({ id: `preview-${key}`, icon: "eye", label: "Preview", onClick: (cx) => this.openFile(file.path, cx) }),
          ...(scope === "unstaged"
            ? [PaneButton({ id: `discard-${key}`, icon: "arrow-counter-clockwise", label: "Discard changes…", onClick: (cx) => this.askDiscard(file.path, cx) })]
            : []),
          PaneButton({
            id: `${stage}-${key}`,
            icon: stage === "stage" ? "plus" : "minus",
            label: stage === "stage" ? "Stage changes" : "Unstage changes",
            onClick: (cx) => this.indexAction(stage, file.path, cx),
          }),
        ]
      : null;
    return TreeRow({
      id: key,
      depth,
      flat: this.view === "flat",
      icon: FileIcon({ icons: this.fileIcons, path: `${this.root}/${file.path}`, color: t.muted, t, size: P.fileIcon }),
      name,
      color: gitColor(t, status),
      strike: status === "D",
      dir: this.view === "flat" ? parts.join("/") : "",
      delta: file.conflict ? null : { add: stats.add ? grouped(stats.add) : "", del: stats.del ? grouped(stats.del) : "" },
      actions,
      selected: open?.path === file.path && open?.scope === scope,
      // The status in words, the other half of a partly staged file, binary; the path only if
      // the row cuts it off. Never the name or +N −N again: the row shows them.
      tip: tipFor([
        cutOff(name, this.view === "flat" ? parts.join("/") : "", this.rowRoom(depth, this.view === "flat")) ? file.path : "",
        capital(file.conflict ? file.conflictKind : GIT_WORD[status]),
        scope === "unstaged" && file.staged ? `Also staged +${grouped(file.stagedStats.add)} −${grouped(file.stagedStats.del)}` : "",
        scope === "staged" && file.unstaged ? `Also unstaged +${grouped(file.unstagedStats.add)} −${grouped(file.unstagedStats.del)}` : "",
        file.binary ? "Binary file" : "",
      ]),
      ringed: this.ringed(key),
      onHover: this.hover(key),
      onMenu: (cx) => this.openRowMenu(file, scope, key, cx),
      onClick: (cx) => {
        this.point(key);
        this.pick(file, scope, cx);
      },
    });
  },

  // The pixels a row has for its name and folder: the panel less the insets, indent, chevron
  // slot, icon, gaps and the 64px +N −N slot (§2.9).
  rowRoom(depth, flat) {
    const width = this.panelWidth ?? 360;
    const chevron = flat ? 0 : P.chevron + P.treeGap;
    return width - 2 * (P.inset + P.rowPx) - depth * P.indent - chevron - P.fileIcon - 3 * P.treeGap - P.delta;
  },

  ringed(key) {
    return key === this.cursor && !this.typing && this.focus.is_focused();
  },

  // ── History (§4.6a) ───────────────────────────────────────────────────────

  // Commits and, when one is chosen, its details: groups that fold, in a resizable split.
  renderHistory() {
    const t = theme();
    const commitsOpen = !this.collapsed.has("h-commits");
    const detailOpen = !this.collapsed.has("h-detail");
    const more = this.commitsDone ? "" : "+";
    const commitsTitle = GroupTitle({
      id: "h-commits",
      open: commitsOpen,
      title: [div().flex_none().child("Commits")],
      count: this.commits.length ? `${grouped(this.commits.length)}${more}` : null,
      onClick: (cx) => this.toggleGroup("h-commits", cx),
    });
    const commitsBody = this.historyView === "graph" ? this.renderGraph() : this.renderCommitList();
    const commit = this.selectedCommit;
    const detailTitle =
      commit &&
      GroupTitle({
        id: "h-detail",
        open: detailOpen,
        // A fixed title; which commit it is shows as the selected row above (§4.5b B1). The
        // title row holds only what acts on the block itself (L16).
        title: [div().flex_none().child("Details")],
        hovered: this.hoverKey === "group:h-detail",
        onHover: this.hover("group:h-detail"),
        actions: [PaneButton({ id: "commit-close", icon: "x", label: "Close (Esc)", onClick: (cx) => this.closeCommit(cx) })],
        onClick: (cx) => this.toggleGroup("h-detail", cx),
      });
    const body = v_flex().id("history").flex_1().min_h(0);
    if (commitsOpen && commit && detailOpen) {
      const room = (this.panelHeight ?? 640) - P.header - P.list;
      const detail = Math.max(H.detailMin, Math.round(room * H.detailShare));
      return body.child(
        v_resizable("history:commits+detail")
          .flex_1()
          .min_h(0)
          .child(
            resizable_panel()
              .size_range(P.title + H.listRows * P.list)
              .child(v_flex().size_full().min_h(0).child(commitsTitle).child(commitsBody)),
          )
          .child(
            resizable_panel()
              .size(detail)
              .size_range(H.detailMin)
              .child(v_flex().size_full().min_h(0).child(detailTitle).child(this.renderCommitBody())),
          ),
      );
    }
    return body
      .child(commitsTitle)
      .when(commitsOpen, (el) => el.child(commitsBody))
      .when(Boolean(commit), (el) => el.child(detailTitle).when(detailOpen, (el) => el.child(this.renderCommitBody())));
  },

  // The graph: a virtual list that reads the next page when it nears the end.
  renderGraph() {
    const t = theme();
    const list = div().id("graph").flex_1().min_h(0).relative().px(P.inset);
    if (this.commitsError) return list.child(Message(this.commitsError, true));
    if (!this.commits.length) return this.commitsLoading || !this.root ? list.child(Message("Loading history…")) : list;
    const commits = this.commits;
    // The last item is the loading row while there's more, else panel.end of space (§4.5b B4).
    const count = commits.length + 1;
    const sizes = this.commitsDone ? [...commits.map(() => P.list), P.end] : P.list;
    return list
      .child(
        v_virtual_list("graph-rows", count, sizes, (i) => commits[i]?.hash ?? (this.commitsDone ? "end" : "loading"), (range) => {
          if (!this.commitsDone && range.end >= commits.length - H.loadAhead) this.wantMore = true;
          const rows = [];
          for (let i = range.start; i < range.end; i++)
            rows.push(
              i < commits.length
                ? this.graphRow(i)
                : this.commitsDone
                  ? div().id("graph-end").w_full().h(P.end)
                  : h_flex()
                    .id("graph-loading")
                    .w_full()
                    .h(P.list)
                    .px(P.rowPx)
                    .items_center()
                    .text_size(P.text)
                    .text_color(t.muted)
                    .child("Loading…"),
            );
          return rows;
        })
          .size_full()
          // A virtual list's rows can't hold handlers (gpui-kit.d.ts): the list takes the click.
          .on_item_click((key, cx) => {
            const commit = this.commits.find((c) => c.hash === key);
            if (commit) this.openCommit(commit, cx);
          }),
      )
      .child(Scrollbar.vertical("graph-rows").viewport_from_layout().absolute().inset_0());
  },

  // Whether a graph row cuts its subject off: what's left after the lanes, the labels (their
  // natural width, at most labelMax), the time and the hash (§4.6a's order).
  subjectCut(commit, row, shown) {
    const width = this.panelWidth ?? 360;
    const labels = shown.reduce((n, ref) => n + Math.min(H.labelMax, ref.name.length * 6 + 2 * H.labelPx + 2) + P.gap, 0);
    const room = width - 2 * (P.inset + P.rowPx) - this.graph.width * H.lane - labels - H.time - 7 * MONO_11 - 3 * P.gap;
    return commit.subject.length * 7 > room;
  },

  graphRow(i) {
    const t = theme();
    const commit = this.commits[i];
    const row = this.graph.rows[i];
    const colors = laneColors(t);
    const color = (lane) => colors[lane % colors.length];
    const head = commit.refs.some((r) => r.kind === "current" || r.kind === "head");
    const shown = commit.refs.slice(0, H.labels);
    const hidden = commit.refs.slice(H.labels);
    const mono = (text) => div().flex_none().text_size(P.secondary).font_family(codeFont()).text_color(t.muted).child(text);
    return h_flex()
      .id(`graph-${commit.hash}`)
      .w_full()
      .h(P.list)
      .flex_none()
      .px(P.rowPx)
      .gap(P.gap)
      .items_center()
      .rounded(P.radius)
      .cursor_pointer()
      .when(this.selectedCommit?.hash === commit.hash, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      // The author and the full time aren't on the row; the subject only when it's cut off (L20).
      .tooltip(`${this.subjectCut(commit, row, shown) ? `${commit.subject}\n` : ""}${commit.author} · ${stamp(commit.at)}`)
      .child(LaneCell({ row, lanes: this.graph.width, color, ring: head || commit.parents.length > 1 }))
      .child(div().flex_1().min_w(H.subjectMin).truncate().text_size(P.body).child(commit.subject))
      .when(shown.length > 0, (el) =>
        el.child(
          h_flex()
            .flex_shrink_1()
            .min_w(H.labelMin)
            .gap(P.gap)
            .overflow_hidden()
            .children(shown.map((ref) => RefLabel({ ...ref, color: color(row.lane) })))
            .when(hidden.length > 0, (el) =>
              el.child(
                RefLabel({ kind: "more", name: `+${hidden.length}` })
                  .flex_none()
                  .tooltip(hidden.map((ref) => ref.name).join(", ")),
              ),
            ),
        ),
      )
      .child(mono(shortAgo(commit.at)).w(H.time).text_right())
      .child(mono(commit.short));
  },

  // List: the commits grouped by where they are (local, remote, default branch), as before.
  renderCommitList() {
    const list = v_flex().id("commit-list").flex_1().min_h(0).overflow_y_scrollbar().pb(P.end);
    if (this.commitsError) return list.child(Message(this.commitsError, true));
    if (!this.commits.length) return this.commitsLoading || !this.root ? list.child(Message("Loading history…")) : list;
    const remote = this.committed;
    const more = this.commitsDone ? "" : "+";
    const local = this.branch ?? "HEAD";
    if (!remote) {
      this.addCommits(list, {
        scope: "branch",
        label: local,
        count: `${this.commits.length}${more}`,
        commits: this.commits,
        withMore: true,
      });
      return list;
    }
    const notPulled = (n) => (n ? `${n} not pulled` : null);
    const detail = (...parts) => parts.filter(Boolean).join(" · ");
    const head = this.remoteHead;
    const pushed = this.commits.filter((c) => !remote.unpushed.has(c.hash));
    this.addCommits(list, {
      scope: "branch",
      label: local,
      count: remote.unpushed.size,
      commits: this.commits.filter((c) => remote.unpushed.has(c.hash)),
    });
    if (head && head.target !== remote.name) {
      // A feature branch: what the remote branch has, then the default branch under it.
      const onBranch = pushed.filter((c) => head.ahead.has(c.hash));
      const onDefault = pushed.filter((c) => !head.ahead.has(c.hash));
      this.addCommits(list, { scope: "remote", label: remote.name, count: onBranch.length, commits: onBranch, detail: notPulled(this.behind) });
      this.addCommits(list, {
        scope: "default",
        label: head.name,
        count: `${onDefault.length}${more}`,
        commits: onDefault,
        detail: detail(head.target, notPulled(head.behind)),
        withMore: true,
      });
      return list;
    }
    this.addCommits(list, {
      scope: "remote",
      label: remote.name,
      count: `${pushed.length}${more}`,
      commits: pushed,
      detail: detail(head?.name, notPulled(this.behind)),
      withMore: true,
    });
    return list;
  },

  addCommits(list, { scope, label, count, commits, detail, withMore = false }) {
    if (!commits.length) return;
    const t = theme();
    const collapsed = this.collapsed.has(scope);
    list.child(
      GroupTitle({
        id: `group-${scope}`,
        open: !collapsed,
        title: [
          div().flex_none().font_family(codeFont()).child(label),
          ...(detail ? [div().min_w(0).truncate().font_normal().text_color(t.muted).child(detail)] : []),
        ],
        count,
        onClick: (cx) => this.toggleGroup(scope, cx),
      }),
    );
    if (collapsed) return;
    const rows = v_flex().px(P.inset).children(commits.map((commit) => this.commitRow(commit)));
    if (withMore && !this.commitsDone)
      rows.child(
        h_flex()
          .id("commits-more")
          .h(P.list)
          .flex_none()
          .px(P.rowPx)
          .justify_center()
          .items_center()
          .rounded(P.radius)
          .cursor_pointer()
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.loadCommits(cx, true))
          .text_size(P.text)
          .text_color(t.muted)
          .child(this.commitsLoading ? "Loading…" : "Load more"),
      );
    list.child(rows);
  },

  commitRow(commit) {
    const t = theme();
    return h_flex()
      .id(`commit-${commit.hash}`)
      .flex_none()
      .px(P.rowPx)
      .py(6)
      .gap(P.gap)
      .items_center()
      .rounded(P.radius)
      .cursor_pointer()
      .when(this.selectedCommit?.hash === commit.hash, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.openCommit(commit, cx))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(1)
          .child(div().truncate().text_size(P.body).child(commit.subject))
          .child(
            div().truncate().text_size(P.secondary).text_color(t.muted).child(`${commit.author} · ${timeAgo(commit.at)}`),
          ),
      )
      .child(div().flex_none().text_size(P.secondary).text_color(t.muted).font_family(codeFont()).child(commit.short));
  },

  // Only a commit the remote has can be opened there.
  commitUrl(commit) {
    if (!this.repo || this.committed?.unpushed.has(commit.hash)) return null;
    return `https://github.com/${this.repo}/commit/${commit.hash}`;
  },

  // A commit's details (§4.5b B1): the message, the author, time, hash and refs, then the files.
  // One scroll region. Two vertical lines: icons at x 10, text at x 30.
  renderCommitBody() {
    const t = theme();
    const commit = this.selectedCommit;
    const url = this.commitUrl(commit);
    const meta = (icon, content, tip) =>
      h_flex()
        .min_h(P.line)
        .px(P.px)
        .gap(P.treeGap)
        .items_center()
        .when(Boolean(tip), (el) => el.tooltip(tip))
        .child(UiIcon(icon, P.fileIcon).text_color(t.muted))
        .child(content);
    const text = (value, mono = false, color = t.foreground) =>
      div().min_w(0).truncate().text_size(P.text).text_color(color).when(mono, (el) => el.font_family(codeFont())).child(value);
    const committedBy =
      commit.committer && commit.committer !== commit.author
        ? `\nCommitted by ${commit.committer} · ${stamp(commit.committedAt)}`
        : "";
    return v_flex()
      // Per commit, so picking another starts at the top.
      .id(`commit-detail-${commit.hash}`)
      .flex_1()
      .min_h(0)
      .overflow_y_scrollbar()
      .child(
        // Subject and body in one selectable text, so one drag copies both; the subject bold, both
        // in foreground (hierarchy by weight, as GitHub Desktop does).
        div()
          .px(P.px)
          .pt(8)
          .child(
            TextView.markdown(`commit-message-${commit.hash}`, messageMarkdown(commit))
              .selectable(true)
              .text_size(P.body)
              .line_height(P.line / P.body)
              .text_color(t.foreground),
          ),
      )
      .child(
        v_flex()
          .pt(P.section)
          .child(meta("user", text(commit.author), `${commit.author} <${commit.email}>${committedBy}`))
          .child(meta("clock", text(`${stamp(commit.at)} · ${timeAgo(commit.at)}`, true, t.muted), stampFull(commit.at)))
          .child(
            meta(
              "hash",
              h_flex()
                .gap(4)
                .items_center()
                .child(
                  // Selectable too, so the hash can be copied without the button.
                  TextView.markdown(`commit-hash-${commit.hash}`, commit.short)
                    .selectable(true)
                    .text_size(P.text)
                    .font_family(codeFont())
                    .text_color(t.foreground),
                )
                .child(
                  h_flex()
                    .gap(P.groupGap)
                    .child(
                      PaneButton({
                        id: "commit-copy",
                        icon: "copy",
                        label: "Copy full hash",
                        onClick: (cx) => {
                          cx.write_to_clipboard(commit.hash);
                          notify({ title: "Copied", body: commit.hash, level: "info", timeout: 2000 });
                        },
                      }),
                    )
                    .when(Boolean(url), (el) =>
                      el.child(PaneButton({ id: "commit-open", icon: "arrow-square-out", label: "Open on GitHub", onClick: (cx) => cx.open_url(url) })),
                    ),
                ),
              commit.hash,
            ),
          )
          .when(commit.refs.length > 0, (el) =>
            el.child(
              meta(
                // Refs are bookmarks on a commit; `tag` already means "group by prefix" (design/icons.json).
                "bookmark-simple",
                h_flex()
                  .flex_1()
                  .min_w(0)
                  .flex_wrap()
                  .gap(4)
                  .py(2)
                  .children(commit.refs.map((ref) => RefLabel({ ...ref, color: t.foreground, full: true }))),
              ),
            ),
          ),
      )
      .child(div().mt(P.section).h(1).flex_none().bg(t.border))
      .child(this.renderCommitFiles())
      .child(div().h(P.end).flex_none());
  },

  renderCommitFiles() {
    const t = theme();
    const files = v_flex().id("commit-files").flex_none();
    const title = (children) =>
      h_flex().h(P.title).px(P.px).items_center().text_size(P.titleText).font_medium().text_color(t.muted).children(children);
    if (this.commitFilesError)
      return files.child(
        v_flex()
          .px(P.px)
          .py(4)
          .gap(6)
          .child(div().text_size(P.titleText).text_color(t.ansi1).whitespace_normal().child(`Could not read the files: ${this.commitFilesError}`))
          .child(TextButton({ id: "commit-files-retry", label: "Retry", onClick: (cx) => this.loadCommitFiles(this.selectedCommit, cx) })),
      );
    // Git usually answers at once: nothing for the first 300ms, so Loading… doesn't flash.
    if (this.commitFilesLoading) return files.when(Boolean(this.commitFilesSlow), (el) => el.child(title([div().font_normal().child("Loading files…")])));
    const list = this.commitFiles;
    const merge = this.selectedCommit?.parents.length > 1;
    if (!list.length) return files.child(title([div().child("No files changed")]));
    const add = list.reduce((n, f) => n + f.add, 0);
    const del = list.reduce((n, f) => n + f.del, 0);
    const limit = this.settings.limits.files;
    return files
      .child(
        title([
          div().flex_1().child(`${grouped(list.length)} ${list.length === 1 ? "file" : "files"} changed`),
          h_flex()
            .w(P.delta)
            .flex_none()
            .font_family(codeFont())
            .child(div().w(P.half).text_right().text_color(t.ansi2).child(add ? `+${grouped(add)}` : ""))
            .child(div().w(P.half).text_right().text_color(t.ansi1).child(del ? `−${grouped(del)}` : "")),
        ]).when(merge, (el) => el.tooltip("Compared with the first parent")),
      )
      .child(v_flex().px(P.inset).children(list.slice(0, limit).map((file) => this.commitFileRow(file))))
      .when(list.length > limit, (el) =>
        el.child(
          div()
            .px(P.px)
            .py(4)
            .text_size(P.secondary)
            .text_color(t.muted)
            .child(`Showing the first ${grouped(limit)} of ${grouped(list.length)} files.`),
        ),
      );
  },

  // A file the commit changed: Changes' flat row (no chevron slot, so its icon lines up with the
  // metadata icons); hovering offers Preview of the file as it is now.
  commitFileRow(file) {
    const t = theme();
    const parts = file.path.split("/");
    const name = parts.pop();
    const key = `commit-file:${file.path}`;
    const open = shared("awsome-changes.selection");
    return TreeRow({
      id: key,
      flat: true,
      icon: FileIcon({ icons: this.fileIcons, path: `${this.root}/${file.path}`, color: t.muted, t, size: P.fileIcon }),
      name,
      color: gitColor(t, file.status),
      strike: file.status === "D",
      dir: parts.join("/"),
      delta: file.binary ? { add: "", del: "" } : { add: file.add ? grouped(file.add) : "", del: file.del ? grouped(file.del) : "" },
      actions:
        this.hoverKey === key
          ? [PaneButton({ id: `preview-${key}`, icon: "eye", label: "Preview", onClick: (cx) => this.openFile(file.path, cx) })]
          : null,
      selected: open?.path === file.path && open?.scope === "commit",
      // The status in words, where a rename came from, binary; the path only if cut off.
      tip: tipFor([
        cutOff(name, parts.join("/"), this.rowRoom(0, true)) ? file.path : "",
        capital(GIT_WORD[file.status]),
        file.from ? `Renamed from ${file.from}` : "",
        file.binary ? "Binary file" : "",
      ]),
      onHover: this.hover(key),
      onClick: (cx) => this.pick(file, "commit", cx),
    });
  },

  // The file as it is now, in the layout's preview column, the way Files previews one (§4.4a).
  openFile(path, cx) {
    const space = spaces().find((s) => s.active)?.id;
    const file = { path: `${this.root}/${path}`, root: this.root, on: this.on ?? null };
    setShared("awsome-viewer.slot", { space, file });
    run("layout.show", { id: "preview" });
    cx.notify();
  },
};
