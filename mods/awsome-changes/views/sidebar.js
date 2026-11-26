// The sidebar: its tabs, options menu, file groups and commit views.
import { div } from "gpui-kit";
import { v_flex, h_flex, v_virtual_list, Scrollbar, v_resizable, resizable_panel } from "gpui-base";
import { theme, shared, setShared, notify, spaces, run } from "herdr";
import { fileTree, timeAgo, shortAgo, stamp, grouped } from "../git/model.js";
import {
  TEXT,
  SPIN_MS,
  codeFont,
  FileIcon,
  Chevron,
  Panel,
  IconButton,
  TextButton,
  GroupHeader,
  Row,
  DiffStat,
  StatusLetter,
  Message,
  Menu,
  MenuOption,
  TextBox,
  SplitButton,
  SplitTrigger,
  HISTORY as H,
  PanelTabs,
  PanelTab,
  ToolButton,
  GroupTitle,
  LaneCell,
  RefLabel,
} from "./ui.js";

// The graph's lane colors, one hue each, blue first like the current branch's label (\4.6a).
const laneColors = (t) => [t.ansi4, t.ansi2, t.ansi5, t.ansi6, t.ansi3, t.ansi1];
const STATUS_COLOR = { A: "ansi2", D: "ansi1", R: "ansi6", C: "ansi6", U: "ansi5" };

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

  // ── Sidebar ───────────────────────────────────────────────────────────────

  render() {
    if (this.mode === "panel-key") return div();
    if (this.mode === "pane-header") return this.renderPaneHeader();
    if (this.mode === "diff") return this.renderDiff();
    return Panel({ id: "awsome-changes" })
      .on_size_change((size, cx) => {
        if (Math.abs(size.height - (this.panelHeight ?? 0)) > 4) {
          this.panelHeight = size.height;
          cx.notify();
        }
      })
      .track_focus(this.focus)
      .on_key_down((event, cx) => this.key(event, cx))
      .child(this.renderHeader())
      .child(this.tab === "commit" ? this.renderHistory() : this.renderChangesView());
  },

  // Esc closes a commit's details (\4.6a).
  key(event, cx) {
    if (event.key !== "escape" || !this.selectedCommit) return;
    cx.stop_propagation();
    this.closeCommit(cx);
  },

  // Only the two tabs: counts live in the groups and the Repositories rows (\4.6a).
  renderHeader() {
    const unpushed = this.committed?.unpushed.size;
    return PanelTabs([
      PanelTab({
        id: "tab-changes",
        icon: "mods/changes/changes.svg",
        label: "Changes",
        tip: this.total ? `Changes · ${grouped(this.total)} changed files` : "Changes",
        active: this.tab === "changes",
        onClick: (cx) => this.setTab("changes", cx),
      }),
      PanelTab({
        id: "tab-commit",
        icon: "mods/awsome-icons/ui/git-commit.svg",
        label: "History",
        tip: unpushed ? `History · ${grouped(unpushed)} not pushed` : "History",
        active: this.tab === "commit",
        onClick: (cx) => this.setTab("commit", cx),
      }),
    ]);
  },

  refreshButton() {
    return ToolButton({
      id: "refresh",
      icon: "arrows-clockwise",
      label: "Refresh",
      spinning: this.refreshSpinning,
      onClick: (cx) => this.refreshAll(cx),
    });
  },

  // The current repository's branch, as a group title: name, then how far it is from upstream.
  branchTitle() {
    const t = theme();
    const ahead = this.committed?.unpushed.size;
    const sync = [ahead ? `↑${ahead}` : "", this.behind ? `↓${this.behind}` : ""].filter(Boolean).join(" ");
    return [
      div().flex_none().font_family(codeFont()).text_color(t.foreground).child(this.branch ?? "HEAD"),
      ...(sync ? [div().flex_none().text_color(t.muted).child(sync)] : []),
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

  renderChangesView() {
    const tree = this.view === "tree";
    const split = this.diffLayout === "split";
    return v_flex()
      .flex_1()
      .min_h(0)
      .child(
        GroupTitle({
          id: "changes-title",
          icon: "git-branch",
          title: this.branchTitle(),
          divided: false,
          actions: [
            ToolButton({
              id: "view-tree",
              icon: "tree-structure",
              label: tree ? "Show as list" : "Show as tree",
              active: tree,
              onClick: (cx) => this.setView(tree ? "flat" : "tree", cx),
            }),
            ToolButton({
              id: "diff-split",
              icon: "columns",
              label: split ? "Show inline diff" : "Show side-by-side diff",
              active: split,
              onClick: (cx) => this.setDiffLayout(split ? "inline" : "split", cx),
            }),
            this.refreshButton(),
          ],
        }),
      )
      .child(this.renderChanges());
  },

  renderChanges() {
    const list = v_flex().id("changes-list").flex_1().min_h(0).overflow_y_scrollbar().p(6);
    if (this.error) return list.child(Message(this.error, true));
    const conflicts = this.files.filter((f) => f.conflict);
    const unstaged = this.files.filter((f) => f.unstaged && !f.conflict);
    const staged = this.files.filter((f) => f.staged);
    const committed = this.committed?.total ? this.committed : null;
    if (!conflicts.length && !unstaged.length && !staged.length && !committed)
      list.child(Message(this.loading || !this.root ? "Loading changes…" : "No changes"));
    this.groupsDrawn = 0;
    this.addGroup(list, "conflict", "Conflicts", conflicts);
    this.addGroup(list, "staged", "Staged", staged);
    this.addGroup(list, "unstaged", "Unstaged", unstaged);
    if (committed)
      this.addGroup(
        list,
        "committed",
        "Committed",
        committed.files,
        `not on ${committed.name}`,
        committed.total,
      );
    const limit = this.settings.limits.files;
    if (this.total > limit)
      list.child(Message(`Showing the first ${limit.toLocaleString()} changed files.`));
    return v_flex().id("changes").flex_1().min_h(0).child(list).child(this.renderCommitBox());
  },

  renderCommitBox() {
    const t = theme();
    const hint = this.commitBoxHint();
    return v_flex()
      .id("commit-box")
      .flex_none()
      .p(10)
      .gap(8)
      .border_t(1)
      .border_color(t.border)
      .when(Boolean(this.note), (el) =>
        el.child(
          div()
            .text_size(TEXT.small)
            .text_color(t.ansi1)
            .whitespace_normal()
            .child(this.note ?? ""),
        ),
      )
      .child(
        TextBox({
          id: "commit-message",
          state: this.input,
          focused: this.typing,
          label: "Commit message",
        }),
      )
      .child(this.renderCommitButton())
      .when(Boolean(hint), (el) =>
        el.child(
          div()
            .text_size(TEXT.caption)
            .text_color(this.commitMode === "amend" ? t.working : t.dim)
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
      icon: amend ? "amend" : "commit",
      label: this.commitButtonLabel(),
      enabled: this.canCommit(),
      onClick: (cx) => this.commit(cx),
      menu: this.renderCommitMenu(),
    });
  },

  renderCommitMenu() {
    const amend = this.commitMode === "amend";
    const choose = (mode) => (cx) => this.setCommitMode(mode, cx);
    const options = [
      MenuOption({
        id: "mode-commit",
        icon: "commit",
        label: "Commit",
        selected: !amend,
        onClick: choose("commit"),
      }),
    ];
    if (this.hasHead) {
      options.push(
        MenuOption({
          id: "mode-amend",
          icon: "amend",
          label: "Amend",
          selected: amend,
          onClick: choose("amend"),
        }),
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

  addGroup(list, scope, label, files, detail, count = files.length) {
    if (!files.length) return;
    const collapsed = this.collapsed.has(scope);
    const bulk = {
      unstaged: { action: "stage", icon: "plus", label: "Stage all" },
      staged: { action: "unstage", icon: "minus", label: "Unstage all" },
    }[scope];
    list.child(
      GroupHeader({
        id: `group-${scope}`,
        label,
        count,
        detail,
        danger: scope === "conflict",
        collapsed,
        divided: this.groupsDrawn++ > 0,
        action:
          bulk &&
          TextButton({
            id: `${bulk.action}-all`,
            icon: bulk.icon,
            label: bulk.label,
            onClick: (cx) => this.indexAction(bulk.action, null, cx),
          }),
        onClick: (cx) => this.toggleGroup(scope, cx),
      }),
    );
    if (collapsed) return;
    this.addRows(list, scope, files);
  },

  // A group's files, flat or nested as chosen in the options menu.
  addRows(list, scope, files) {
    if (this.view === "flat") {
      for (const file of files) list.child(this.fileRow(file, scope, 0));
      return;
    }
    const closed = new Set(
      [...this.closed]
        .filter((key) => key.startsWith(`${scope}:`))
        .map((key) => key.slice(scope.length + 1)),
    );
    for (const row of fileTree(files, closed))
      list.child(
        row.kind === "folder"
          ? this.folderRow(row, scope, closed.has(row.path))
          : this.fileRow(row.file, scope, row.depth),
      );
  },

  folderRow(row, scope, closed) {
    const t = theme();
    const key = `${scope}:${row.path}`;
    return Row({
      id: `folder-${key}`,
      depth: row.depth,
      stem: !closed,
      onClick: (cx) => {
        if (closed) this.closed.delete(key);
        else this.closed.add(key);
        cx.notify();
      },
    })
      .child(Chevron(!closed))
      .when(Boolean(this.fileIcons), (el) =>
        el.child(FileIcon({ icons: this.fileIcons, path: `${this.root}/${row.path}`, dir: true, open: !closed, t })),
      )
      .child(div().flex_1().min_w(0).truncate().child(row.name));
  },

  fileRow(file, scope, depth) {
    const t = theme();
    const parts = file.path.split("/");
    const name = parts.pop();
    const tree = this.view === "tree";
    const stats =
      scope === "staged" ? file.stagedStats : scope === "unstaged" ? file.unstagedStats : file;
    const status =
      scope === "staged"
        ? file.stagedStatus
        : scope === "unstaged"
          ? file.unstagedStatus
          : file.status;
    const open = shared("awsome-changes.selection");
    const row = Row({
      id: `file-${scope}-${file.path}`,
      depth,
      selected: open?.path === file.path && open?.scope === scope,
      onClick: (cx) => this.pick(file, scope, cx),
    }).child(FileIcon({ icons: this.fileIcons, path: `${this.root}/${file.path}`, color: t.muted, t }));
    if (tree) row.child(div().flex_1().min_w(0).truncate().child(name));
    else
      row.child(
        h_flex()
          .flex_1()
          .min_w(0)
          .gap(6)
          .items_center()
          .child(div().max_w(190).flex_none().truncate().child(name))
          .child(
            div()
              .flex_1()
              .min_w(0)
              .truncate()
              .text_size(TEXT.small)
              .text_color(t.dim)
              .child(parts.join("/")),
          ),
      );
    if (file.conflict)
      row.child(
        div().flex_none().text_size(TEXT.caption).text_color(t.ansi1).child(file.conflictKind),
      );
    else row.child(DiffStat(stats)).child(StatusLetter(status));
    if (scope === "unstaged")
      row.child(
        IconButton({
          id: `stage-${file.path}`,
          icon: "plus",
          label: "Stage",
          small: true,
          onClick: (cx) => this.indexAction("stage", file.path, cx),
        }),
      );
    if (scope === "staged")
      row.child(
        IconButton({
          id: `unstage-${file.path}`,
          icon: "minus",
          label: "Unstage",
          small: true,
          onClick: (cx) => this.indexAction("unstage", file.path, cx),
        }),
      );
    return row;
  },

  // Commits and, when one is chosen, its details: groups that fold, in a resizable split (\4.6a).
  renderHistory() {
    const commitsOpen = !this.collapsed.has("h-commits");
    const detailOpen = !this.collapsed.has("h-detail");
    const graph = this.historyView === "graph";
    const all = this.range === "all";
    const commitsTitle = GroupTitle({
      id: "h-commits",
      open: commitsOpen,
      title: this.branchTitle(),
      divided: false,
      onClick: (cx) => this.toggleGroup("h-commits", cx),
      actions: [
        ToolButton({
          id: "history-graph",
          icon: "git-merge",
          label: graph ? "Show list" : "Show graph",
          active: graph,
          onClick: (cx) => this.setHistoryView(graph ? "list" : "graph", cx),
        }),
        ...(graph
          ? [
              ToolButton({
                id: "history-all",
                icon: "git-fork",
                label: all ? "Show current branch" : "Show all branches",
                active: all,
                onClick: (cx) => this.setRange(all ? "current" : "all", cx),
              }),
            ]
          : []),
        this.refreshButton(),
      ],
    });
    const commitsBody = graph ? this.renderGraph() : this.renderCommitList();
    const commit = this.selectedCommit;
    const detailTitle =
      commit &&
      GroupTitle({
        id: "h-detail",
        open: detailOpen,
        title: [div().font_family(codeFont()).text_color(theme().foreground).child(commit.short)],
        onClick: (cx) => this.toggleGroup("h-detail", cx),
        actions: this.detailActions(commit),
      });
    const body = v_flex().id("history").flex_1().min_h(0);
    if (commitsOpen && commit && detailOpen) {
      const room = (this.panelHeight ?? 640) - H.header;
      const detail = Math.max(H.detailMin, Math.round(room * H.detailShare));
      return body.child(
        v_resizable("history:commits+detail")
          .flex_1()
          .min_h(0)
          .child(
            resizable_panel()
              .size_range(H.title + H.listRows * H.row)
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
      .when(Boolean(commit), (el) =>
        el.child(detailTitle).when(detailOpen, (el) => el.child(this.renderCommitBody())),
      );
  },

  detailActions(commit) {
    const url = this.commitUrl(commit);
    return [
      ToolButton({
        id: "commit-copy",
        icon: "copy",
        label: "Copy hash",
        onClick: (cx) => {
          cx.write_to_clipboard(commit.hash);
          notify({ title: "Copied", body: commit.hash, level: "info", timeout: 2000 });
        },
      }),
      ...(url
        ? [
            ToolButton({
              id: "commit-open",
              icon: "arrow-square-out",
              label: "Open on GitHub",
              onClick: (cx) => cx.open_url(url),
            }),
          ]
        : []),
      ToolButton({ id: "commit-close", icon: "x", label: "Close (Esc)", onClick: (cx) => this.closeCommit(cx) }),
    ];
  },

  // The graph: a virtual list that reads the next page when it nears the end (\4.6a).
  renderGraph() {
    const t = theme();
    const list = div().id("graph").flex_1().min_h(0).relative().px(H.inset);
    if (this.commitsError) return list.child(Message(this.commitsError, true));
    if (!this.commits.length)
      return list.child(Message(this.commitsLoading || !this.root ? "Loading history…" : "No commits yet"));
    const commits = this.commits;
    const count = commits.length + (this.commitsDone ? 0 : 1);
    return list
      .child(
        v_virtual_list("graph-rows", count, H.row, (i) => commits[i]?.hash ?? "loading", (range) => {
          if (!this.commitsDone && range.end >= commits.length - H.loadAhead) this.wantMore = true;
          const rows = [];
          for (let i = range.start; i < range.end; i++)
            rows.push(
              i < commits.length
                ? this.graphRow(i)
                : h_flex()
                    .id("graph-loading")
                    .w_full()
                    .h(H.row)
                    .px(H.px)
                    .items_center()
                    .text_size(TEXT.small)
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

  graphRow(i) {
    const t = theme();
    const commit = this.commits[i];
    const row = this.graph.rows[i];
    const colors = laneColors(t);
    const color = (lane) => colors[lane % colors.length];
    const head = commit.refs.some((r) => r.kind === "current" || r.kind === "head");
    const shown = commit.refs.slice(0, H.labels);
    const hidden = commit.refs.slice(H.labels);
    const mono = (text) =>
      div().flex_none().text_size(H.secondary).font_family(codeFont()).text_color(t.muted).child(text);
    return h_flex()
      .id(`graph-${commit.hash}`)
      .w_full()
      .h(H.row)
      .flex_none()
      .px(H.px)
      .gap(H.gap)
      .items_center()
      .rounded(H.radius)
      .cursor_pointer()
      .when(this.selectedCommit?.hash === commit.hash, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .tooltip(`${commit.subject}\n${commit.author} · ${stamp(commit.at)}`)
      .child(LaneCell({ row, lanes: this.graph.width, color, ring: head || commit.parents.length > 1 }))
      .child(div().flex_1().min_w(H.subjectMin).truncate().text_size(H.text).child(commit.subject))
      .when(shown.length > 0, (el) =>
        el.child(
          h_flex()
            .flex_shrink_1()
            .min_w(H.labelMin)
            .gap(H.gap)
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
    const list = v_flex().id("commit-list").flex_1().min_h(0).overflow_y_scrollbar().px(H.inset);
    if (this.commitsError) return list.child(Message(this.commitsError, true));
    if (!this.commits.length)
      return list.child(
        Message(this.commitsLoading || !this.root ? "Loading history…" : "No commits yet"),
      );
    this.groupsDrawn = 0;
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
      this.addCommits(list, {
        scope: "remote",
        label: remote.name,
        count: onBranch.length,
        commits: onBranch,
        detail: notPulled(this.behind),
      });
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
      GroupHeader({
        id: `group-${scope}`,
        label,
        count,
        detail,
        collapsed,
        divided: this.groupsDrawn++ > 0,
        onClick: (cx) => this.toggleGroup(scope, cx),
      }),
    );
    if (collapsed) return;
    for (const commit of commits) list.child(this.commitRow(commit));
    if (withMore && !this.commitsDone)
      list.child(
        Row({ id: "commits-more", onClick: (cx) => this.loadCommits(cx, true) })
          .justify_center()
          .text_size(TEXT.small)
          .text_color(t.muted)
          .child(this.commitsLoading ? "Loading…" : "Load more"),
      );
  },

  commitRow(commit) {
    const t = theme();
    return h_flex()
      .id(`commit-${commit.hash}`)
      .flex_none()
      .px(8)
      .py(6)
      .gap(8)
      .items_center()
      .rounded(7)
      .cursor_pointer()
      .when(this.selectedCommit?.hash === commit.hash, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.openCommit(commit, cx))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(1)
          .child(div().truncate().child(commit.subject))
          .child(
            div()
              .truncate()
              .text_size(TEXT.caption)
              .text_color(t.muted)
              .child(`${commit.author} · ${timeAgo(commit.at)}`),
          ),
      )
      .child(
        div()
          .flex_none()
          .text_size(TEXT.caption)
          .text_color(t.dim)
          .font_family(codeFont())
          .child(commit.short),
      );
  },

  // Only a commit the remote has can be opened there.
  commitUrl(commit) {
    if (!this.repo || this.committed?.unpushed.has(commit.hash)) return null;
    return `https://github.com/${this.repo}/commit/${commit.hash}`;
  },

  // A commit's details, under the commits: message, then the files it changed (\4.6a).
  renderCommitBody() {
    const t = theme();
    const commit = this.selectedCommit;
    return v_flex()
      .id("commit-detail")
      .flex_1()
      .min_h(0)
      .overflow_y_scrollbar()
      .child(
        v_flex()
          .flex_none()
          .px(H.inset + H.px)
          .py(8)
          .gap(4)
          .child(div().whitespace_normal().text_size(H.text).font_medium().child(commit.subject))
          .child(
            div().text_size(H.secondary).text_color(t.muted).child(`${commit.author} · ${stamp(commit.at)}`),
          )
          .when(Boolean(commit.body), (el) =>
            el.child(div().pt(4).whitespace_normal().text_size(H.text).text_color(t.muted).child(commit.body)),
          ),
      )
      .child(this.renderCommitFiles());
  },

  renderCommitFiles() {
    const t = theme();
    const files = v_flex().id("commit-files").flex_none().px(H.inset);
    if (this.commitFilesError) return files.child(Message(this.commitFilesError, true));
    if (this.commitFilesLoading) return files.child(Message("Loading…"));
    const list = this.commitFiles;
    if (!list.length) return files;
    const add = list.reduce((n, f) => n + f.add, 0);
    const del = list.reduce((n, f) => n + f.del, 0);
    return files
      .child(
        h_flex()
          .h(H.row)
          .px(H.px)
          .gap(H.gap)
          .items_center()
          .text_size(H.titleText)
          .font_medium()
          .text_color(t.muted)
          .child(`${grouped(list.length)} ${list.length === 1 ? "file" : "files"}`)
          .when(add > 0, (el) => el.child(div().text_color(t.ansi2).child(`+${grouped(add)}`)))
          .when(del > 0, (el) => el.child(div().text_color(t.ansi1).child(`−${grouped(del)}`))),
      )
      .children(list.map((file) => this.commitFileRow(file)));
  },

  // A changed file: its status is the name's color (\2.4); hovering swaps the counts for Open file.
  commitFileRow(file) {
    const t = theme();
    const parts = file.path.split("/");
    const name = parts.pop();
    const hovered = this.hoveredFile === file.path;
    const open = shared("awsome-changes.selection");
    const color = t[STATUS_COLOR[file.status] ?? "ansi3"];
    const mono = (text, c) => div().flex_none().font_family(codeFont()).text_size(H.secondary).text_color(c).child(text);
    return h_flex()
      .id(`commit-file-${file.path}`)
      .h(H.row)
      .flex_none()
      .px(H.px)
      .gap(H.gap)
      .items_center()
      .rounded(H.radius)
      .cursor_pointer()
      .when(open?.path === file.path && open?.scope === "commit", (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_hover((over, cx) => {
        if (over) this.hoveredFile = file.path;
        else if (this.hoveredFile === file.path) this.hoveredFile = null;
        cx.notify();
      })
      .on_click((_e, cx) => this.pick(file, "commit", cx))
      .child(FileIcon({ icons: this.fileIcons, path: `${this.root}/${file.path}`, color: t.muted, t, size: H.icon }))
      .child(
        div()
          .flex_none()
          .max_w(190)
          .truncate()
          .text_size(H.text)
          .text_color(color)
          .when(file.status === "D", (el) => el.line_through())
          .child(name),
      )
      .child(div().flex_1().min_w(0).truncate().text_size(H.secondary).text_color(t.muted).child(parts.join("/")))
      .when(hovered, (el) =>
        el.child(
          ToolButton({
            id: `commit-file-open-${file.path}`,
            icon: "arrow-square-out",
            label: "Open file",
            onClick: (cx) => this.openFile(file.path, cx),
          }),
        ),
      )
      .when(!hovered && file.add > 0, (el) => el.child(mono(`+${grouped(file.add)}`, t.ansi2)))
      .when(!hovered && file.del > 0, (el) => el.child(mono(`−${grouped(file.del)}`, t.ansi1)));
  },

  // The file as it is now, in the layout's preview column, the way Files previews one (\4.4a).
  openFile(path, cx) {
    const space = spaces().find((s) => s.active)?.id;
    const file = { path: `${this.root}/${path}`, root: this.root, on: this.on ?? null };
    setShared("awsome-viewer.slot", { space, file });
    run("layout.show", { id: "preview" });
    cx.notify();
  },
};
