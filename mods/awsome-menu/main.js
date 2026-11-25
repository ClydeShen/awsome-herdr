// Awsome Menu: the space menu (right-click a space in the sidebar) and the tab bar's + menu.
// One menu, two scopes (docs/REQUIREMENTS.md §4.2.6):
//   props { scope: "space", space }  Terminals, Agents, worktree, then the space's own actions
//   props { scope: "plus", space }   Terminals, Agents, worktree, for the shown space
// Opened by awsome-sidebar and awsome-tabs as a frameless popup; the last size it measured is
// kept in shared("awsome-menu.size") so the next popup opens at the right size.

import { View, div } from "gpui-kit";
import { spaces, panes, knownAgents, run, openOverlay, closeOverlay, props, window, exec, notify, shared, setShared } from "herdr";
import { menuView, menuFrame, menuNav, keyFor, tidy } from "./menu.js";
import { loadSettings } from "./settings.js";

const NAME = "awsome-menu";
const UI = (name) => `mods/awsome-icons/ui/${name}.svg`;
const SHELL = "icons/shell.svg";
const MONO = "JetBrains Mono";
const BACKSLASH = String.fromCharCode(92);
const DEFAULT_SETTINGS = { terminals: { hide: [], extra: [] } };

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

  entries() {
    const s = this.space(), sid = s?.id;
    const scope = props()?.scope === "space" ? "space" : "plus";
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
        { id: "reveal", label: reveal, icon: UI("folder-open"), disabled: !folder || Boolean(s?.machine), reason: s?.machine ? "The space is on another machine" : "The space has no folder",
          run: () => revealFolder(folder).catch(say("Could not open the folder")) },
        { id: "copy", label: "Copy path", icon: UI("copy"), disabled: !folder, reason: "The space has no folder", run: (cx) => { cx.write_to_clipboard(folder); notify({ title: "Copied", body: folder, level: "info", timeout: 2000 }); } },
        "-",
        { id: "close", label: "Close space…", icon: UI("x"), danger: true, run: () => run("space.close", { id: sid }) },
      ] : []),
    ]);
  }

  render(cx) {
    const entries = this.entries();
    const size = menuFrame(entries);
    const scope = props()?.scope === "space" ? "space" : "plus";
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

// The space's folder in the system file manager.
async function revealFolder(abs) {
  const platform = window()?.platform;
  if (platform === "macos") await exec("open", ["--", abs]);
  else if (platform === "windows") await exec("explorer.exe", [abs.split("/").join(BACKSLASH)]);
  else await exec("xdg-open", [abs]);
}

