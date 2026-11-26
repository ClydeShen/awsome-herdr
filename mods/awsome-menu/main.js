// Awsome Menu: the space menu (right-click a space in the sidebar) and the tab bar's + menu.
// The menus (docs/REQUIREMENTS.md §4.2.3, §4.2.6):
//   props { scope: "space", space }    Terminals, Agents, worktree, then the space's own actions
//   props { scope: "plus", space }     Terminals, Agents, worktree, for the shown space
//   props { scope: "spaces", spaces }  several selected spaces: Appearance, Group, Copy path, Close
//   props { scope: "group", group }    a group's header: Rename, Appearance, Collapse, Ungroup
//   props { scope: "statusline", item, title, choices }   a status-bar item's choices (awsome-statusline)
// and what their items open (not menus, so Esc or a click outside is the way back):
//   props { scope: "looks", spaces | groups }   the Appearance picker (picker.js)
//   props { scope: "close", spaces }   the confirmation for closing several spaces (confirm.js)
// Opened by awsome-sidebar and awsome-tabs as a frameless popup; the last size it measured is
// kept in shared("awsome-menu.size") so the next popup opens at the right size.

import { View, div } from "gpui-kit";
import { spaces, panes, knownAgents, run, openOverlay, closeOverlay, props, window, exec, notify, shared, setShared } from "herdr";
import { menuView, menuFrame, menuNav, keyFor, tidy } from "./menu.js";
import { pickerView, pickerFrame, pickerCells, pickerNav } from "./picker.js";
import { confirmView, confirmHeight, confirmKey, CONFIRM } from "./confirm.js";
import { loadSettings } from "./settings.js";

const NAME = "awsome-menu";
const UI = (name) => `mods/awsome-icons/ui/${name}.svg`;
const SHELL = "icons/shell.svg";
const MONO = "JetBrains Mono";
const BACKSLASH = String.fromCharCode(92);
const DEFAULT_SETTINGS = { terminals: { hide: [], extra: [] } };
// The scopes that are menus; the others are what a menu item opens (scripts/ui-check.py C10).
const MENUS = ["space", "plus", "spaces", "group", "statusline"];
// A space's look (color and icon), kept by folder and machine so it outlives the space
// (awsome-sidebar draws it). The colors are the names Herdr's space.colors uses.
const LOOKS = "awsome-sidebar.looks";
const lookKey = (s) => `${s.machine ?? ""}|${s.folder ?? ""}`;
// The groups of the sidebar's spaces (awsome-sidebar/views/groups.js draws and edits them):
// { list: [{ id, name, color, folded, machine }], of: { "machine|folder": group id } }.
const GROUPS = "awsome-sidebar.groups";
const RENAME = "awsome-sidebar.rename";
const groupData = () => {
  const g = shared(GROUPS) ?? {};
  return { list: Array.isArray(g.list) ? g.list : [], of: g.of && typeof g.of === "object" ? g.of : {} };
};
// A group with no member left goes away.
const saveGroups = (d) => {
  const used = new Set(Object.values(d.of));
  setShared(GROUPS, { list: d.list.filter((g) => used.has(g.id)), of: d.of });
};

// Where a space is now: its first terminal's live folder, else where it was made (as Herdr's menu does).
function place(s) {
  const tabs = new Set((s?.tabs ?? []).map((t) => t.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s?.folder || "";
}

// The shells on this machine, in a fixed order. Windows: where.exe and wsl -l -q (UTF-16);
// macOS and Linux: /etc/shells. The default one starts with a plain tab.new, as Herdr's + does.
// On another machine (`on`), its own shells are read with POSIX commands; when that fails, the one
// entry left is its default terminal, which that machine chooses.
async function discoverTerminals(on) {
  const platform = window()?.platform;
  const out = [];
  if (!on && platform === "windows") {
    const r = await exec("where.exe", ["pwsh", "powershell", "cmd", "bash"], { on, timeout: 8000 }).catch(() => null);
    const found = String(r?.stdout ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const has = (exe) => found.find((p) => p.toLowerCase().endsWith(BACKSLASH + exe));
    if (has("pwsh.exe")) out.push({ id: "pwsh", label: "PowerShell 7", argv: ["pwsh"] });
    if (has("powershell.exe")) out.push({ id: "powershell", label: "Windows PowerShell", argv: ["powershell"] });
    if (has("cmd.exe")) out.push({ id: "cmd", label: "Command Prompt", argv: ["cmd"] });
    const gitBash = found.find((p) => /git/i.test(p) && p.toLowerCase().endsWith(BACKSLASH + "bash.exe"));
    if (gitBash) out.push({ id: "gitbash", label: "Git Bash", argv: [gitBash, "--login", "-i"] });
    const w = await exec("wsl.exe", ["-l", "-q"], { on, timeout: 8000 }).catch(() => null);
    const distros = String(w?.stdout ?? "").replace(/\u0000/g, "").split(/\r?\n/).map((l) => l.trim())
      .filter((d) => d && !/^docker-desktop/i.test(d));
    for (const d of distros) out.push({ id: `wsl-${d}`, label: d, argv: ["wsl.exe", "-d", d], tag: "WSL" });
    if (out[0]) out[0].default = true;
  } else {
    const r = await exec("cat", ["/etc/shells"], { on, timeout: 5000 }).catch(() => null);
    const sh = await exec("sh", ["-c", "printf %s \"$SHELL\""], { on, timeout: 5000 }).catch(() => null);
    const mine = String(sh?.stdout ?? "").trim();
    const seen = new Set();
    for (const path of String(r?.stdout ?? "").split(/\r?\n/).map((l) => l.trim())) {
      if (!path.startsWith("/")) continue;
      const base = path.split("/").pop();
      if (seen.has(base)) continue;
      seen.add(base);
      out.push({ id: base, label: base, argv: [path], default: path === mine });
    }
    out.sort((a, b) => Number(Boolean(b.default)) - Number(Boolean(a.default)));
    if (!out.length) out.push({ id: "default", label: "Default terminal", default: true });
  }
  return out;
}

export default class AwsomeMenu extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.nav = { at: -1, open: null, subAt: -1 };
    // Cached per machine, so a remote space never shows this machine's terminals or agents.
    const machineKey = this.space()?.machine ?? "local";
    const cache = (shared(`${NAME}.cache`) ?? {})[machineKey] ?? {};
    this.terminals = cache.terminals ?? null;
    this.agents = cache.agents ?? null;
    this.git = null;
    this.settings = DEFAULT_SETTINGS;
    const s = this.space();
    cx.spawn(async (cx) => {
      try { this.settings = (await loadSettings(NAME, DEFAULT_SETTINGS)).settings; } catch {}
      cx.notify();
      const [terminals, agents, git] = await Promise.all([
        discoverTerminals(s?.machine ?? undefined).catch(() => this.terminals ?? []),
        knownAgents({ on: s?.machine ?? null }).catch(() => this.agents ?? []),
        exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd: place(s), on: s?.machine ?? undefined, timeout: 5000 }).then((r) => r.code === 0).catch(() => false),
      ]);
      this.terminals = terminals;
      this.agents = agents;
      this.git = git;
      setShared(`${NAME}.cache`, { ...(shared(`${NAME}.cache`) ?? {}), [machineKey]: { terminals, agents: agents.map(({ key, name, icon, tint, run: argv, installed }) => ({ key, name, icon, tint, run: argv, installed })) } });
      cx.notify();
    });
  }

  space() {
    const id = props()?.space;
    return spaces().find((s) => s.id === id) ?? spaces().find((s) => s.active) ?? null;
  }

  close() { closeOverlay(props().overlay); }

  scope() { const s = props()?.scope; return [...MENUS, "looks", "close"].includes(s) ? s : "plus"; }

  // The spaces a "spaces", "looks" or "close" popup is about, in Herdr's order.
  chosen() {
    const ids = new Set(props()?.spaces ?? (props()?.space ? [props().space] : []));
    return spaces().filter((s) => ids.has(s.id));
  }

  // Opens the Appearance picker for these spaces where the pointer is. A space in a group has the
  // group's color, so it is offered the icons only.
  openLooks(list) {
    const of = groupData().of;
    const parts = { colors: list.some((s) => !of[lookKey(s)]), icons: true };
    openOverlay({ mod: NAME, kind: "popup", frame: "none", at: "pointer", ...pickerFrame(parts), props: { scope: "looks", spaces: list.map((s) => s.id) } });
  }

  // The same for a group: its color only.
  openGroupLooks(id) {
    openOverlay({ mod: NAME, kind: "popup", frame: "none", at: "pointer", ...pickerFrame({ colors: true, icons: false }), props: { scope: "looks", groups: [id] } });
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  // The Group submenu: the groups on these spaces' machine (the current one ticked), a new one,
  // and the way out. Spaces on different machines can't share a group.
  groupEntry(list) {
    const d = groupData();
    const machine = list[0]?.machine ?? null;
    const mixed = list.some((s) => (s.machine ?? null) !== machine);
    const mine = d.list.filter((g) => (g.machine ?? null) === machine);
    const now = new Set(list.map((s) => d.of[lookKey(s)] ?? null));
    return { id: "group", label: "Group", icon: UI("folder-simple"), disabled: mixed, reason: "The spaces are on different machines",
      submenu: tidy([
        ...mine.map((g) => ({ id: `g-${g.id}`, label: g.name || "Untitled", icon: now.size === 1 && now.has(g.id) ? UI("check") : undefined, run: () => this.joinGroup(list, g.id) })),
        mine.length ? "-" : null,
        { id: "g-new", label: "New group\u2026", icon: UI("plus"), run: () => this.newGroup(list, machine) },
        list.some((s) => d.of[lookKey(s)]) ? { id: "g-out", label: "Remove from group", icon: UI("x"), run: () => this.joinGroup(list, null) } : null,
      ]) };
  }

  // Puts the spaces in a group, or with null takes them out of any.
  joinGroup(list, id) {
    const d = groupData();
    const of = { ...d.of };
    for (const s of list) { if (id) of[lookKey(s)] = id; else delete of[lookKey(s)]; }
    saveGroups({ list: d.list, of });
  }

  // A group of its own with all of them in it. Its color is one no group has yet, and its name is
  // asked for in the sidebar, in place.
  newGroup(list, machine) {
    const d = groupData();
    const names = Object.keys(shared("awsome-sidebar.hues") ?? {});
    const uses = (c) => d.list.filter((g) => g.color === c).length;
    const color = names.length ? names.reduce((best, c) => (uses(c) < uses(best) ? c : best)) : null;
    const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const of = { ...d.of };
    for (const s of list) of[lookKey(s)] = id;
    saveGroups({ list: [...d.list, { id, name: "", color, folded: false, machine }], of });
    setShared(RENAME, id);
  }

  // A group header's menu.
  groupEntries() {
    const g = groupData().list.find((x) => x.id === props()?.group);
    if (!g) return [];
    return tidy([
      { id: "rename", label: "Rename", icon: UI("pencil-simple"), run: () => setShared(RENAME, g.id) },
      { id: "looks", label: "Appearance\u2026", icon: UI("paint-brush"), run: () => this.openGroupLooks(g.id) },
      { id: "fold", label: g.folded ? "Expand" : "Collapse", icon: UI(g.folded ? "caret-down" : "arrows-in-line-vertical"),
        run: () => { const d = groupData(); setShared(GROUPS, { ...d, list: d.list.map((x) => (x.id === g.id ? { ...x, folded: !g.folded } : x)) }); } },
      "-",
      { id: "ungroup", label: "Ungroup", icon: UI("x"),
        run: () => { const d = groupData(); saveGroups({ list: d.list, of: Object.fromEntries(Object.entries(d.of).filter(([, id]) => id !== g.id)) }); } },
    ]);
  }

  // Applies a pick to every chosen space; picking the current icon again takes it away.
  pick(kind, value) {
    const gs = props()?.groups;
    if (gs?.length) {
      const d = groupData();
      setShared(GROUPS, { ...d, list: d.list.map((g) => (gs.includes(g.id) ? { ...g, color: value } : g)) });
      return;
    }
    const looks = { ...(shared(LOOKS) ?? {}) };
    const list = this.chosen();
    const current = this.current(list);
    const colors = { ...(shared("space.colors") ?? {}) };
    for (const s of list) {
      const k = lookKey(s), was = looks[k] ?? {};
      const next = kind === "color" ? { ...was, color: value } : { ...was, icon: value === current.icon ? null : value };
      if (!next.color && !next.icon) delete looks[k]; else looks[k] = next;
      if (kind === "color" && value) colors[s.id] = value;
    }
    setShared(LOOKS, looks);
    if (kind === "color") setShared("space.colors", colors);
  }

  // The color and icon all chosen spaces share (null where they differ or have none).
  current(list) {
    const gs = props()?.groups;
    if (gs?.length) return { color: groupData().list.find((g) => g.id === gs[0])?.color ?? null, icon: null };
    const looks = shared(LOOKS) ?? {};
    const all = list.map((s) => looks[lookKey(s)] ?? {});
    const same = (f) => (all.length && all.every((l) => (l[f] ?? null) === (all[0][f] ?? null)) ? all[0][f] ?? null : null);
    return { color: same("color"), icon: same("icon") };
  }

  // Several spaces' menu: what applies to all of them at once.
  manyEntries() {
    const list = this.chosen();
    const paths = list.map(place).filter(Boolean);
    return tidy([
      { id: "looks", label: "Appearance\u2026", icon: UI("paint-brush"), run: () => this.openLooks(list) },
      this.groupEntry(list),
      { id: "copy", label: "Copy path", icon: UI("copy"), disabled: !paths.length, reason: "The spaces have no folders",
        run: (cx) => { cx.write_to_clipboard(paths.join(String.fromCharCode(10))); notify({ title: "Copied", body: `${paths.length} paths`, level: "info", timeout: 2000 }); } },
      "-",
      { id: "close", label: `Close ${list.length} spaces\u2026`, icon: UI("x"), danger: true,
        run: () => openOverlay({ mod: NAME, kind: "dialog", frame: "none", width: CONFIRM.width, height: confirmHeight(this.closeText(list)), props: { scope: "close", spaces: list.map((s) => s.id) } }) },
    ]);
  }

  // What the close confirmation says: the names, and how many agents are still at work.
  closeText(list) {
    const busy = list.flatMap((s) => s.tabs ?? []).filter((t) => t.status === "working" || t.status === "blocked").length;
    return { names: list.map((s) => s.name), note: busy ? `${busy} ${busy === 1 ? "agent is" : "agents are"} still working.` : null };
  }

  // A status-bar item's choices (awsome-statusline opens this). A choice's check mark says what is
  // on now; picking one writes it back to the bar's click.
  statusEntries() {
    const p = props();
    return tidy([
      { title: p.title },
      ...p.choices.map((c) => (c === "-" ? "-" : { id: c.id, label: c.label, icon: c.checked ? UI("check") : undefined,
        run: () => setShared("awsome-statusline.click", { item: p.item, choice: c.id, at: Date.now() }) })),
    ]);
  }

  entries() {
    const s = this.space(), sid = s?.id;
    const scope = this.scope();
    const mac = window()?.platform === "macos";
    const reveal = mac ? "Reveal in Finder" : window()?.platform === "windows" ? "Reveal in File Explorer" : "Open in file manager";
    const hide = new Set((this.settings.terminals.hide ?? []).map((n) => String(n).toLowerCase()));
    const extra = (this.settings.terminals.extra ?? []).map((line, i) => {
      const at = String(line).indexOf(":");
      const label = at > 0 ? String(line).slice(0, at).trim() : String(line).trim();
      const argv = (at > 0 ? String(line).slice(at + 1) : String(line)).trim().split(/\s+/).filter(Boolean);
      return { id: `extra-${i}`, label, argv };
    }).filter((t) => t.label && t.argv.length);
    const terms = [...(this.terminals ?? []), ...extra].filter((t) => !hide.has(t.label.toLowerCase()));
    const agents = this.agents ?? [];
    const folder = place(s);
    const say = (title) => (e) => notify({ title, body: String(e?.message ?? e), level: "error" });
    let n = 0;
    const agentEntry = (a) => {
      const digit = a.installed && n < 9 ? String(++n) : null;
      return { id: `a-${a.key}`, label: a.name, digit,
        image: a.icon && !a.tint ? a.icon : undefined, icon: a.icon && a.tint ? a.icon : undefined,
        keys: a.installed ? digit : "Not installed", disabled: !a.installed, reason: a.installed ? null : `${a.name} is not installed`,
        run: () => run("tab.new", { name: a.name, space: sid, argv: a.run }) };
    };
    return tidy([
      { title: "Terminals" },
      ...(this.terminals === null ? [{ id: "t-wait", label: "Looking for shells…", icon: SHELL, disabled: true }] : []),
      ...terms.map((t) => ({ id: `t-${t.id}`, label: t.label, icon: SHELL, keys: t.default ? "Default" : t.tag,
        run: () => run("tab.new", t.default ? { space: sid } : { name: t.label, space: sid, argv: t.argv }) })),
      "-",
      { title: "Agents" },
      ...(this.agents === null ? [{ id: "a-wait", label: "Checking installed agents…", disabled: true }] : []),
      ...agents.filter((a) => a.installed).map(agentEntry),
      ...(agents.some((a) => !a.installed) ? [{ id: "a-more", label: "More agents", icon: UI("dots-three"),
        submenu: [{ title: "Not installed" }, ...agents.filter((a) => !a.installed).map(agentEntry)] }] : []),
      "-",
      { id: "wt-new", label: "New worktree…", icon: UI("git-branch"), disabled: this.git !== true, reason: this.git === false ? "Not a Git repository" : "Checking Git…",
        run: () => openOverlay({ mod: "worktree", kind: "dialog", width: 460, height: 280, props: { space: sid, folder, action: "new" } }) },
      { id: "wt-open", label: "Open worktree…", icon: UI("tree-structure"), disabled: this.git !== true, reason: this.git === false ? "Not a Git repository" : "Checking Git…",
        run: () => openOverlay({ mod: "worktree", kind: "dialog", width: 560, height: 480, props: { space: sid, folder, action: "open" } }) },
      ...(scope === "space" ? [
        "-",
        { id: "rename", label: "Rename", icon: UI("pencil-simple"), keys: keyFor("space.rename", mac), run: () => run("space.rename", { id: sid }) },
        { id: "looks", label: "Appearance\u2026", icon: UI("paint-brush"), run: () => this.openLooks([s]) },
        this.groupEntry([s]),
        { id: "reveal", label: reveal, icon: UI("folder-open"), disabled: !folder || Boolean(s?.machine), reason: s?.machine ? "The space is on another machine" : "The space has no folder",
          run: () => revealFolder(folder).catch(say("Could not open the folder")) },
        { id: "copy", label: "Copy path", icon: UI("copy"), disabled: !folder, reason: "The space has no folder", run: (cx) => { cx.write_to_clipboard(folder); notify({ title: "Copied", body: folder, level: "info", timeout: 2000 }); } },
        "-",
        { id: "close", label: "Close space…", icon: UI("x"), danger: true, run: () => run("space.close", { id: sid }) },
      ] : []),
    ]);
  }

  render(cx) {
    const scope = this.scope();
    if (scope === "looks") return this.renderLooks();
    if (scope === "close") return this.renderClose();
    const entries = scope === "spaces" ? this.manyEntries() : scope === "group" ? this.groupEntries()
      : scope === "statusline" ? this.statusEntries() : this.entries();
    const size = menuFrame(entries);
    const known = shared(`${NAME}.size`) ?? {};
    if (known[scope]?.width !== size.width || known[scope]?.height !== size.height) setShared(`${NAME}.size`, { ...known, [scope]: size });
    const go = (e, cx) => { this.close(); e.run(cx); };
    const nav = this.nav;
    return div().size_full().track_focus(this.handle)
      .on_key_down((ev, cx) => {
        const digit = !nav.open && /^[1-9]$/.test(ev.key) ? entries.find((e) => e.digit === ev.key) : null;
        if (digit) { cx.stop_propagation(); go(digit, cx); return; }
        if (!menuNav(nav, entries, ev.key, (e) => go(e, cx), () => this.close())) return;
        cx.stop_propagation(); cx.notify();
      })
      .child(menuView({ id: NAME, entries, at: nav.at, run: go, mono: MONO, open: nav.open, subAt: nav.subAt,
        onOpen: (id, cx) => { if (nav.open !== id) { nav.open = id; nav.subAt = -1; cx.notify(); } },
        onDismiss: () => this.close(),
        onSize: (s) => setShared(`${NAME}.rendered`, { scope, width: Math.round(s.width), height: Math.round(s.height), expected: size, at: Date.now() }) }));
  }
}

Object.assign(AwsomeMenu.prototype, {
  renderLooks() {
    const hues = Object.entries(shared("awsome-sidebar.hues") ?? {});
    const cur = this.current(this.chosen());
    const of = groupData().of;
    const parts = props()?.groups ? { colors: true, icons: false } : { colors: this.chosen().some((s) => !of[lookKey(s)]), icons: true };
    const cells = pickerCells({ hues, ...parts });
    const nav = this.nav;
    const pick = (c) => this.pick(c.kind, c.value);
    return div().size_full().track_focus(this.handle)
      .on_key_down((ev, cx) => {
        if (!pickerNav(nav, cells, ev.key, pick, () => this.close())) return;
        cx.stop_propagation(); cx.notify();
      })
      .child(pickerView({ id: `${NAME}-looks`, hues, ...parts, color: cur.color, icon: cur.icon, at: nav.at,
        onPick: (kind, value) => this.pick(kind, value), onDismiss: () => this.close(),
        onSize: (s) => setShared(`${NAME}.rendered`, { scope: "looks", width: Math.round(s.width), height: Math.round(s.height), expected: pickerFrame(parts), at: Date.now() }) }));
  },

  renderClose() {
    const list = this.chosen();
    const text = this.closeText(list);
    const yes = () => { this.close(); for (const s of list) run("space.close", { id: s.id, confirmed: true }); };
    const size = { width: CONFIRM.width, height: confirmHeight(text) };
    return div().w(size.width).h(size.height).track_focus(this.handle)
      .on_size_change((s) => setShared(`${NAME}.rendered`, { scope: "close", width: Math.round(s.width), height: Math.round(s.height), expected: size, at: Date.now() }))
      .on_key_down((ev, cx) => { if (confirmKey(ev.key, yes, () => this.close())) cx.stop_propagation(); })
      .child(confirmView({ id: `${NAME}-close`, title: `Close ${list.length} spaces?`, ...text, action: "Close spaces", danger: true,
        onConfirm: yes, onCancel: () => this.close(), mono: MONO }));
  },
});

// The space's folder in the system file manager.
async function revealFolder(abs) {
  const platform = window()?.platform;
  if (platform === "macos") await exec("open", ["--", abs]);
  else if (platform === "windows") await exec("explorer.exe", [abs.split("/").join(BACKSLASH)]);
  else await exec("xdg-open", [abs]);
}

