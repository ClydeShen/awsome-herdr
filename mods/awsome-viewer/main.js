// Awsome Viewer: a file browser and editor. One class plays three roles, each its own copy:
//   the sidebar        the tree, and the box for a prompt to an agent
//   a viewer           a file in a centre tab
//   the menu           a popup at the pointer on right-click
// shared("awsome-viewer.*") connects them. The class is built from:
//   files/reads.js        the folder tree and Git's view of it
//   files/file-icons.js   Awsome Icons' pictures, when it's installed
//   files/filter.js       what the filter matches, from a list of every file
//   actions/open.js       opening tabs, and handing a file to Awsome Changes
//   actions/outside.js    code editors, Finder/Explorer/the file manager
//   actions/agents.js     sending a file to an agent
//   actions/menus.js      popup menus
//   views/tree.js, filter.js, tools.js, viewer.js, context-menu.js   the drawing
//   views/keys.js         the tree from the keyboard
// files/model.js says what the data means; views/ui.js holds every look but the token
// colours: syntax.js colours the file view's code, and Awsome Changes has the same file.
import { View } from "gpui-kit";
import { InputState, ScrollHandle, TextareaState } from "gpui-base";
import { appHome, checking, exec, nextCommand, props, setShared, shared, spaces, window } from "herdr";
import { zoomOut } from "./actions/zoom.js";
import { loadSettings, duration } from "./settings.js";
import { followFileIcons } from "./files/file-icons.js";
import { readMethods } from "./files/reads.js";
import { pickCleanupListing } from "./files/shell.js";
import { openMethods } from "./actions/open.js";
import { outsideMethods } from "./actions/outside.js";
import { agentMethods } from "./actions/agents.js";
import { menuMethods } from "./actions/menus.js";
import { treeMethods } from "./views/tree.js";
import { filterMethods } from "./views/filter.js";
import { savedDotfiles, toolMethods } from "./views/tools.js";
import { keyMethods } from "./views/keys.js";
import { viewerMethods } from "./views/viewer.js";
import { contextMenuMethods } from "./views/context-menu.js";
import { askMethods, ANSWER } from "./views/ask.js";
import { pruneDrafts, writeDraft } from "./files/drafts.js";

const DEFAULT_SETTINGS = {
  refresh: { tree: "10s", file: "2s" },
  editors: [],
  fileManager: { name: "", command: [] },
  gutter: false,
  markdown: "code",
  wrap: "markdown",
  trimTrailingWhitespace: false,
  insertFinalNewline: false,
};
const SYNC_MS = 300;
const CLEANUP_KEY = "awsome-viewer.cleanup";
const CLEANUP_OVERFLOW = "awsome-viewer.cleanupOverflow";
const CLEANUP_GENERATION = "awsome-viewer.cleanupGeneration";
const CLEANUP_LIMIT = 256;
const CLEANUP_DELAY_MS = 10000;
const CLEANUP_BATCH = 32;
const CACHE_COPY = /^mods\/awsome-viewer\/\.cache\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;
const SWEEP_COPY = /^v[a-z0-9]+(?:-m\d+)?-(?:\d+|[0-9a-f]{16})-\d+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\.part)?$/i;
let cleanupWorker = null;
const cacheOwners = new Set();
const cleanupProtectedOwners = new Set();

class AwsomeViewer extends View {
  init(given, cx) {
    const p = props() ?? given ?? {};
    this.mode = p.mode ?? "sidebar";
    // The layout's preview column: a viewer with no tab of its own (views/viewer.js SLOT).
    if (this.mode === "slot") { this.mode = "viewer"; this.slot = true; p.viewer = "slot"; }
    // A question from an editor (views/ask.js), drawn as a dialog.
    if (this.mode === "ask") {
      this.askFor = p.ask;
      this.askFocus = cx.focus_handle();
      this.askFocus.focus();
      return;
    }
    if (this.mode === "menu") {
      this.menuTarget = p.target;
      this.menuSpace = spaces().find((s) => s.active)?.id;
      return;
    }
    if (checking()) {
      if (this.mode === "sidebar") this.initSidebar(cx, true);
      return;
    }
    this.menuFocus = cx.focus_handle();
    // Awsome Tabs draws this on a file's tab.
    setShared("mod-icons", {
      ...(shared("mod-icons") ?? {}),
      "awsome-viewer": "mods/awsome-viewer/icons/file.svg",
    });
    followFileIcons(this, cx);
    if (this.mode === "viewer") return this.initViewer(p, cx);
    this.initSidebar(cx);
  }

  initViewer(p, cx) {
    this.viewerId = p.viewer;
    if (this.viewerId) cacheOwners.add(this.viewerId);
    this.viewerSpace = p.space;
    this.viewerFile = p.file;
    this.gutterOn = DEFAULT_SETTINGS.gutter;
    this.markdownDefault = DEFAULT_SETTINGS.markdown;
    this.wrapSetting = DEFAULT_SETTINGS.wrap;
    this.trimOnSave = DEFAULT_SETTINGS.trimTrailingWhitespace;
    this.finalNewlineOnSave = DEFAULT_SETTINGS.insertFinalNewline;
    this.hunks = [];
    this.openHunks = new Set();
    // The preview's position, so an `#anchor` link can scroll it. A handle must be made here.
    this.previewScroll = ScrollHandle.new();
    // The preview column's own focus, for when it shows no editor (docs/REQUIREMENTS.md 4.4b).
    if (this.slot) this.slotFocus = cx.focus_handle();
    // A zoom doesn't outlive the column: after a restart, a layout switch or a reload the blocks
    // it hid come back.
    if (this.slot) zoomOut();
    this.syncViewer(cx);
    cx.timer.every(SYNC_MS, (cx) => this.syncViewer(cx));
    // Keys from keys.json's "mod:awsome-viewer" section (docs/REQUIREMENTS.md section 4.8). Every
    // shown viewer hears them; the one whose editor has the keyboard acts.
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        if (this.closed) continue;
        // pane.go onto the preview column (mod.json "focusable"); a tab's viewer is a pane.
        if (command === "focus") {
          if (this.slot) this.takeFocus(cx);
          continue;
        }
        if (!this.editorFocused) continue;
        this.runCommand(command, cx);
      }
    });
    cx.spawn(async (cx) => {
      const { settings } = await loadSettings("awsome-viewer", DEFAULT_SETTINGS);
      this.markdownDefault = settings.markdown === "preview" ? "preview" : "code";
      this.wrapSetting = settings.wrap;
      this.trimOnSave = Boolean(settings.trimTrailingWhitespace);
      this.finalNewlineOnSave = Boolean(settings.insertFinalNewline);
      // The setting only decides the first state, so an open editor is brought to it once here.
      if (this.code && this.wraps(this.file) !== this.wrapped) this.toggleWrap();
      cx.notify();
      // A view is made for one way of drawing (folding can't change once it's made), so a
      // setting other than the default starts the file over the other way.
      if (Boolean(settings.gutter) !== this.gutterOn) {
        this.gutterOn = Boolean(settings.gutter);
        this.hunks = [];
        this.code?.release();
        this.code = null;
        this.text = undefined;
        this.readFile(cx);
      }
      cx.timer.every(Math.max(500, duration(settings.refresh.file, 2000)), (cx) => {
        if (this.slot && !this.slotShown()) return;
        this.readFile(cx);
        this.readHunks(cx);
      });
    });
  }

  initSidebar(cx, checkingOnly = false) {
    this.startedAt = Date.now();
    this.saved = new Map();
    this.entries = new Map();
    this.folders = new Set();
    this.marks = {};
    this.editor = TextareaState.new({ placeholder: "What should it do with this?", rows: 3 });
    this.editor.on("change", (_e, cx) => cx.notify());
    this.filter = InputState.new({ placeholder: "Filter files" });
    this.filter.on("change", (_e, cx) => {
      // New words, new matches: the arrows start again from the top.
      this.cursor = null;
      this.ensureIndex(cx);
      cx.notify();
    });
    this.filter.on("submit", (_e, cx) => this.openFirstMatch(cx));
    this.filter.on("focus", (_e, cx) => {
      this.filterFocused = true;
      cx.notify();
    });
    this.filter.on("blur", (_e, cx) => {
      this.filterFocused = false;
      cx.notify();
    });
    this.treeScroll = ScrollHandle.new();
    this.treeFocus = cx.focus_handle();
    this.dotfiles = savedDotfiles();
    if (checkingOnly) return;
    // Drafts untouched for 30 days go, once per start.
    cx.spawn(async () => pruneDrafts());
    this.refresh(cx);
    this.findAwsomeChanges(cx);
    this.findNewAgents(this.on, cx);
    this.agentsOn = this.on ?? null;
    cx.timer.every(SYNC_MS, (cx) => this.follow(cx));
    cx.spawn(async (cx) => {
      const { settings, problems } = await loadSettings("awsome-viewer", DEFAULT_SETTINGS);
      for (const problem of problems) console.warn(`awsome-viewer mod.json settings: ${problem}`);
      // String entries are macOS app IDs (dev.zed.Zed); objects with a bundle or exe are kept as they are.
      const extra = (Array.isArray(settings.editors) ? settings.editors : [])
        .map((e) => (typeof e === "string" ? { name: e.split(".").pop(), bundle: e } : e))
        .filter((e) => e && typeof e === "object" && (e.bundle || e.exe));
      this.findEditors(cx, extra);
      this.shareFileManager(settings.fileManager);
      cx.timer.every(Math.max(1000, duration(settings.refresh.tree, 10000)), (cx) => this.refresh(cx));
    });
    cx.spawn(async (cx) => {
      // "focus" gives the tree the keyboard, for a key bound to awsome-viewer.focus.
      for (;;) {
        const command = await nextCommand();
        if (command === "refresh") this.refresh(cx);
        else if (command === "focus") this.focusTree(cx);
      }
    });
  }

  // A closing tab takes its copies of images with it, and any copy still being made when it
  // closes goes as soon as it's done. Pictures from the web stay: every tab shares them, and
  // they're downloaded again after a day.
  async close() {
    // Esc and Herdr's own closing don't pass through the dialog's buttons: closing is "Cancel".
    if (this.mode === "ask") {
      if (!this.answered) setShared(ANSWER, { viewer: this.askFor.viewer, at: this.askFor.at, choice: "cancel" });
      return;
    }
    // Unsaved edits become a draft first: what comes after may not get the time.
    if (this.mode === "viewer" && this.dirty()) {
      const { raw, eol } = this;
      await this.draftWork(() => writeDraft(this.file, { raw: this.deleted ? null : raw, text: this.code.value(), eol }));
    }
    // Its items leave the status bar with it.
    if (this.mode === "viewer" && this.isActive()) this.writeStatus([]);
    this.closed = true;
    if (cleanupWorker?.owner === this) cleanupWorker = null;
    this.watchRequest?.cancel?.();
    this.watchRequest = null;
    if (this.imageReading || this.markdownLocalPending?.size) this.markCleanupPending(true);
    cacheOwners.delete(this.viewerId);
    if (cleanupProtectedOwners.delete(this.viewerId)) this.markCleanupPending(false);
    const copies = [...new Set([this.imageCopy, ...(this.imageCopies ?? []), ...(this.markdownCopies?.values() ?? [])])].filter((c) => c && !c.startsWith("mods/awsome-viewer/.cache/web-"));
    this.queueCleanup(copies);
    if (await this.dropCopies(copies)) {
      this.imageCopies?.clear();
      this.imageCopy = null;
      const queue = shared(CLEANUP_KEY);
      if (Array.isArray(queue)) setShared(CLEANUP_KEY, queue.filter(path => !copies.includes(path)));
    }
  }

  queueCleanup(copies) {
    const queue = shared(CLEANUP_KEY);
    const previous = Array.isArray(queue) ? queue.filter(path => typeof path === "string" && CACHE_COPY.test(path)) : [];
    const all = [...new Set([...previous, ...copies.filter(path => CACHE_COPY.test(path))])];
    if (all.length > CLEANUP_LIMIT) this.markCleanupPending(false);
    setShared(CLEANUP_KEY, all.slice(0, CLEANUP_LIMIT));
  }

  markCleanupPending(wait) {
    setShared(CLEANUP_GENERATION, (Number(shared(CLEANUP_GENERATION)) || 0) + 1);
    setShared(CLEANUP_OVERFLOW, true);
    if (wait) setShared("awsome-viewer.cleanupNotBefore", Math.max(Number(shared("awsome-viewer.cleanupNotBefore")) || 0, Date.now() + 15000));
  }

  releaseCacheOwner() {
    cacheOwners.delete(this.viewerId);
  }

  retryCleanup(cx) {
    if (this.closed) return;
    let queue = shared(CLEANUP_KEY);
    if (Array.isArray(queue) && queue.length > CLEANUP_LIMIT) {
      this.queueCleanup([]);
      queue = shared(CLEANUP_KEY);
    }
    const overflow = shared(CLEANUP_OVERFLOW) === true;
    if (cleanupWorker || Date.now() < (this.cleanupNext ?? 0) || (!Array.isArray(queue) && !overflow)) return;
    if (Date.now() < (Number(shared("awsome-viewer.cleanupNotBefore")) || 0)) return;
    const viewers = shared("awsome-viewer.viewers") ?? {};
    const active = [...Object.keys(viewers), ...cacheOwners];
    if (this.mode === "viewer" && this.viewerId) active.push(this.viewerId);
    const batch = (Array.isArray(queue) ? queue : []).filter(path => typeof path === "string" && CACHE_COPY.test(path) &&
      !active.some(id => path.startsWith(`mods/awsome-viewer/.cache/${id}-`))).slice(0, CLEANUP_BATCH);
    if (!batch.length && !overflow) return;
    this.cleanupNext = Date.now() + CLEANUP_DELAY_MS;
    const worker = { owner: this };
    cleanupWorker = worker;
    cx.spawn(async () => {
      try {
        if (batch.length) {
          const failed = [];
          for (const path of batch) {
            const owners = [...cacheOwners, ...Object.keys(shared("awsome-viewer.viewers") ?? {})];
            if (cleanupWorker !== worker) return;
            if (owners.some(id => path.startsWith(`mods/awsome-viewer/.cache/${id}-`)) || !(await this.dropCopies([path]))) failed.push(path);
            if (cleanupWorker !== worker) return;
          }
          const latest = shared(CLEANUP_KEY);
          if (Array.isArray(latest)) {
            setShared(CLEANUP_KEY, latest.filter(path => !batch.includes(path)));
            this.queueCleanup(failed);
          }
        }
        if (overflow && Date.now() >= (Number(shared("awsome-viewer.cleanupNotBefore")) || 0)) await this.sweepCleanup(active, worker);
      } finally {
        if (cleanupWorker === worker) cleanupWorker = null;
      }
    });
  }

  async sweepCleanup(active, worker) {
    const generation = Number(shared(CLEANUP_GENERATION)) || 0;
    if (this.cleanupGeneration !== generation) {
      this.cleanupGeneration = generation;
      this.cleanupOffset = 0;
      this.cleanupSawCopies = false;
      this.cleanupSawProtected = false;
      this.cleanupConfirmEmpty = false;
    }
    const offset = this.cleanupOffset ?? 0;
    const { program, args } = pickCleanupListing(`${appHome()}/mods/awsome-viewer/.cache`, offset, window()?.platform);
    const result = await exec(program, args, {}).catch(() => null);
    if (cleanupWorker !== worker || result?.code !== 0 || generation !== (Number(shared(CLEANUP_GENERATION)) || 0) ||
      Date.now() < (Number(shared("awsome-viewer.cleanupNotBefore")) || 0)) return;
    const viewers = shared("awsome-viewer.viewers") ?? {};
    active = [...new Set([...active, ...Object.keys(viewers), ...cacheOwners])];
    for (const id of cleanupProtectedOwners) if (!active.includes(id)) cleanupProtectedOwners.delete(id);
    const fields = result.stdout.split("\0");
    const count = (fields.length - 1) / 2;
    const consumed = Math.min(count, CLEANUP_BATCH);
    const names = [];
    for (let i = 0; i < consumed * 2; i += 2) {
      const name = fields[i + 1];
      if (fields[i] !== "f" || !SWEEP_COPY.test(name)) continue;
      const owners = active.filter(id => name.startsWith(`${id}-`));
      if (owners.length) {
        this.cleanupSawProtected = true;
        for (const id of owners) cleanupProtectedOwners.add(id);
      } else names.push(`mods/awsome-viewer/.cache/${name}`);
    }
    let removed = 0;
    if (names.length) {
      this.cleanupSawCopies = true;
      this.cleanupConfirmEmpty = false;
      for (const path of names) {
        if (cleanupWorker !== worker || generation !== (Number(shared(CLEANUP_GENERATION)) || 0)) return;
        const owners = [...cacheOwners, ...Object.keys(shared("awsome-viewer.viewers") ?? {})];
        const protectedBy = owners.filter(id => path.startsWith(`mods/awsome-viewer/.cache/${id}-`));
        if (protectedBy.length) {
          this.cleanupSawProtected = true;
          for (const id of protectedBy) cleanupProtectedOwners.add(id);
        } else {
          if (await this.dropCopies([path])) removed++;
          if (cleanupWorker !== worker || generation !== (Number(shared(CLEANUP_GENERATION)) || 0)) return;
        }
      }
    }
    if (count > consumed) this.cleanupOffset = offset + consumed - removed;
    else {
      this.cleanupOffset = 0;
      if (!this.cleanupSawCopies && !this.cleanupSawProtected && !(shared(CLEANUP_KEY)?.length)) {
        if (this.cleanupConfirmEmpty && generation === (Number(shared(CLEANUP_GENERATION)) || 0) &&
          Date.now() >= (Number(shared("awsome-viewer.cleanupNotBefore")) || 0)) setShared(CLEANUP_OVERFLOW, false);
        else this.cleanupConfirmEmpty = true;
      } else this.cleanupConfirmEmpty = false;
      this.cleanupSawCopies = false;
      this.cleanupSawProtected = false;
    }
  }

  // Keeps up with the focused pane, tabs closing, and questions left by the menu.
  follow(cx) {
    this.retryCleanup(cx);
    if (this.placeKey() !== this.key) {
      this.refresh(cx);
      if ((this.on ?? null) !== this.agentsOn) {
        this.agentsOn = this.on ?? null;
        this.findNewAgents(this.on, cx);
      }
    }
    this.pruneViewers();
    this.syncCompose(cx);
  }

  render() {
    if (this.mode === "ask") return this.askView();
    if (this.mode === "menu") return this.menuView();
    if (this.mode === "viewer") return this.viewerView();
    return this.sidebarView();
  }
}

Object.assign(
  AwsomeViewer.prototype,
  readMethods,
  openMethods,
  outsideMethods,
  agentMethods,
  menuMethods,
  treeMethods,
  filterMethods,
  toolMethods,
  keyMethods,
  viewerMethods,
  contextMenuMethods,
  askMethods,
);

export default AwsomeViewer;
