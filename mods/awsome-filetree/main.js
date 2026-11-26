// filetree: an IDE-style file tree for any Herdr layout. A port of claude-code-filetree
// (MIT, Kurt Buhler): git status with line and file counts, a branch row, search across
// unopened folders, date or size column, keyboard navigation and previews. The Claude-hook
// layer (reads, writes and git actions shimmering in the tree) is gone: it worked for one agent
// only (docs/REQUIREMENTS.md §4.5b A5).
// Layout-neutral: colors come from theme(), corners and header height from the shown
// layout's pane frame, fonts from settings().
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, InputState, Input, Scrollbar, v_virtual_list, VirtualListScrollHandle, TextView } from "gpui-base";
import { fileIcon as packIcon, followFileIcons } from "./file-icons.js";
import { menuView, menuHeight, menuWidth, menuKey, keyFor, tidy } from "./menu.js"; // shared awsome-* menu (identical copies in each mod) // identical copy of awsome-icons' loader (mods cannot import across folders)
import { confirmView, confirmHeight, confirmKey, CONFIRM } from "./confirm.js"; // shared awsome-* confirmation (identical copies in each mod)
import { spaces, panes, agents, focused, exec, readTextFile, watchFolder, theme, settings, window, layout, home, appHome, props, run, notify, openOverlay, closeOverlay, shared, setShared, nextCommand } from "herdr";

const NAME = "awsome-filetree";
// Names, paths and branches are set in the terminal font so O/0 and I/l/1 stay apart (docs/REQUIREMENTS.md §2.2).
const codeFont = () => settings().font_family ?? "JetBrains Mono";

// The file tree's context menu, in the shared group order (docs/REQUIREMENTS.md §2.6):
// open, then organise, then copy and reveal. `self` is null when only sizing it.
function menuEntries(m, self) {
  const platform = window()?.platform, mac = platform === "macos";
  const reveal = mac ? "Reveal in Finder" : platform === "windows" ? "Reveal in File Explorer" : "Open in file manager";
  const say = (title) => (e) => notify({ title, body: String(e?.message ?? e), level: "error" });
  // Several rows selected (docs/REQUIREMENTS.md section 4.3b): only what holds for all of them.
  // `copyOnly` is the selection bar's "Copy path" menu.
  if (m.paths) {
    const abs = m.paths.map((p) => join(m.root, p));
    return tidy([
      !m.copyOnly && { id: "send", label: "Send to agent", icon: UI("paper-plane-right"), keys: "A", run: (cx) => askSend(cx, abs) },
      !m.copyOnly && "-",
      { id: "rel", label: "Copy relative path", icon: UI("copy"), keys: "Y", run: (cx) => copy(cx, m.paths.join("\n")) },
      { id: "abs", label: "Copy absolute path", icon: UI("copy"), keys: mac ? "⇧Y" : "Shift+Y", run: (cx) => copy(cx, abs.join("\n")) },
    ]);
  }
  return tidy([
    // Space and Enter as in VS Code's explorer: Space previews, Enter opens a tab (§4.4a).
    !m.dir && { id: "preview", label: "Preview", icon: UI("eye"), keys: "Space", run: () => setShared(`${NAME}.preview`, { root: m.root, rel: m.rel, n: Date.now() }) },
    !m.dir && m.tab && { id: "tab", label: "Open in tab", icon: UI("tabs"), keys: "Enter", run: () => setShared(`${NAME}.open`, { root: m.root, rel: m.rel, n: Date.now() }) },
    !m.dir && { id: "open", label: "Open in default app", icon: UI("arrow-square-out"), disabled: !m.local, reason: "The file is on another machine", run: () => openExternal(m.abs).catch(say("Could not open the file")) },
    m.dir && { id: "root", label: "Open as root", icon: UI("tree-structure"), keys: keyFor(`${NAME}.into`, mac), run: () => setShared(`${NAME}.goto`, { root: m.root, rel: m.rel, n: Date.now() }) },
    "-",
    { id: "send", label: "Send to agent", icon: UI("paper-plane-right"), keys: "A", run: (cx) => sendToAgent(cx, m.abs) },
    "-",
    { id: "rel", label: "Copy relative path", icon: UI("copy"), keys: "Y", run: (cx) => copy(cx, m.rel) },
    { id: "abs", label: "Copy absolute path", icon: UI("copy"), keys: mac ? "\u21e7Y" : "Shift+Y", run: (cx) => copy(cx, m.abs) },
    { id: "reveal", label: reveal, icon: UI("folder-open"), disabled: !m.local, reason: "The folder is on another machine", run: () => revealExternal(m.abs).catch(say("Could not open the folder")) },
  ]);
}
const ICON = (name) => `mods/${NAME}/${name}.svg`;
const UI = (name) => `mods/awsome-icons/ui/${name}.svg`; // Phosphor, shared by every awsome-* mod
const ic = (name) => svg(UI(name)).size(14);
const ROW = 22; // VS Code's explorer row height
// docs/REQUIREMENTS.md §2.9: the frame Files and Changes share (design/tokens.json `panel`; C9).
export const PANEL = { header: 30, px: 10, gap: 8, text: 12, icon: 14, pad: 3, radius: 4, groupGap: 2, separator: 12, inset: 4, rowPx: 6, tree: 22, indent: 12, chevron: 12, fileIcon: 16, treeGap: 4, list: 28, title: 28, titleText: 11, body: 13, secondary: 11, delta: 64, half: 32, box: 84, boxPx: 10, boxPy: 7, button: 32, buttonRadius: 8, trigger: 30, end: 12, section: 12, line: 20 };
const P = PANEL;
// "1,015": the runtime's toLocaleString adds no separators.
const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const PER_FOLDER = 2000;
const FIND_LIMIT = 200;
const PRUNE = [".git", "node_modules", "target", ".venv", "__pycache__", "dist", ".next"];
const HOME_PRUNE = ["Library", "AppData", ".Trash"];
const DEFAULTS = { follow: true, column: "date", open: "preview" };
// Reads write nothing under .git (no index refresh or lock, no fsmonitor cookie): the folder
// watch would see it, and every refresh would start the next one.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", cjs: "js", toml: "yaml", yml: "yaml", jsonc: "json", svelte: "html", vue: "html", htm: "html", sh: "bash", zsh: "bash" };
const RANK = { "?": 1, A: 2, C: 2, R: 3, T: 3, M: 3, D: 4, U: 5 };
// Natural order, case-insensitive ("file2" before "file10"); this runtime has no Intl.
const collator = {
  compare(a, b) {
    const x = a.toLowerCase().match(/\d+|\D+/g) ?? [], y = b.toLowerCase().match(/\d+|\D+/g) ?? [];
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      if (x[i] === y[i]) continue;
      const nx = /^\d/.test(x[i]), ny = /^\d/.test(y[i]);
      if (nx && ny) return Number(x[i]) - Number(y[i]) || x[i].length - y[i].length;
      return x[i] < y[i] ? -1 : 1;
    }
    return x.length - y.length || (a < b ? -1 : a > b ? 1 : 0);
  },
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── paths ──────────────────────────────────────────────────────────────────────────────
const dirOf = (rel) => (rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "");
const baseOf = (path) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
const join = (root, rel) => (rel ? (/[\\/]$/.test(root) ? root + rel : `${root}/${rel}`) : root);
function ancestors(rel) {
  const out = [];
  for (let d = dirOf(rel); d; d = dirOf(d)) out.push(d);
  return out;
}
function relTo(root, abs) {
  if (!root || !abs) return null;
  const a = abs.replace(/\\/g, "/"), r = root.replace(/\\/g, "/").replace(/\/+$/, "");
  if (a === r) return "";
  return a.startsWith(r + "/") ? a.slice(r.length + 1) : null;
}
const stronger = (a, b) => (!a ? b : (RANK[b] ?? 0) > (RANK[a] ?? 0) ? b : a);

// ── formatting ─────────────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes == null || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["K", "M", "G", "T"];
  let v = bytes / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v < 100 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
// "2026-11-26 14:03": the full time, for a tooltip when the row shows no date.
function fullStamp(ms) {
  const d = new Date(ms), p = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function stamp(ms) {
  if (!ms) return "";
  const d = new Date(ms), now = new Date(), p = (v) => String(v).padStart(2, "0");
  if (d.toDateString() === now.toDateString()) return `${p(d.getHours())}:${p(d.getMinutes())}`;
  const month = MONTHS[d.getMonth()];
  return d.getFullYear() === now.getFullYear() ? `${month} ${d.getDate()}` : `${month} ${d.getFullYear()}`;
}
function words(command) {
  const out = [];
  let word = null, quote = "";
  for (const ch of command) {
    if (quote) { if (ch === quote) quote = ""; else word = (word ?? "") + ch; }
    else if (ch === '"' || ch === "'") { quote = ch; word ??= ""; }
    else if (/\s/.test(ch)) { if (word !== null) out.push(word); word = null; }
    else word = (word ?? "") + ch;
  }
  if (word !== null) out.push(word);
  return out;
}

// ── the active setup's look ────────────────────────────────────────────────────────────
// Corners and header height follow the shown layout's pane frame, so the tree sits in
// whatever layout it is put in: square in a flush layout, rounded in a card layout.
function frameLook() {
  let pane = null;
  const walk = (n) => {
    if (!n || pane) return;
    if (n.content?.tab && n.content.pane) pane = n.content.pane;
    for (const c of n.children ?? []) walk(c);
  };
  try { walk(layout()); } catch {}
  const radius = Number(pane?.radius ?? 6);
  return { radius: Math.max(0, Math.min(6, Number.isFinite(radius) ? radius : 6)), header: Math.max(26, Math.min(40, Number(pane?.header?.height) || 30)) };
}
// The one set of Git colors (docs/REQUIREMENTS.md §2.4), the same as Changes: modified ansi3,
// new ansi2, deleted ansi1, renamed ansi6, conflict ansi5.
const gitColor = (t, s) => (!s ? null : s === "U" ? t.ansi5 : s === "D" ? t.ansi1 : s === "?" || s === "A" || s === "C" ? t.ansi2 : s === "R" ? t.ansi6 : t.ansi3);
// The title row's view buttons (§2.9). Only Tree now: Recent is gone (it showed only what Claude
// Code's hook reported); Search (§4.7) will be the second, and the group shows from two views on.
const VIEWS = [["tree", "Tree", "folder"]];
// File and folder icons: Material Icon Theme, read from the awsome-icons mod by file-icons.js
// (the same matching VS Code uses). Without that mod, the plain file and folder pictures here.
const iconOf = (table, path, dir, open, dark) => packIcon(table, path, { dir, open, light: !dark }) ?? ICON(dir ? "folder" : "file");

// ── where to look ──────────────────────────────────────────────────────────────────────
// The focused pane's folder; when the focused pane is a mod (this tree opened as a pane,
// say), the first terminal beside it.
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  let pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  if (pane && !pane.terminal) pane = panes().find((p) => p.tab === pane.tab && p.terminal && p.cwd) ?? null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  // Local patch: a tab with no terminal (a Awsome Viewer viewer tab, a diff tab) has no folder of
  // its own; focusing one must leave the tree where it was, not fall back to the home folder.
  const stay = !f || (f.pane !== null && !panes().some((p) => p.tab === f.tab && p.terminal));
  return { cwd: pane?.cwd || f?.cwd || space?.folder || null, on, stay };
}
const windows = (on) => !on && window()?.platform === "windows";
const psQuote = (s) => "'" + s.replaceAll("'", "''") + "'";

async function listDir(path, on) {
  if (windows(on)) {
    const r = await exec("powershell", ["-NoProfile", "-Command", `& { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First ${PER_FOLDER + 1} | ForEach-Object { $rp = [bool]($_.Attributes -band [IO.FileAttributes]::ReparsePoint); @{ name=$_.Name; dir=($_.PSIsContainer -and -not $rp); link=$rp; size=$(if ($_.PSIsContainer) {0} else {$_.Length}); mtime=[DateTimeOffset]::new($_.LastWriteTimeUtc).ToUnixTimeMilliseconds() } }) | ConvertTo-Json -Compress } ${psQuote(path)}`]);
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const raw = JSON.parse(r.stdout || "[]"), list = Array.isArray(raw) ? raw : [raw];
    return { entries: sortEntries(list.slice(0, PER_FOLDER)), more: list.length > PER_FOLDER };
  }
  // One stat call for the folder: GNU's -c, else BSD's -f. "/" can't be in a name, so it splits.
  const script = `cd "$1" 2>/dev/null || exit 3; set --; for p in * .[!.]* ..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; [ "$p" = .git ] && continue; set -- "$@" "$p"; [ $# -gt ${PER_FOLDER} ] && break; done; [ $# -eq 0 ] && exit 0; if stat -c %s . >/dev/null 2>&1; then stat -c '%F/%s/%Y/%n' -- "$@"; else stat -f '%HT/%z/%m/%N' -- "$@"; fi; exit 0`;
  const r = await exec("sh", ["-c", script, NAME, path], { on });
  if (r.code === 3) throw new Error("Cannot open this folder");
  const list = [];
  for (const line of r.stdout.split("\n")) {
    const m = /^([^/]*)\/(\d+)\/(\d+)\/(.+)$/.exec(line);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    list.push({ name: m[4], dir: kind === "directory", link: kind.includes("link"), size: Number(m[2]), mtime: Number(m[3]) * 1000 });
  }
  return { entries: sortEntries(list.slice(0, PER_FOLDER)), more: list.length > PER_FOLDER };
}
const sortEntries = (list) => list.sort((a, b) => Number(b.dir) - Number(a.dir) || collator.compare(a.name, b.name));

async function buildIndex(root, on) {
  const atHome = root === home() || root === "/";
  const depth = atHome ? 5 : 12;
  if (windows(on)) {
    const r = await exec("powershell", ["-NoProfile", "-Command", `& { param($p) $b = (Resolve-Path -LiteralPath $p).Path.TrimEnd('\\'); Get-ChildItem -LiteralPath $b -Recurse -Force -Depth ${depth} -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '[\\\\/](\\.git|node_modules|target|\\.venv|__pycache__|dist|\\.next)([\\\\/]|$)' } | Select-Object -First 40000 | ForEach-Object { $(if ($_.PSIsContainer) {'d'} else {'f'}) + ($_.FullName.Substring($b.Length + 1) -replace '\\\\', '/') } } ${psQuote(root)}`]);
    const dirs = new Set(), all = [];
    for (const line of r.stdout.split(/\r?\n/)) if (line.length > 1) { const rel = line.slice(1); all.push(rel); if (line[0] === "d") dirs.add(rel); }
    return { dirs, all };
  }
  const names = [...PRUNE, ...(atHome ? HOME_PRUNE : [])].map((n) => `-name '${n}'`).join(" -o ");
  const script = `cd "$1" || exit 3; find . -maxdepth ${depth} \\( ${names} \\) -prune -o -type d -print 2>/dev/null | head -n 20000; echo //; find . -maxdepth ${depth} \\( ${names} \\) -prune -o ! -type d -print 2>/dev/null | head -n 40000`;
  const r = await exec("sh", ["-c", script, NAME, root], { on });
  const dirs = new Set(), all = [];
  let inDirs = true;
  for (const line of r.stdout.split("\n")) {
    if (line === "//") { inDirs = false; continue; }
    if (!line.startsWith("./")) continue;
    const rel = line.slice(2);
    all.push(rel);
    if (inDirs) dirs.add(rel);
  }
  return { dirs, all };
}

// ── git ────────────────────────────────────────────────────────────────────────────────
const emptyGit = () => ({ top: "", prefix: "", branch: null, status: new Map(), files: new Map(), ignored: new Set(), untracked: new Set(), diff: new Map(), counts: new Map() });

function parseBranch(record) {
  const body = record.replace(/^## /, "");
  if (body.startsWith("HEAD (no branch)")) return { head: "detached", upstream: "", ahead: 0, behind: 0 };
  return {
    head: body.match(/^(?:No commits yet on |Initial commit on )?(.+?)(?:\.\.\.|\s|$)/)?.[1] ?? body,
    upstream: body.match(/\.\.\.(\S+)/)?.[1] ?? "",
    ahead: Number(body.match(/ahead (\d+)/)?.[1] ?? 0),
    behind: Number(body.match(/behind (\d+)/)?.[1] ?? 0),
  };
}

function parseStatus(stdout, git) {
  const map = (p) => (p.startsWith(git.prefix) ? p.slice(git.prefix.length).replace(/\/$/, "") : null);
  const up = (rel, fn) => { for (const d of [...ancestors(rel), ""]) fn(d); };
  for (const rec of stdout.split("\0")) {
    if (rec.startsWith("## ")) { git.branch = parseBranch(rec); continue; }
    if (rec.length < 4) continue;
    const xy = rec.slice(0, 2), raw = rec.slice(3), rel = map(raw);
    if (!rel) continue;
    if (xy === "!!") { if (git.ignored.size < 5000) git.ignored.add(rel); continue; }
    const change = xy === "??" || (xy.includes("A") && !xy.includes("D")) ? 0 : xy.includes("D") && !xy.includes("U") ? 2 : 1;
    if (xy === "??" && raw.endsWith("/")) git.untracked.add(rel);
    else git.files.set(rel, change);
    up(rel, (d) => { const c = git.counts.get(d) ?? [0, 0, 0]; c[change]++; git.counts.set(d, c); });
    const letter = xy === "??" ? "?" : /U/.test(xy) || xy === "AA" || xy === "DD" ? "U" : ["D", "M", "R", "C", "A", "T"].find((c) => xy.includes(c)) ?? "";
    if (!letter) continue;
    git.status.set(rel, stronger(git.status.get(rel), letter));
    up(rel, (d) => git.status.set(d, stronger(git.status.get(d), letter)));
  }
}

function parseNumstat(stdout, git) {
  for (const rec of stdout.split("\0")) {
    const m = /^(-|\d+)\t(-|\d+)\t(.+)$/s.exec(rec);
    if (!m || !m[3].startsWith(git.prefix)) continue;
    const rel = m[3].slice(git.prefix.length), add = Number(m[1]) || 0, del = Number(m[2]) || 0;
    for (const d of [rel, ...ancestors(rel), ""]) { const v = git.diff.get(d) ?? [0, 0]; git.diff.set(d, [v[0] + add, v[1] + del]); }
  }
}

// ── opening files ──────────────────────────────────────────────────────────────────────
async function openExternal(abs) {
  const platform = window()?.platform;
  const r = platform === "macos" ? await exec("open", ["--", abs])
    : platform === "windows" ? await exec("powershell", ["-NoProfile", "-Command", `Invoke-Item -LiteralPath ${psQuote(abs)}`])
    : await exec("xdg-open", [abs]);
  if (r.code !== 0) throw new Error(r.stderr.trim() || "No app opens this file");
}
async function revealExternal(abs) {
  const platform = window()?.platform;
  if (platform === "macos") await exec("open", ["-R", "--", abs]);
  else if (platform === "windows") await exec("explorer.exe", [`/select,${abs.replace(/\//g, "\\")}`]);
  else await exec("xdg-open", [abs.replace(/\/[^/]*$/, "") || "/"]);
}
function copy(cx, text) {
  cx.write_to_clipboard(text);
  notify({ title: "Copied", body: text, level: "info", timeout: 2000 });
}
// Types "@path " into the agent of the shown tab, through the clipboard, then puts the
// clipboard back. The agent's pane takes the keyboard so the question can follow.
// `abs` is one path or a list; the paths go in one message, separated by spaces.
function sendToAgent(cx, abs) {
  const list = [].concat(abs);
  const f = focused(), fp = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const inTab = agents().filter((a) => a.tab === f?.tab);
  const address = (fp?.status && fp.terminal) || (inTab.find((a) => a.focused) ?? inTab[0])?.address || agents().find((a) => a.focused)?.address;
  if (!address) { notify({ title: "No agent in this tab", body: "Start one, then send the path again", level: "warning", timeout: 3000 }); return; }
  const cwd = panes().find((p) => p.terminal === address)?.cwd;
  const text = list.map((a) => { const path = relTo(cwd, a) || a; return `@${/\s/.test(path) ? `"${path}"` : path}`; }).join(" ") + " ";
  const before = cx.read_from_clipboard();
  cx.write_to_clipboard(text);
  run("pane.focus", { terminal: address });
  run("terminal.paste");
  cx.timer.after(600, (cx) => { if (before !== undefined) cx.write_to_clipboard(before); });
}

// More than this many paths in one message asks first (docs/REQUIREMENTS.md section 4.4a).
const SEND_LIMIT = 100;
const sendAsk = (abs) => ({ title: `Send ${abs.length} paths to the agent?`, names: abs.map(baseOf), action: "Send paths", danger: false });
function askSend(cx, abs) {
  if (abs.length <= SEND_LIMIT) { sendToAgent(cx, abs); return; }
  const text = sendAsk(abs);
  openOverlay({ mod: NAME, kind: "dialog", frame: "none", width: CONFIRM.width, height: confirmHeight(text), props: { ask: { abs } } });
}

export default class FileTree extends View {
  // The keyboard cursor. Setting it selects just that row, so every place that moves the cursor
  // (arrows, going up a folder, jumping to a hit) also leaves a one-row selection; the selection
  // code below (Ctrl / Shift / the bar) sets `sel` itself afterwards. docs/REQUIREMENTS.md 4.4a.
  get cursor() { return this._cursor ?? ""; }
  set cursor(rel) { this._cursor = rel; this.sel = rel ? new Set([rel]) : new Set(); }

  init(_props, cx) {
    this.menu = props()?.menu ?? null;
    this.ask = props()?.ask ?? null;
    if (this.menu || this.ask) { this.handle = cx.focus_handle(); this.handle.focus(); this.at = -1; return; }
    this.sel = new Set(); this.anchor = ""; this.lastDown = null;
    this.openPreview = "slot"; this.previewDelay = 250; this.waiting = null;
    this.handle = cx.focus_handle();
    followFileIcons(this, cx);
    this.scroll = VirtualListScrollHandle.new();
    this.config = { ...DEFAULTS };
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem("prefs") ?? "{}"); } catch {}
    this.showHidden = prefs.showHidden ?? true;
    this.showSize = prefs.showSize ?? null;
    this.follow = true; this.pinned = null;
    this.view = VIEWS.some(([v]) => v === prefs.view) ? prefs.view : "tree";
    this.saved = new Map();
    this.sizes = new Map(); this.sizing = new Set(); this.visible = [];
    this.width = 320; this.query = ""; this.hits = null; this.searchSeq = 0;
    this.seenPreview = shared(`${NAME}.preview`)?.n ?? 0; this.seenView = shared(`${NAME}.view`)?.n ?? 0; this.seenGoto = shared(`${NAME}.goto`)?.n ?? 0; this.seenOpen = shared(`${NAME}.open`)?.n ?? 0;
    this.input = InputState.new({ placeholder: "Filter files" });
    this.input.on("change", (_e, cx) => this.search(this.input.value(), cx));
    this.input.on("submit", (_e, cx) => this.jump(cx));
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    this.reset(null, null);
    cx.spawn(async (cx) => { for (;;) this.command(await nextCommand(), cx); });
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(`${appHome()}/mods/${NAME}/config.json`);
        if (text) this.config = { ...DEFAULTS, ...JSON.parse(text) };
      } catch (e) { notify({ title: "awsome-filetree: config.json is invalid", body: String(e), level: "warning", timeout: 4000 }); }
      // The schema limits these (mod.schema.json), so they are taken as given.
      const { preview = "slot", previewDelay = 250 } = JSON.parse(await readTextFile(`${appHome()}/mods/${NAME}/mod.json`)).settings?.open ?? {};
      this.openPreview = preview; this.previewDelay = previewDelay;
      this.statusLetter = Boolean(JSON.parse(await readTextFile(`${appHome()}/mods/${NAME}/mod.json`)).settings?.row?.statusLetter);
      // Local patch: "open": "awsome-viewer" needs Awsome Viewer' viewer; without it, preview here.
      this.hasAwsomeViewer = Boolean(await readTextFile(`${appHome()}/mods/awsome-viewer/mod.json`).catch(() => null));
      this.showSize ??= this.config.column === "size";
      cx.notify();
    });
    cx.timer.every(10000, (cx) => this.refresh(cx));
    cx.timer.every(1000, (cx) => this.tick(cx));
  }

  savePrefs() {
    try { localStorage.setItem("prefs", JSON.stringify({ showHidden: this.showHidden, showSize: this.showSize, view: this.view })); } catch {}
  }

  // Several rows selected: the way back. Esc, a click on empty space, the bar's x and any plain
  // click all end up here or in the cursor setter. `keep` leaves the cursor row selected.
  clearSelection(keep = false) {
    this.sel = keep && this.cursor ? new Set([this.cursor]) : new Set();
    this.anchor = keep ? this.cursor : "";
    if (!keep) this._cursor = "";
  }

  // Ctrl (Cmd on macOS) adds a row to the selection or takes it out, without opening it.
  toggleSelect(rel) {
    const next = new Set(this.sel);
    if (!this.sel.size && this.cursor) next.add(this.cursor);
    if (next.has(rel)) next.delete(rel); else next.add(rel);
    this.sel = next; this.anchor = rel; this._cursor = rel;
  }

  // Shift: every visible row from the anchor to this one, in the order they are drawn.
  extendSelection(rel, rows) {
    const from = this.anchor || this.cursor || rel;
    const i = rows.findIndex((r) => r.rel === from), j = rows.findIndex((r) => r.rel === rel);
    if (j < 0) return;
    if (i < 0) { this.sel = new Set([rel]); this.anchor = rel; this._cursor = rel; return; }
    const [lo, hi] = i < j ? [i, j] : [j, i];
    this.sel = new Set(rows.slice(lo, hi + 1).map((r) => r.rel));
    this.anchor = from; this._cursor = rel;
  }

  // Two or more rows: the selection bar shows, the menu is the several-rows one.
  paths() { return [...this.sel]; }

  // A file deleted or renamed outside leaves the selection. A row whose folder isn't loaded is
  // kept: nothing says it is gone. Fewer than two rows left and the bar goes by itself.
  pruneSelection() {
    if (!this.sel.size) return;
    const gone = (rel) => { const list = this.entries.get(dirOf(rel)); return Boolean(list) && !list.some((e) => e.name === baseOf(rel)); };
    const keep = [...this.sel].filter((rel) => !gone(rel));
    if (keep.length !== this.sel.size) this.sel = new Set(keep);
  }

  setView(view, cx) {
    if (view === this.view) return;
    this.view = view;
    this.cancelWait();
    this.clearSelection(true);
    this.savePrefs();
    this.hits = null; this.searchSeq++;
    if (view === "tree" && this.query.trim()) this.search(this.query, cx);
    this.scrollTo = this.cursor || null;
    cx.notify();
  }

  // ── the folder shown ─────────────────────────────────────────────────────────────────
  wanted() {
    const loc = location();
    if (!this.follow && this.pinned) return { root: this.pinned, on: this.pinnedOn };
    if (loc.stay && this.root) return { root: this.root, on: this.on };
    return { root: loc.cwd, on: loc.on };
  }

  reset(root, on) {
    if (this.ctx?.root) this.saved.set(this.ctx.key, { folders: this.folders, cursor: this.cursor });
    const key = JSON.stringify([root, on]), s = this.saved.get(key);
    this.cancelWait();
    this.ctx = { key, root, on }; this.root = root; this.on = on;
    this.entries = new Map(); this.folders = new Set(s?.folders); this.pending = new Set();
    this.cursor = s?.cursor ?? ""; this.git = emptyGit(); this.index = null; this.hits = null;
    this.sizes = new Map(); this.sizing = new Set(); this.error = null; this.limited = false;
    this.loading = false; this.again = false; this.watched = null; this.scrollTo = this.cursor || null;
    if (this.query) { this.query = ""; this.input?.set_value(""); }
    this.closePreview();
  }

  current(ctx) { return this.ctx === ctx; }

  sync(cx) {
    const { root, on } = this.wanted();
    if (root === this.root && on === this.on) return;
    this.reset(root, on);
    this.refresh(cx);
  }

  refresh(cx) {
    if (!this.root) return;
    if (this.loading) { this.again = true; return; }
    const ctx = this.ctx;
    this.loading = true; this.limited = false;
    cx.spawn(async (cx) => {
      try {
        for (const path of ["", ...this.folders]) {
          if (!this.current(ctx)) return;
          try { await this.loadFolder(path, ctx); }
          catch (e) { if (!path) throw e; this.folders.delete(path); this.entries.delete(path); }
        }
        await this.readGit(ctx);
        if (!this.current(ctx)) return;
        this.error = null;
        this.pruneSelection();
        this.watch(cx);
      } catch (e) { if (this.current(ctx)) this.error = String(e?.message ?? e); }
      finally {
        if (this.current(ctx)) {
          this.loading = false;
          if (this.again) { this.again = false; this.refresh(cx); }
        }
        cx.notify();
      }
    });
  }

  async loadFolder(path, ctx) {
    const { entries, more } = await listDir(join(ctx.root, path), ctx.on);
    if (!this.current(ctx) || (path && !this.folders.has(path))) return;
    this.entries.set(path, entries);
    if (more) this.limited = true;
  }

  async readGit(ctx) {
    const g = (args) => exec("git", [...READ, ...args], { cwd: ctx.root, on: ctx.on });
    const git = emptyGit();
    const top = await g(["rev-parse", "--show-toplevel", "--show-prefix"]).catch(() => null);
    if (top?.code === 0) {
      const [dir, prefix = ""] = top.stdout.split("\n");
      git.top = dir.trim(); git.prefix = prefix.trim();
      const status = await g(["status", "--porcelain=v1", "-z", "-b", "--no-renames", "--untracked-files=normal", "--ignored=traditional", "--", "."]);
      if (status.code === 0) parseStatus(status.stdout, git);
      const head = await g(["rev-parse", "--verify", "-q", "HEAD"]);
      if (head.code === 0) {
        const numstat = await g(["diff", "HEAD", "--numstat", "-z", "--no-renames", "--", "."]);
        if (numstat.code === 0) parseNumstat(numstat.stdout, git);
      }
    }
    if (this.current(ctx)) this.git = git;
  }

  watch(cx) {
    if (this.on || this.watched === this.root) return;
    const ctx = this.ctx, root = this.root;
    this.watched = root;
    cx.spawn(async (cx) => {
      try {
        while (this.current(ctx)) {
          const paths = await watchFolder(root);
          if (!this.current(ctx)) return;
          this.changed(paths, cx);
        }
      } catch { if (this.current(ctx)) this.watched = null; }
    });
  }

  changed(paths, cx) {
    let structural = false;
    for (const abs of paths) {
      const rel = relTo(this.root, abs);
      if (rel === null || rel === ".git" || rel.startsWith(".git/")) continue;
      structural = true;
      for (const d of [...ancestors(rel), ""]) this.sizes.delete(d);
    }
    if (structural && !this.query) this.index = null;
    this.refresh(cx);
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) { this.folders.delete(folder); this.entries.delete(folder); }
    } else this.open([path], cx);
    cx.notify();
  }

  // Opens folders (and their parents) and loads what they hold.
  open(paths, cx, then) {
    const ctx = this.ctx, todo = [];
    for (const p of paths) for (const d of [...ancestors(p).reverse(), p]) if (d && !this.folders.has(d)) { this.folders.add(d); todo.push(d); }
    cx.spawn(async (cx) => {
      for (const d of todo) {
        if (!this.current(ctx)) return;
        if (this.entries.has(d) || this.pending.has(d)) continue;
        this.pending.add(d);
        try { await this.loadFolder(d, ctx); }
        catch { this.folders.delete(d); }
        finally { this.pending.delete(d); }
      }
      if (this.current(ctx)) then?.();
      cx.notify();
    });
  }

  collapseAll(cx) { this.folders = new Set(); for (const k of [...this.entries.keys()]) if (k) this.entries.delete(k); cx.notify(); }

  // ── search ───────────────────────────────────────────────────────────────────────────
  search(query, cx) {
    this.query = query;
    const q = query.trim().toLowerCase();
    if (!q || this.view !== "tree") { this.hits = null; cx.notify(); return; }
    const seq = ++this.searchSeq, ctx = this.ctx;
    this.searching = true;
    cx.spawn(async (cx) => {
      try {
        if (!this.index) {
          const index = await buildIndex(ctx.root, ctx.on);
          if (!this.current(ctx)) return;
          this.index = index;
        }
        if (seq !== this.searchSeq) return;
        const matches = this.index.all.filter((rel) => rel.toLowerCase().includes(q) && (this.showHidden || !rel.split("/").some((s) => s.startsWith("."))));
        const named = matches.filter((rel) => baseOf(rel).toLowerCase().includes(q));
        this.hits = [...new Set([...named, ...matches])].slice(0, FIND_LIMIT);
        this.cursor = this.hits[0] ?? "";
        this.scrollTo = this.cursor;
      } catch (e) { if (seq === this.searchSeq) this.hits = []; this.error = String(e?.message ?? e); }
      finally { if (seq === this.searchSeq) this.searching = false; cx.notify(); }
    });
  }

  clearSearch(cx) {
    this.query = ""; this.hits = null; this.searchSeq++;
    this.input.set_value("");
    cx.notify();
  }

  jump(cx) {
    if (this.view !== "tree") {
      const first = this.rows().find((r) => r.rel === this.cursor) ?? this.rows()[0];
      if (first) { this.cursor = first.rel; this.handle.focus(); this.openFile(first.rel, cx); }
      return;
    }
    const target = this.hits?.includes(this.cursor) ? this.cursor : this.hits?.[0];
    this.clearSearch(cx);
    if (!target) return;
    this.cursor = target;
    this.handle.focus();
    this.open(ancestors(target), cx, () => { this.scrollTo = target; });
  }

  // ── rows ─────────────────────────────────────────────────────────────────────────────
  rows() {
    const out = [];
    if (this.hits) {
      const keep = new Set(), kids = new Map(), dirs = this.index?.dirs ?? new Set();
      for (const h of this.hits) { keep.add(h); for (const a of ancestors(h)) keep.add(a); }
      for (const rel of keep) { const p = dirOf(rel); if (!kids.has(p)) kids.set(p, []); kids.get(p).push(rel); }
      const entryOf = (rel) => this.entries.get(dirOf(rel))?.find((e) => e.name === baseOf(rel)) ?? { name: baseOf(rel), dir: dirs.has(rel), size: null, mtime: 0 };
      const walk = (p, depth) => {
        const list = (kids.get(p) ?? []).sort((a, b) => Number(dirs.has(b)) - Number(dirs.has(a)) || collator.compare(baseOf(a), baseOf(b)));
        for (const rel of list) { const e = entryOf(rel); out.push({ rel, e, depth, open: kids.has(rel) }); if (kids.has(rel)) walk(rel, depth + 1); }
      };
      walk("", 0);
      return out;
    }
    const walk = (prefix, depth) => {
      for (const e of this.entries.get(prefix) ?? []) {
        if (!this.showHidden && e.name.startsWith(".")) continue;
        const rel = prefix ? `${prefix}/${e.name}` : e.name, open = e.dir && this.folders.has(rel);
        out.push({ rel, e, depth, open });
        if (open && depth < 40) walk(rel, depth + 1);
      }
    };
    walk("", 0);
    return out;
  }

  isIgnored(rel) {
    if (!this.git.ignored.size) return false;
    for (let r = rel; r; r = dirOf(r)) if (this.git.ignored.has(r)) return true;
    return false;
  }
  underUntracked(rel) {
    if (!this.git.untracked.size) return false;
    for (let r = rel; r; r = dirOf(r)) if (this.git.untracked.has(r)) return true;
    return false;
  }

  tick(cx) {
    if (this.showSize && this.view === "tree") this.pumpSizes(cx);
  }

  // ── sizes ────────────────────────────────────────────────────────────────────────────
  pumpSizes(cx) {
    if (windows(this.on)) return;
    const ctx = this.ctx;
    for (const rel of this.visible) {
      if (this.sizing.size >= 2) break;
      if (this.sizes.has(rel) || this.sizing.has(rel)) continue;
      this.sizing.add(rel);
      cx.spawn(async (cx) => {
        try {
          const r = await exec("du", ["-sk", "--", join(ctx.root, rel)], { on: ctx.on });
          const kb = Number(r.stdout.split(/\s/)[0]);
          if (this.current(ctx)) this.sizes.set(rel, Number.isFinite(kb) ? kb * 1024 : -1);
        } catch { if (this.current(ctx)) this.sizes.set(rel, -1); }
        finally { this.sizing.delete(rel); cx.notify(); }
      });
    }
  }

  // ── preview and opening ──────────────────────────────────────────────────────────────
  closePreview() {
    this.code?.release();
    this.code = null; this.md = null; this.file = null; this.fileError = null;
  }

  // inRender: called while drawing (a request from another mod), where notify is refused.
  show(rel, cx, inRender = false) {
    this.closePreview();
    this.file = rel;
    const ctx = this.ctx;
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(join(ctx.root, rel), { on: ctx.on });
        if (this.file !== rel || !this.current(ctx)) return;
        if (text === null) { this.fileError = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.fileError = "Binary file · no text preview"; return; }
        const value = text.length > 400000 ? text.slice(0, 400000) + "\n… (file truncated)" : text;
        const ext = rel.includes(".") ? rel.split(".").pop().toLowerCase() : "txt";
        if (ext === "md" || ext === "markdown" || ext === "mdx") { this.md = value; return; }
        const t = theme();
        this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: true, value,
          font_family: settings().font_family, font_size: 12,
          syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
      } catch { if (this.file === rel && this.current(ctx)) this.fileError = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
    if (!inRender) cx.notify();
  }

  // ── the preview column of the layout (docs/REQUIREMENTS.md section 4.4a) ─────────────────
  // The layout's `preview` node, or null in a layout that has none (Herdr's own layouts).
  slotNode() {
    const find = (n) => (n?.id === "preview" ? n : (n?.children ?? []).map(find).find(Boolean));
    return find(layout()) ?? null;
  }
  slotShown() { const n = this.slotNode(); return Boolean(n) && !n.hidden; }
  showSlot() { run("layout.show", { id: "preview" }); }
  hideSlot() { if (this.slotShown()) run("layout.hide", { id: "preview" }); }
  cancelWait() { this.waiting = null; }

  // Single click, or Space (`explicit`): the file in the preview column. Showing a hidden column
  // moves the layout, so a click waits previewDelay for a second click first (a double-click then
  // opens a tab and the layout changes once); with the column already shown it swaps at once.
  // A layout without the column, or no viewer mod, previews inside this panel instead.
  previewSlot(rel, cx, explicit = false) {
    this.cancelWait();
    if (this.openPreview === "off" && !explicit) return;
    if (!this.slotNode()) { this.show(rel, cx); return; }
    const space = spaces().find((x) => x.active).id;
    const file = { path: join(this.root, rel), root: this.root, on: this.on ?? null };
    const put = () => { setShared("awsome-viewer.slot", { space, file }); this.showSlot(); };
    if (explicit || !this.previewDelay || this.slotShown()) { put(); return; }
    this.waiting = rel;
    cx.timer.after(this.previewDelay, (cx) => { if (this.waiting !== rel) return; this.waiting = null; put(); cx.notify(); });
  }

  // Double-click and Enter: config.json's "open". "preview" shows it here; "" the default
  // app; anything else is a command with {path} and {dir}, run without a shell.
  openFile(rel, cx) {
    const how = String(this.config.open ?? "preview").trim(), abs = join(this.root, rel);
    if (how === "awsome-viewer") { this.openViewer(rel, true, cx); return; }
    if (how === "preview" || this.on) { this.show(rel, cx); return; }
    cx.spawn(async (cx) => {
      try {
        if (!how) await openExternal(abs);
        else {
          const argv = words(how), dir = abs.replace(/[\\/][^\\/]*$/, "");
          const filled = argv.map((w) => w.replace(/\{(path|dir)\}/g, (_, k) => (k === "path" ? abs : dir)));
          const r = await exec(filled[0], [...filled.slice(1), ...(argv.some((w) => w.includes("{path}")) ? [] : [abs])], { cwd: dir });
          if (r.code !== 0) throw new Error(r.stderr.trim() || `${filled[0]} exited ${r.code}`);
        }
      } catch (e) { notify({ title: "Could not open the file", body: String(e?.message ?? e), level: "error", timeout: 4000 }); this.show(rel, cx); }
      cx.notify();
    });
  }

  // Local patch ("open": "awsome-viewer"): shows a file in a Awsome Viewer viewer tab instead of in
  // this panel. It follows Awsome Viewer' own click rules (actions/open.js): a file already open
  // goes to its tab; otherwise the space's one shared preview tab is reused, or made; keep=true
  // (a double-click) turns that tab into one you keep, so the next click starts a new shared tab.
  openViewer(rel, keep, cx) {
    if (!this.hasAwsomeViewer) { this.show(rel, cx); return; }
    const space = spaces().find((s) => s.active)?.id;
    if (!space) return;
    const VIEWERS = "awsome-viewer.viewers";
    const file = { path: join(this.root, rel), root: this.root, on: this.on ?? null };
    const name = file.path.split(/[\\/]/).pop();
    const entries = () => shared(VIEWERS) ?? {};
    const set = (id, change) => { const all = entries(); setShared(VIEWERS, { ...all, [id]: { ...all[id], ...change } }); };
    const where = new Map(spaces().flatMap((s) => (s.tabs ?? []).map((t) => [t.id, s.id])));
    const tabLive = (tab) => panes().some((p) => p.tab === tab && p.mod === "awsome-viewer");
    const live = Object.entries(entries()).filter(([, e]) => e.space === space
      && (e.tab ? tabLive(e.tab) : Date.now() - (e.at ?? 0) < 1500)
      && !(e.tab && (where.get(e.tab) ?? e.space) !== e.space));
    const open = live.find(([, e]) => e.file?.path === file.path);
    if (open) {
      if (keep) set(open[0], { preview: false });
      if (open[1].tab) run("tab.select", { id: open[1].tab });
    } else {
      const reuse = keep ? null : live.find(([, e]) => e.preview);
      if (reuse) {
        set(reuse[0], { file });
        if (reuse[1].tab) { run("tab.rename", { id: reuse[1].tab, name }); run("tab.select", { id: reuse[1].tab }); }
      } else {
        const id = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const others = panes().filter((p) => p.mod === "awsome-viewer").map((p) => p.tab);
        set(id, { space, file, preview: !keep, tab: null, others, at: Date.now() });
        run("tab.new", { space, name, mod: "awsome-viewer", props: { mode: "viewer", viewer: id, space, file } });
      }
    }
    // The tab takes the file over: the preview column showing it closes, so it isn't on screen twice.
    if (keep && shared("awsome-viewer.slot")?.file?.path === file.path) this.hideSlot();
    cx.notify();
  }

  openMenu(rel, dir) {
    const m = { root: this.root, rel, abs: join(this.root, rel), dir, local: !this.on, tab: this.config.open === "awsome-viewer" };
    const entries = menuEntries(m, null);
    openOverlay({ mod: NAME, kind: "popup", frame: "none", width: menuWidth(entries), height: menuHeight(entries), props: { menu: m } });
  }

  // The menu for the selected rows. `copyOnly` is the selection bar's Copy path menu.
  openManyMenu(copyOnly = false) {
    const m = { root: this.root, paths: this.paths(), copyOnly, local: !this.on };
    const entries = menuEntries(m, null);
    openOverlay({ mod: NAME, kind: "popup", frame: "none", width: menuWidth(entries), height: menuHeight(entries), props: { menu: m } });
  }

  // A virtual list's rows can't hold handlers, so the list reports the row and
  // a second press on the same row within 450 ms is the double-click.
  press(rel, cx) {
    const rows = this.rows(), r = rows.find((x) => x.rel === rel);
    if (!r) return;
    // The list reports no modifiers, so the mouse-down above it noted them (see render).
    const { mods: m, count } = this.lastDown;
    this.lastDown = null;
    this.cancelWait();
    this.handle.focus();
    // Ctrl (Cmd on macOS) and Shift only change the selection: nothing opens, nothing expands.
    if (m.shift) { this.extendSelection(rel, rows); cx.notify(); return; }
    if (window()?.platform === "macos" ? m.platform : m.control) { this.toggleSelect(rel); cx.notify(); return; }
    const now = Date.now(), double = count >= 2 || (this.lastPress?.rel === rel && now - this.lastPress.at < 450);
    this.lastPress = double ? null : { rel, at: now };
    this.cursor = rel; this.anchor = rel;
    if (r.e.dir) { if (this.hits) this.jump(cx); else if (!double) this.toggle(rel, cx); }
    else if (this.config.open === "awsome-viewer") { if (double) this.openViewer(rel, true, cx); else this.previewSlot(rel, cx); }
    else if (double) this.openFile(rel, cx);
    cx.notify();
  }

  // ── keyboard ─────────────────────────────────────────────────────────────────────────
  move(rows, delta) {
    if (!rows.length) return;
    const at = rows.findIndex((r) => r.rel === this.cursor);
    const next = Math.max(0, Math.min(rows.length - 1, at < 0 ? (delta > 0 ? 0 : rows.length - 1) : at + delta));
    this.cursor = rows[next].rel;
    this.scroll.scroll_to_item(next);
  }


  // The root moves up one folder, or into one of its folders. Both stop following the focused pane.
  goUp() {
    if (!this.root) return;
    const norm = this.root.split(String.fromCharCode(92)).join("/").replace(/[/]+$/, ""); // both separators, no trailing one
    const at = norm.lastIndexOf("/");
    if (at < 0) return; // already at a drive or filesystem root
    let up = norm.slice(0, at);
    if (!up) up = "/"; else if (/^[A-Za-z]:$/.test(up)) up += "/"; // "C:" alone means the drive's current folder
    this.follow = false; this.pinned = up; this.pinnedOn = this.on;
    this.cursor = norm.slice(at + 1); this.scrollTo = this.cursor; // select the folder we just left, like Explorer
  }
  enterFolder(rel, cx) {
    if (!this.root || !rel) return;
    if (this.query) this.clearSearch(cx);
    this.follow = false; this.pinned = join(this.root, rel); this.pinnedOn = this.on; this.cursor = "";
  }

  // Back to following the focused pane: the way back from goUp / enterFolder / Open as root.
  followPane() { this.follow = true; this.pinned = null; }

  // Key commands bound in keys.json's "mod:awsome-filetree" section (defaults in mod.schema.json).
  command(name, cx) {
    const c = String(name ?? "").replace(/^awsome-filetree[.:]/, "");
    if (c === "up") this.goUp();
    else if (c === "follow") this.followPane();
    else if (c === "menu") {
      // Shift+F10, as in Windows and VS Code: the menu of the row under the keyboard cursor.
      const cur = this.rows().find((r) => r.rel === this.cursor);
      if (this.sel.size > 1) this.openManyMenu();
      else if (cur) this.openMenu(cur.rel, Boolean(cur.e?.dir));
    }
    else if (c === "into") {
      const cur = this.rows().find((r) => r.rel === this.cursor);
      if (cur?.e?.dir) this.enterFolder(cur.rel, cx);
    } else return;
    cx.notify();
  }

  key(e, cx) {
    const k = e.key, rows = this.rows(), cur = rows.find((r) => r.rel === this.cursor);
    if (this.typing) {
      if (k === "escape") { if (this.query) this.clearSearch(cx); else this.handle.focus(); }
      else if (k === "down" || k === "up") this.move(rows, k === "down" ? 1 : -1);
      else return;
      cx.stop_propagation(); cx.notify(); return;
    }
    if (this.file) {
      if (k === "escape" || k === "left" || k === "h") this.closePreview();
      else if (k === "o" && !this.on) openExternal(join(this.root, this.file)).catch(() => {});
      else return;
      cx.stop_propagation(); cx.notify(); return;
    }
    // Up a folder and into a folder come as commands from keys.json (see command()), so they can be rebound.
    const shift = e.modifiers?.shift, add = window()?.platform === "macos" ? e.modifiers?.platform : e.modifiers?.control;
    // Moving the cursor: plain selects that row; with Shift the range from the anchor follows it.
    const nav = (delta) => {
      const from = this.anchor || this.cursor;
      this.move(rows, delta);
      if (shift) { this.anchor = from; this.extendSelection(this.cursor, rows); } else this.anchor = this.cursor;
    };
    const many = this.sel.size > 1;
    if (k === "up" || k === "k") nav(-1);
    else if (k === "down" || k === "j") nav(1);
    else if (k === "pageup") nav(-10);
    else if (k === "pagedown") nav(10);
    else if (k === "home") nav(-rows.length);
    else if (k === "end") nav(rows.length);
    else if (k === "space" && add && cur) this.toggleSelect(cur.rel);
    else if (k === "/") { this.input.focus(); }
    else if (k === ".") { this.showHidden = !this.showHidden; this.savePrefs(); }
    else if (k === "escape") { this.cancelWait(); if (this.query) this.clearSearch(cx); else if (this.sel.size) this.clearSelection(); else this.hideSlot(); }
    else if (many && k === "y") copy(cx, shift ? this.paths().map((p) => join(this.root, p)).join("\n") : this.paths().join("\n"));
    else if (many && k === "a") askSend(cx, this.paths().map((p) => join(this.root, p)));
    else if (many && (k === "enter" || k === "space" || k === "p" || k === "right" || k === "l" || k === "left" || k === "h")) return;
    else if (/^[1-9]$/.test(k) && VIEWS[Number(k) - 1]) this.setView(VIEWS[Number(k) - 1][0], cx);
    else if (!cur) return;
    else if ((k === "right" || k === "l") && cur.e.dir && !cur.open) this.toggle(cur.rel, cx);
    else if (k === "left" || k === "h") { if (cur.e.dir && cur.open && !this.hits) this.toggle(cur.rel, cx); else if (dirOf(cur.rel) || cur.depth) { this.cursor = dirOf(cur.rel); this.scrollTo = this.cursor; } }
    else if (k === "enter") { if (this.hits) this.jump(cx); else if (cur.e.dir) this.toggle(cur.rel, cx); else this.openFile(cur.rel, cx); }
    else if (k === "space") { if (cur.e.dir) this.toggle(cur.rel, cx); else this.previewSlot(cur.rel, cx, true); }
    else if (k === "p" && !cur.e.dir) this.previewSlot(cur.rel, cx, true);
    else if (k === "y") copy(cx, shift ? join(this.root, cur.rel) : cur.rel);
    else if (k === "a") sendToAgent(cx, join(this.root, cur.rel));
    else return;
    cx.stop_propagation(); cx.notify();
  }

  // ── drawing ──────────────────────────────────────────────────────────────────────────
  button(id, label, tip, on, onClick, t, R) {
    return div().id(id).p(P.pad).flex_none().flex().items_center().justify_center().rounded(P.radius).cursor_pointer()
      .text_size(P.text).text_color(on ? t.foreground : t.dim).when(on, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip).accessibility_label(tip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { onClick(cx); cx.notify(); })
      .child(label);
  }

  // The keyboard cursor: a 1px accent ring inside the row, only while this list has the keyboard
  // (docs/REQUIREMENTS.md section 2.3).
  ringed(rel) { return rel === this.cursor && !this.file && !this.typing && this.handle.is_focused(); }
  ring(t, R) { return div().absolute().inset_0().rounded(R).border_1().border_color(t.accent); }

  // Two or more rows selected: how many, and what can be done to all of them. docs/REQUIREMENTS.md
  // section 4.4a: 32 high (the title row's grid), 24px ghost buttons, 8px sides, 4px between.
  selectionBar(t) {
    const pill = (id, label, caret, fn) => h_flex().id(id).h(24).px(8).gap(4).items_center().flex_none().rounded(6).cursor_pointer()
      .text_size(12).text_color(t.foreground).hover((s) => s.bg(t.hover))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { fn(cx); cx.notify(); })
      .child(label).when(caret, (el) => el.child(svg(UI("caret-down")).size(12).text_color(t.muted)));
    return h_flex().id("ft-selbar").h(32).flex_none().px(8).gap(4).items_center().border_b(1).border_color(t.border)
      .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.foreground).child(`${this.sel.size} selected`))
      .child(pill("ft-sel-send", "Send to agent", false, (cx) => askSend(cx, this.paths().map((p) => join(this.root, p)))))
      .child(pill("ft-sel-copy", "Copy path", true, () => this.openManyMenu(true)))
      .child(div().id("ft-sel-clear").size(24).flex_none().flex().items_center().justify_center().rounded(6).cursor_pointer()
        .hover((s) => s.bg(t.hover)).tooltip("Clear selection (Esc)")
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => { this.clearSelection(true); cx.notify(); })
        .child(svg(UI("x")).size(16).text_color(t.muted)));
  }

  row(r, t, R, now) {
    const { rel, e, depth, open } = r, g = this.git;
    const status = g.status.get(rel) ?? (this.underUntracked(rel) ? "?" : null);
    const ignored = !status && this.isIgnored(rel);
    const gc = gitColor(t, status), hidden = e.name.startsWith(".");
    const nameColor = (ignored ? t.dim : gc ?? (hidden ? t.muted : t.foreground));
    const loc = !e.dir ? g.diff.get(rel) : null, counts = e.dir ? g.counts.get(rel) : null;
    const meta = this.showSize
      ? (e.dir ? (this.sizes.has(rel) ? formatSize(this.sizes.get(rel)) : "…") : formatSize(e.size))
      : (!e.dir && !loc && this.width > 250 ? stamp(e.mtime) : "");
    const selected = this.sel.has(rel);
    // The tooltip says only what the row doesn't (docs/REQUIREMENTS.md §2.5, UI-LESSONS L20): the
    // status in words (the row shows it by color), a folder's contents and totals (a folder row
    // shows neither), the time when the row isn't showing it, and the path only if the name is cut off.
    const words = { M: "Modified", A: "New", "?": "New", D: "Deleted", R: "Renamed", U: "Conflict" };
    const held = counts ? [[counts[1], "modified"], [counts[0], "new"], [counts[2], "deleted"]].filter(([n]) => n).map(([n, w]) => `${grouped(n)} ${w}`) : [];
    const sum = e.dir ? g.diff.get(rel) : null;
    const side = (meta ? meta.length * 6.6 + P.treeGap : 0) + (loc?.[0] ? String(loc[0]).length * 6.6 + 10 : 0) + (loc?.[1] ? String(loc[1]).length * 6.6 + 10 : 0);
    const room = this.width - 2 * (P.inset + P.rowPx) - depth * P.indent - P.chevron - P.fileIcon - 2 * P.treeGap - side;
    const tip = [
      e.name.length * 7.8 > room ? rel : "",
      ...(e.dir
        ? [...held, sum?.[0] || sum?.[1] ? `+${grouped(sum[0] ?? 0)} −${grouped(sum[1] ?? 0)}` : ""]
        : [words[status] ?? (ignored ? "Ignored by Git" : ""), meta && !this.showSize ? "" : e.mtime ? `Changed ${fullStamp(e.mtime)}` : ""]),
    ].filter(Boolean).join(" · ");
    return h_flex().id(`ft-${rel}`).h(P.tree).flex_none().relative().pl(P.rowPx + depth * P.indent).pr(P.rowPx).gap(P.treeGap).items_center().rounded(P.radius).cursor_pointer().when(Boolean(tip), (el) => el.tooltip(tip))
      .when(selected, (el) => el.bg(t.selected)).when(!selected, (el) => el.hover((s) => s.bg(t.hover)))
      .when(this.ringed(rel), (el) => el.child(this.ring(t, Math.min(R, 4))))
      .children(Array.from({ length: depth }, (_, d) => div().absolute().left(P.rowPx + d * P.indent + P.chevron / 2).top(0).bottom(0).w(1).bg(t.border)))
      .child(e.dir ? svg(UI(`caret-${open ? "down" : "right"}`)).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
      .child(image(iconOf(this.fileIcons, rel, e.dir, open, settings().dark !== false)).size(16).flex_none())
      .child(div().flex_1().min_w(0).truncate().font_family(codeFont()).text_color(nameColor)
        .when(status === "D" && !e.dir, (el) => el.line_through()).child(e.name + (e.link ? " ↪" : "")))
      .when(Boolean(meta), (el) => el.child(div().flex_none().text_size(11).text_color(t.muted).child(meta)))
      .when(Boolean(loc?.[0]), (el) => el.child(div().flex_none().text_size(11).text_color(t.ansi2).child(`+${loc[0]}`)))
      .when(Boolean(loc?.[1]), (el) => el.child(div().flex_none().text_size(11).text_color(t.ansi1).child(`−${loc[1]}`)))
      .when(this.statusLetter && !e.dir && Boolean(status), (el) => el.child(div().flex_none().w(10).text_size(P.secondary).font_semibold().text_color(gc).child(status)))
      .when(!counts && !status && ignored, (el) => el.child(div().flex_none().w(10).text_size(11).text_color(t.dim).child("⊘")));
  }

  // Branch, totals, a bar of modified / new / deleted, and its legend (§2.9, §4.3a).
  summary(t) {
    const g = this.git;
    if (!g.top) return h_flex().h(P.list).flex_none().px(P.px).gap(6).items_center().text_size(P.secondary).text_color(t.dim).border_b(1).border_color(t.border)
      .child(div().truncate().child(this.root ? "± no git repo · git status starts after git init" : ""));
    const totals = g.diff.get("") ?? [0, 0];
    const c = g.counts.get("") ?? [0, 0, 0], total = c[0] + c[1] + c[2];
    const parts = [[c[1], gitColor(t, "M"), "modified"], [c[0], t.ansi2, "new"], [c[2], t.ansi1, "deleted"]].filter(([n]) => n > 0);
    const room = Math.max(40, this.width - 2 * P.px - 2 * (parts.length - 1));
    // §2.9: no branch here (the sidebar row and the status bar show it); the counts, the totals, the bar.
    return v_flex().flex_none().pb(6).border_b(1).border_color(t.border)
      .child(h_flex().h(P.list).px(P.px).gap(10).items_center().text_size(P.secondary).text_color(t.muted)
        .when(!total, (el) => el.child(div().child("clean")))
        .children(parts.map(([n, color, word]) => h_flex().flex_none().gap(3).items_center().child(div().text_color(color).child(grouped(n))).child(word)))
        .child(div().flex_1())
        .when(Boolean(totals[0]), (el) => el.child(div().flex_none().text_color(t.ansi2).child(`+${grouped(totals[0])}`)))
        .when(Boolean(totals[1]), (el) => el.child(div().flex_none().text_color(t.ansi1).child(`−${grouped(totals[1])}`))))
      .child(total
        ? h_flex().mx(P.px).h(2).gap(1).children(parts.map(([n, color]) => div().h_full().w(Math.max(3, (room * n) / total)).bg(color)))
        : div().mx(P.px).h(2).bg(t.raised));
  }

  footer(t) {
    if (!this.cursor) return null;
    return h_flex().h(24).flex_none().px(10).gap(8).items_center().text_size(11).border_t(1).border_color(t.border)
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(this.cursor));
  }

  renderAsk() {
    const close = () => closeOverlay(props().overlay);
    const text = sendAsk(this.ask.abs);
    const yes = (cx) => { close(); sendToAgent(cx, this.ask.abs); };
    return div().size_full().track_focus(this.handle)
      .on_key_down((ev, cx) => { if (confirmKey(ev.key, () => yes(cx), close)) cx.stop_propagation(); })
      .child(confirmView({ id: `${NAME}-send`, ...text, onConfirm: yes, onCancel: close, mono: codeFont() }));
  }

  renderMenu(cx) {
    const entries = menuEntries(this.menu, this);
    const close = () => closeOverlay(props().overlay);
    const run = (e, cx) => { close(); e.run(cx); };
    return div().size_full().track_focus(this.handle)
      .on_key_down((ev, cx) => {
        const next = menuKey(entries, this.at, ev.key, (e) => run(e, cx), close);
        if (next === null) return;
        this.at = next; cx.stop_propagation(); cx.notify();
      })
      .child(menuView({ id: "ft-menu", entries, at: this.at, run, mono: codeFont() }));
  }

  render(cx) {
    if (this.ask) return this.renderAsk();
    if (this.menu) return this.renderMenu(cx);
    this.sync(cx);
    const req = shared(`${NAME}.preview`);
    if (req && req.n !== this.seenPreview) {
      this.seenPreview = req.n;
      if (req.root === this.root) { if (this.slotNode()) cx.spawn(async (cx) => { this.previewSlot(req.rel, cx, true); cx.notify(); }); else this.show(req.rel, cx, true); }
    }
    const tab = shared(`${NAME}.open`);
    if (tab && tab.n !== this.seenOpen) {
      this.seenOpen = tab.n;
      if (tab.root === this.root) cx.spawn(async (cx) => { this.openFile(tab.rel, cx); cx.notify(); });
    }
    // Another mod (session-bar's changed chip) asks for a view.
    const go = shared(`${NAME}.goto`);
    if (go && go.n !== this.seenGoto) { this.seenGoto = go.n; if (go.root === this.root) this.enterFolder(go.rel, cx); }
    const want = shared(`${NAME}.view`);
    if (want && want.n !== this.seenView) {
      this.seenView = want.n;
      if (VIEWS.some(([v]) => v === want.view) && want.view !== this.view) { this.view = want.view; this.hits = null; this.clearSelection(true); this.closePreview(); this.savePrefs(); }
    }
    const t = theme(), look = frameLook(), R = look.radius, now = Date.now();
    const rows = this.file ? [] : this.rows();
    if (this.scrollTo !== null && this.scrollTo !== undefined) {
      const at = rows.findIndex((r) => r.rel === this.scrollTo);
      if (at >= 0) { this.scroll.scroll_to_item(at, "center"); this.scrollTo = null; }
      else if (!this.pending.size && !this.loading) this.scrollTo = null;
    }
    const title = this.file ?? (this.root ? baseOf(this.root) : "Files");
    const btn = (id, label, tip, on, fn) => this.button(id, label, tip, on, fn, t, R);
    // Tools sit in the title row and change with the view.
    const tools = [
      btn("ft-up", ic("arrow-up"), `Up a folder${keyFor(`${NAME}.up`, window()?.platform === "macos") ? ` (${keyFor(`${NAME}.up`, window()?.platform === "macos")})` : ""}`, false, () => this.goUp()),
      btn("ft-home", ic("house-simple"), this.follow ? "Following the focused pane" : `Back to the focused pane's folder${keyFor(`${NAME}.follow`, window()?.platform === "macos") ? ` (${keyFor(`${NAME}.follow`, window()?.platform === "macos")})` : ""}`, this.follow, () => this.followPane()),
      btn("ft-hidden", ic(this.showHidden ? "eye" : "eye-slash"), this.showHidden ? "Hide dotfiles (.)" : "Show dotfiles (.)", this.showHidden, () => { this.showHidden = !this.showHidden; this.savePrefs(); }),
      btn("ft-size", ic("ruler"), this.showSize ? "Show dates" : "Show sizes", Boolean(this.showSize), () => { this.showSize = !this.showSize; this.savePrefs(); }),
      btn("ft-collapse", ic("arrows-in-line-vertical"), "Collapse all", false, (cx) => this.collapseAll(cx)),
    ];
    const header = h_flex().h(look.header).flex_none().px(P.px).gap(P.gap).items_center().bg(t.background).border_b(1).border_color(t.border).text_size(P.text)
      .when(Boolean(this.file), (el) => el.child(btn("ft-back", ic("caret-left"), "Back to the tree (Esc)", false, () => this.closePreview())))
      .when(Boolean(this.file), (el) => el.child(image(iconOf(this.fileIcons, this.file, false, false, settings().dark !== false)).size(14).flex_none()))
      .child(div().flex_1().min_w(0).truncate().font_family(codeFont()).text_color(this.file ? t.foreground : t.muted).child(title))
      .when(Boolean(this.file), (el) => el
        .when(!this.on, (el) => el.child(btn("ft-ext", ic("arrow-square-out"), "Open in default app (o)", false, () => openExternal(join(this.root, this.file)).catch(() => {}))))
        .child(btn("ft-copy", ic("copy"), "Copy path", false, (cx) => copy(cx, this.file)))
        .child(btn("ft-send", ic("paper-plane-right"), "Send to agent", false, (cx) => sendToAgent(cx, join(this.root, this.file)))))
      .when(!this.file, (el) => el
        .when(VIEWS.length > 1, (el) => el
          .child(h_flex().flex_none().gap(P.groupGap).items_center()
            .children(VIEWS.map(([id, label], i) => btn(`ft-tab-${id}`, ic("tree-structure"), `${label} (${i + 1})`, this.view === id, (cx) => this.setView(id, cx)))))
          .child(div().w(1).h(P.separator).flex_none().bg(t.border)))
        .child(h_flex().flex_none().gap(P.groupGap).items_center().children(tools)));


    const root = v_flex().id(NAME).size_full().min_h(0).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(13)
      .track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => { if (Math.abs(size.width - this.width) > 4) { this.width = size.width; cx.notify(); } })
      .child(header);

    if (this.file) {
      return root.child(this.code ? Editor.new(this.code).flex_1().min_h(0)
        : this.md !== null ? div().id("ft-md").flex_1().min_h(0).overflow_y_scrollbar().px(14).py(10).child(TextView.markdown("ft-md-text", this.md).selectable(true))
        : div().p(12).text_color(t.dim).child(this.fileError || "Loading file…"));
    }

    const q = this.query.trim();
    const note = this.error || (!this.root ? "No folder"
      : this.searching && !rows.length ? "Searching…" : this.hits ? (rows.length ? null : "No matches") : this.loading && !rows.length ? "Loading files…" : !rows.length ? "Empty folder" : null);
    return root
      .when(this.sel.size > 1, (el) => el.child(this.selectionBar(t)))
      .child(this.summary(t))
      .child(h_flex().flex_none().mx(6).my(4).gap(2).items_center()
        .child(h_flex().flex_1().min_w(0).h(24).px(8).gap(6).items_center().rounded(R).bg(t.canvas ?? t.background).border_1().border_color(this.typing ? t.accent : t.input ?? t.border).cursor_text()
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .child(svg(UI("magnifying-glass")).size(12).flex_none().text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12).text_color(t.foreground))
          .when(Boolean(this.query), (el) => el.child(div().id("ft-clear").flex_none().text_size(12).text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => this.clearSearch(cx)).child("×"))))
      )
      .child(div().flex_1().min_h(0).relative().px(4)
        .on_mouse_down("left", (e, cx) => {
          this.lastDown = { mods: e.modifiers, count: e.click_count };
          // Below the last row only: with the list scrolled it is taller than the view, so this never fires.
          if (this.sel.size && e.local_position && e.local_position.y > this.rows().length * ROW + 4) { this.clearSelection(); cx.notify(); }
        })
        // One more item at the end: panel.end of space, so the last row isn't flush with the
        // panel's edge and the end reads as the end (§4.5b B4).
        .child(v_virtual_list("ft-rows", rows.length + 1, [...rows.map(() => ROW), P.end], (i) => rows[i]?.rel ?? "ft-end", (range) => {
          const shown = rows.slice(range.start, Math.min(range.end, rows.length));
          this.visible = shown.filter((r) => r.e?.dir).map((r) => r.rel);
          const out = shown.map((r) => this.row(r, t, R, now));
          if (range.end > rows.length) out.push(div().id("ft-end").w_full().h(P.end));
          return out;
        }).track_scroll(this.scroll).size_full()
          .on_item_click((rel, cx) => this.press(rel, cx))
          .on_item_secondary_click((rel, _e, cx) => {
            const r = this.rows().find((x) => x.rel === rel);
            if (!r) return;
            if (this.sel.size > 1 && this.sel.has(rel)) this.openManyMenu();
            else { this.cursor = rel; this.anchor = rel; this.openMenu(rel, r.e.dir); }
            cx.notify();
          }))
        .child(Scrollbar.vertical("ft-rows").viewport_from_layout().absolute().inset_0())
        .when(Boolean(note), (el) => el.child(div().absolute().top(4).left(0).right(0).px(10).text_size(12).text_color(t.dim).child(note))))
      .when(this.limited, (el) => el.child(div().px(10).py(3).text_size(11).text_color(t.dim).child(`Folders show their first ${PER_FOLDER} entries`)))
      .when(Boolean(this.hits?.length >= FIND_LIMIT), (el) => el.child(div().px(10).py(3).text_size(11).text_color(t.dim).child(`First ${FIND_LIMIT} matches · Enter jumps to the selected one`)))
      .when(Boolean(this.cursor), (el) => el.child(this.footer(t)));
  }
}
