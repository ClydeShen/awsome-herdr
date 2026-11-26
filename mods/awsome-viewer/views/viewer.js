// A file in the centre pane or the preview column, editable in Herdr's editor where it can be
// saved (docs/REQUIREMENTS.md section 4.8), following the file as it changes on disk.
import { div, image } from "gpui-kit";
import { h_flex, v_flex, Editor, EditorState, Input, InputState, Scrollbar, v_virtual_list } from "gpui-base";
import { appHome, exec, focused, layout, notify, panes, readTextFile, run, setShared, shared, spaces, theme, window, writeTextFile } from "herdr";

// The preview column of the layout (docs/REQUIREMENTS.md section 4.4a): one viewer that shows the
// file any mod wrote to this key, { space, file: { path, root, on } }. It has no tab, so the
// tab registry, claiming and pruning below never see it.
export const SLOT = "awsome-viewer.slot";
export const SLOT_NODE = "preview";
import {
  baseName,
  buildRows,
  fileLinesOf,
  hunkKey,
  isImage,
  isMarkdown,
  REFERENCE,
  languageOf,
  markdownBlocks,
  parentOf,
  parseHunks,
  joinText,
  resolvePath,
  splitText,
  viewable,
} from "../files/model.js";
import { WHOLE_FILE_LINES, fenceLanguage, languageOf as lexerLanguage, syntaxColors, tokenizeLine } from "../syntax.js";
import { viewerEntries } from "../actions/open.js";
import { BUSY, pickCopyImage, pickFetchImage, pickRm } from "../files/shell.js";
import { editorId, foundEditors } from "../actions/outside.js";
import { fileIcon, isLight } from "../files/file-icons.js";
import { deleteDraft, readDraft, writeDraft } from "../files/drafts.js";
import { TEXT, FileIcon, Icon, IconButton, Markdown, Message, MenuButton, PaneButton, TextButton, codeFont, codeSize } from "./ui.js";
import {
  toggleComment,
  moveLines,
  duplicateLines,
  deleteLines,
  insertLine,
  selectLine,
  indentLines,
  toggleBlockComment,
  matchBracket,
  joinLines,
  trimTrailing,
  withFinalNewline,
} from "../files/edits.js";
import { commentTokens } from "../files/comments.js";
import detectIndent from "../files/detect-indent.js";

const CHAR_WIDTH = 0.62; // Of the code font's size, to size the sideways scroll.
const LINE_COLUMNS = 6; // The number column and a margin, in the same units.
const rowHeight = () => Math.round(codeSize() * 1.6);
const REMOVED_ROW = 8;
const COLOR_CHARS = 4000;
const COLOR_TICK_MS = 16;
const DRAFT_MS = 1000;
// The operation bar: Herdr's changes mod commit bar (p 10, gap 8, 32px input radius 8, text 12), label as its prompt's (11.5 dim); docs/REQUIREMENTS.md section 4.8.
const LINE_BAR = { pad: 10, gap: 8, input: 32, radius: 8, text: 12, label: 11.5, button: 14 };

// Copies go in a hidden folder: saving any other file in a mod's folder makes Herdr reload
// the mod, which threw the tree away on every picture opened. The copy itself, and how it's
// named, is in files/shell.js.
const CACHE = "mods/awsome-viewer/.cache";
const extension = (path) => path.split(".").pop().toLowerCase();
const absolute = (copy) => (copy ? `${appHome()}/${copy}` : "");
const COPIED_MS = 1500;

// The editor's items on the status bar (docs/REQUIREMENTS.md section 4.9). Only the viewer whose
// editor had focus last is active, and only it lists items or handles their clicks.
const ACTIVE = "awsome-viewer.active";
const STATUS = "awsome-statusline.items";
const CLICK = "awsome-statusline.click";
const ITEM_PREFIX = "awsome-viewer.";
const INDENT_ICON = "mods/awsome-viewer/icons/text-indent.svg";
const WRAP_ICON = "mods/awsome-viewer/icons/arrow-u-down-left.svg";
const READ_ONLY_ICON = "mods/awsome-viewer/icons/pencil-simple-slash.svg";

// Line and column from 1, as the status bar and Go to Line show them, and the selection's length.
const cursorAt = (text, range) => {
  const before = text.slice(0, range.end);
  return {
    line: before.split("\n").length,
    column: range.end - (before.lastIndexOf("\n") + 1) + 1,
    selected: Math.abs(range.end - range.start),
  };
};

// A short, stable name for a web address, so the same badge is one file in the cache.
const webName = (url) => {
  let hash = 2166136261;
  for (let i = 0; i < url.length; i++) hash = Math.imul(hash ^ url.charCodeAt(i), 16777619);
  return `web-${(hash >>> 0).toString(16)}`;
};

export const viewerMethods = {
  // What this tab shows: the registry, then what it was opened with, after a restart.
  viewerEntry() {
    if (this.slot) return shared(SLOT) ?? null;
    return viewerEntries()[this.viewerId] ?? null;
  },

  // The preview column reads and draws a file only while it is shown and the file belongs to the
  // space on screen; another space's file comes back when that space does.
  slotShown() {
    const entry = shared(SLOT);
    const find = (node) => (node?.id === SLOT_NODE ? node : (node?.children ?? []).map(find).find(Boolean));
    return !find(layout()).hidden && Boolean(entry?.file) && entry.space === spaces().find((s) => s.active).id;
  },

  // Runs as the tab opens, which is when the focused tab is its own.
  claimTab() {
    if (this.slot) return;
    const entry = this.viewerEntry();
    const where = this.tabSpaces();
    const holds = (other) => Boolean(other.tab) && !this.wrongTab(other, where);
    // A tab recorded from another space isn't this one, so it keeps looking for its own.
    if (entry && holds(entry)) return;
    const space = entry?.space ?? this.viewerSpace;
    const tab = focused()?.tab;
    if (!tab || !panes().some((p) => p.tab === tab && p.mod === "awsome-viewer")) return;
    // Focus can sit in another space while this tab opens; that space's tab isn't this one.
    if ((where.get(tab) ?? space) !== space) return;
    const rest = Object.entries(viewerEntries()).filter(([id]) => id !== this.viewerId).map(([, other]) => other);
    // A tab reopened behind another one must not take that one's place.
    if (rest.some((other) => holds(other) && other.tab === tab)) return;
    if (entry?.others?.includes(tab)) return;
    // Nor may it take the tab of a viewer here asked for after it, which hasn't claimed one yet.
    const unclaimed = (other) => (other.tab ? !holds(other) : this.viewerIsLive(other));
    const newer = (other) => other.space === space && (other.at ?? 0) > (entry?.at ?? 0) && unclaimed(other);
    if (rest.some((other) => newer(other) && other.others && !other.others.includes(tab))) return;
    // A click skips a viewer while its tab is wrong, so the space may have a new shared tab
    // by now; then this one becomes a tab you keep, leaving one shared tab per space.
    const sharedHere = rest.some(
      (other) => other.space === space && other.preview && this.viewerIsLive(other) && !this.wrongTab(other, where),
    );
    this.setViewer(this.viewerId, {
      tab,
      space,
      file: entry?.file ?? this.viewerFile,
      preview: (entry?.preview ?? false) && !sharedHere,
    });
  },

  syncViewer(cx) {
    this.retryCleanup(cx);
    this.takeAnswer(cx);
    this.takeStatusClick(cx);
    this.keepDraft();
    this.syncStatus();
    if (this.slot && !this.slotShown()) return;
    this.claimTab();
    const file = this.viewerEntry()?.file ?? this.viewerFile;
    if (!file) return;
    if (file.path !== this.file?.path || file.root !== this.file?.root || file.on !== this.file?.on) {
      // The preview column asks before it lets go of edited text (docs/REQUIREMENTS.md 4.8);
      // until the answer comes it keeps showing the edited file.
      if (this.slot && this.dirty()) {
        this.askToLetGo(cx, () => {}, () => {
          const entry = shared(SLOT);
          if (entry) setShared(SLOT, { ...entry, file: { ...this.file } });
        });
        return;
      }
      this.file = { ...file };
      this.imageShown = null;
      this.imageFor = null;
      this.reading = null;
      this.diffing = null;
      this.text = undefined;
      this.problem = null;
      this.code?.release();
      this.code = null;
      // The operation bar closes silently: it belonged to the file before this one.
      if (this.lineInput) this.lineInput.release();
      Object.assign(this, { raw: undefined, base: undefined, eol: "\n", bom: false, baseEol: "\n", baseBom: false, truncated: false, deleted: false, editorFocused: false, draftText: undefined, draftAt: undefined, lineInput: null, lineBad: false, lineFocused: false });
      this.hunks = [];
      this.openHunks = new Set();
      this.readFile(cx);
      this.readHunks(cx);
      cx.notify();
    }
    this.publishHead();
    this.colorStep(cx);
  },

  // Asked on every check, not just when the text changes: a commit clears marks without
  // touching the file.
  readHunks(cx) {
    const file = this.file;
    if (!file || !this.gutterOn || this.diffing || isImage(file.path)) return;
    this.diffing = file;
    cx.spawn(async (cx) => {
      const git = (args) =>
        exec("git", ["--no-optional-locks", ...args], { cwd: file.root, on: file.on }).catch(() => null);
      let marks = [];
      const status = await git(["status", "--porcelain=v1", "--", file.path]);
      if (status?.code === 0 && status.stdout.startsWith("??")) {
        marks = [{ line: 0, count: Infinity, kind: "added", oldStart: 0, old: [] }];
      } else if (status?.code === 0 && status.stdout.trim()) {
        const diff = await git(["diff", "--no-color", "--no-ext-diff", "--no-textconv", "-U0", "HEAD", "--", file.path]);
        if (diff?.code === 0) marks = parseHunks(diff.stdout);
      }
      if (this.diffing === file) this.diffing = null;
      if (this.file !== file) return;
      if (JSON.stringify(marks) !== JSON.stringify(this.hunks)) {
        this.hunks = marks;
        cx.notify();
      }
    });
  },

  // Only a real change touches the view, so the place you're reading stays put. The editor
  // follows the file only while it has no unsaved edits; with edits it keeps them, and the
  // save finds the change (docs/REQUIREMENTS.md section 4.8).
  readFile(cx) {
    if (this.closed) return;
    const file = this.file;
    if (file && isImage(file.path)) return this.readImage(cx);
    if (!file || this.reading) return;
    this.reading = file;
    cx.spawn(async (cx) => {
      let raw;
      let shown;
      try {
        raw = await readTextFile(file.path, { on: file.on });
        shown = viewable(raw);
      } catch {
        shown = { problem: "This file can't be shown: it's too large, or can't be read." };
      }
      if (this.reading === file) this.reading = null;
      if (this.file !== file) return;
      // The first read of a file looks for a draft left when it last closed with unsaved edits.
      // `reading` holds the file meanwhile, so no other read starts and restores it twice.
      if (this.raw === undefined && !this.code && !this.gutterOn && !file.on && !shown.truncated) {
        this.reading = file;
        const draft = await readDraft(file);
        if (this.reading === file) this.reading = null;
        if (this.file !== file) return;
        if (draft) {
          this.restoreDraft(file, draft, raw);
          this.readMarkdownImages(cx);
          cx.notify();
          return;
        }
      }
      // A file deleted under an open editor keeps its text: saving makes it again.
      if (raw === null && this.code && this.editable()) {
        if (!this.deleted) {
          this.deleted = true;
          cx.notify();
        }
        return;
      }
      this.deleted = false;
      if (shown.problem) {
        this.problem = shown.problem;
        this.text = undefined;
        this.code?.release();
        this.code = null;
      } else if (this.gutterOn) {
        if (shown.text !== this.text) {
          this.problem = null;
          this.text = shown.text;
        }
      } else if (raw !== this.raw && !this.dirty()) {
        this.problem = null;
        const truncated = Boolean(shown.truncated);
        const { text, eol, bom } = truncated ? { text: shown.text, eol: "\n", bom: false } : splitText(raw);
        // Whether it can be edited is fixed when the editor is made, so a file that grew past
        // the limit gets a new one.
        if (this.code && truncated !== this.truncated) {
          this.code.release();
          this.code = null;
        }
        Object.assign(this, { raw, base: text, eol, bom, baseEol: eol, baseBom: bom, truncated, text });
        if (this.code) {
          const { start, end } = this.code.selected_range();
          this.code.set_value(text);
          this.code.set_selected_range({ start: Math.min(start, text.length), end: Math.min(end, text.length) });
        } else this.code = this.newCode(file, text);
      }
      this.readMarkdownImages(cx);
      cx.notify();
    });
  },

  // A file in this viewer can be changed: it's on this machine (writeTextFile has no `on`),
  // all of it was read, and it shows in the editor rather than as changed lines.
  editable() {
    return Boolean(this.file) && !this.file.on && !this.truncated && !this.gutterOn;
  },

  readOnlyReason() {
    if (!this.code || this.editable()) return null;
    if (this.file?.on) return "Read-only on another machine";
    if (this.truncated) return "Too large to edit";
    return null;
  },

  // Line endings and the byte order mark count too: changing them changes what a save writes.
  dirty() {
    return Boolean(this.code) && this.editable() && (this.code.value() !== this.base || this.eol !== this.baseEol || this.bom !== this.baseBom);
  },

  // The editor is what's on screen: not an image, a problem, the preview or changed lines.
  editorShown() {
    return Boolean(this.code) && !(this.file && isImage(this.file.path)) && !this.problem && this.text !== undefined && !this.showsPreview() && !this.gutterOn && (!this.slot || this.slotShown());
  },

  isActive() {
    return shared(ACTIVE) === this.viewerId;
  },

  // Each tick: the active viewer lists its items while an editor shows, and clears them once it
  // shows no editor (an image, the preview, a problem).
  syncStatus() {
    if (!this.isActive()) return;
    if (this.editorShown()) {
      this.statusShown = true;
      this.writeStatus([
        { id: "pos", side: "left", order: 30, keep: 90, text: this.cursorText(), tip: "Go to line" },
        { id: "ind", side: "left", order: 40, keep: 60, icon: INDENT_ICON, text: this.indentText(), tip: "Indentation", choices: this.indentChoices() },
        { id: "enc", side: "left", order: 50, keep: 40, text: this.bom ? "UTF-8 BOM" : "UTF-8", tip: "Encoding" },
        { id: "eol", side: "left", order: 60, keep: 70, text: this.eol === "\r\n" ? "CRLF" : "LF", tip: "Line endings", choices: [
          { id: "lf", label: "LF", checked: this.eol !== "\r\n" },
          { id: "crlf", label: "CRLF", checked: this.eol === "\r\n" },
        ] },
        { id: "wrap", side: "left", order: 70, keep: 30, icon: WRAP_ICON, tip: "Wrap lines", active: this.wrapped },
        ...(this.editable() ? [] : [{ id: "ro", side: "left", order: 80, keep: 20, icon: READ_ONLY_ICON, tip: this.readOnlyReason() }]),
      ]);
    } else if (this.statusShown) {
      this.statusShown = false;
      this.writeStatus([]);
    }
  },

  cursorText() {
    const { line, column, selected } = cursorAt(this.code.value(), this.code.selected_range());
    return `${line}:${column}${selected ? ` (${selected})` : ""}`;
  },

  // Without a type the file has no indentation found: spaces, 2, as Herdr's default.
  indentOf() {
    return this.indent.type ? this.indent : { type: "space", amount: 2 };
  },

  indentText() {
    const { type, amount } = this.indentOf();
    return type === "tab" ? `Tab ${amount}` : `${amount}`;
  },

  indentChoices() {
    const { type, amount } = this.indentOf();
    return [
      { id: "spaces", label: "Spaces", checked: type === "space" },
      { id: "tabs", label: "Tabs", checked: type === "tab" },
      "-",
      { id: "size:2", label: "2", checked: amount === 2 },
      { id: "size:4", label: "4", checked: amount === 4 },
      { id: "size:8", label: "8", checked: amount === 8 },
    ];
  },

  // Only written when it changed, and compared with the shared map itself: another viewer may have
  // written its own items since this one last did.
  writeStatus(items) {
    const all = shared(STATUS) ?? {};
    if (JSON.stringify(all["awsome-viewer"] ?? []) === JSON.stringify(items)) return;
    setShared(STATUS, { ...all, "awsome-viewer": items });
  },

  // A click on one of this viewer's items, taken here because the status bar's clicks would
  // otherwise be refused: a click moves focus off the editor.
  takeStatusClick(cx) {
    const click = shared(CLICK);
    if (!click?.item?.startsWith(ITEM_PREFIX) || !this.isActive() || !this.code) return;
    setShared(CLICK, null);
    this.statusClick(click, cx);
  },

  statusClick(click, cx) {
    const id = click.item.slice(ITEM_PREFIX.length);
    if (id === "pos") this.openLineBar(cx);
    else if (id === "wrap") this.toggleWrap();
    else if (id === "ind") this.setIndent(click.choice);
    else if (id === "eol") this.eol = click.choice === "crlf" ? "\r\n" : "\n";
    cx.notify();
  },

  // Changes what the Tab key inserts, not the text: the file's indentation is left as it is.
  setIndent(choice) {
    const current = this.indentOf();
    let next;
    if (choice === "spaces") next = { type: "space", amount: current.amount };
    else if (choice === "tabs") next = { type: "tab", amount: current.amount };
    else next = { type: current.type, amount: Number(choice.slice("size:".length)) };
    this.indent = next;
    this.code.set_tab_size(next.amount, next.type === "tab");
  },

  // Ctrl+S. The file goes back with its own line endings and byte order mark, and only if it
  // is still what was read: writeTextFile refuses a file that changed since.
  // `after(cx)` runs once the file is written.
  save(cx, after) {
    if (!this.code || !this.editable() || (!this.dirty() && !this.deleted)) return;
    this.cleanOnSave();
    this.write(cx, this.deleted ? null : this.raw, after);
  },

  // The save-time cleanups (Trim trailing whitespace, Insert final newline). They go into the
  // editor as one undo step, with the cursor kept, so the file on disk is what the editor shows.
  cleanOnSave() {
    const value = this.code.value();
    let next = value;
    if (this.trimOnSave && !isMarkdown(this.file.path)) next = trimTrailing(next);
    if (this.finalNewlineOnSave) next = withFinalNewline(next);
    if (next === value) return;
    const sel = this.code.selected_range();
    this.code.set_selected_range({ start: 0, end: value.length });
    this.code.replace(next);
    this.code.set_selected_range({ start: Math.min(sel.start, next.length), end: Math.min(sel.end, next.length) });
  },

  write(cx, expected, after) {
    const file = this.file;
    const value = this.code.value();
    const { eol, bom } = this;
    const out = joinText(value, eol, bom);
    cx.spawn(async (cx) => {
      try {
        await writeTextFile(file.path, out, expected);
      } catch (e) {
        if (this.file === file) await this.saveRefused(cx, file, expected, after, e);
        return;
      }
      if (this.file !== file) return;
      Object.assign(this, { raw: out, base: value, baseEol: eol, baseBom: bom, deleted: false });
      this.dropDraft();
      after?.(cx);
      cx.notify();
    });
  },

  // A refused write: if the file on disk is no longer what was read, ask before replacing it;
  // anything else (no permission, a full disk) says why.
  async saveRefused(cx, file, expected, after, error) {
    let now;
    try {
      now = await readTextFile(file.path);
    } catch {
      now = expected;
    }
    if (now === expected) {
      notify({ title: `Couldn't save ${baseName(file.path)}`, body: String(error?.message ?? error), level: "error" });
      return;
    }
    this.ask("conflict", baseName(file.path), (choice, cx) => {
      if (choice === "yes" && this.file === file) this.write(cx, now, after);
    });
  },

  // Unsaved edits are about to go: Save, Don't save (back to the file as read) or Cancel.
  askToLetGo(cx, done, cancel) {
    this.ask("unsaved", baseName(this.file.path), (choice, cx) => {
      if (choice === "yes") this.save(cx, done);
      else if (choice === "other") {
        this.dropDraft();
        this.code.set_value(this.base);
        this.text = this.base;
        this.eol = this.baseEol;
        this.bom = this.baseBom;
        done(cx);
      } else cancel?.(cx);
      cx.notify();
    });
  },

  // Draft file operations run one after another, so a write and a later delete can't land out
  // of order: a delete that overtook a write would leave a draft of edits already saved.
  draftWork(job) {
    this.draftJob = (this.draftJob ?? Promise.resolve()).then(job, job);
    return this.draftJob;
  },

  // Unsaved edits are copied to a draft as you type, not only when the viewer closes: at quit,
  // Herdr gives close() too little time to be sure a write finishes.
  keepDraft() {
    if (!this.code || !this.editable()) return;
    const file = this.file;
    if (this.dirty()) {
      const text = this.code.value();
      if (text === this.draftText || Date.now() - (this.draftAt ?? 0) < DRAFT_MS) return;
      this.draftText = text;
      this.draftAt = Date.now();
      const { raw, eol, bom } = this;
      this.draftWork(() => writeDraft(file, { raw: this.deleted ? null : raw, text, eol, bom }));
    } else this.dropDraft();
  },

  dropDraft() {
    if (this.draftText === undefined) return;
    this.draftText = undefined;
    const file = this.file;
    this.draftWork(() => deleteDraft(file));
  },

  // Puts a draft back into the editor. `raw` stays the text the draft was made from, so if the
  // file changed since, saving finds it and asks before overwriting.
  restoreDraft(file, draft, disk) {
    const saved = splitText(draft.raw ?? "");
    Object.assign(this, { raw: draft.raw, base: saved.text, baseEol: saved.eol, baseBom: saved.bom, eol: draft.eol, bom: draft.bom, truncated: false, deleted: disk === null, text: draft.text, problem: null });
    this.code = this.newCode(file, draft.text);
    this.draftText = draft.text;
    this.draftAt = Date.now();
    // A tab the preview column handed its edits to says nothing; anything else tells you.
    if (this.viewerEntry()?.carry) this.setViewer(this.viewerId, { carry: false });
    else notify({ title: `Restored unsaved changes to ${baseName(file.path)}`, level: "info" });
  },

  // The preview column's edits go to the new tab through a draft; the column goes back to the
  // file as it is on disk, so it never asks about edits it no longer holds.
  async handOverEdits() {
    const file = this.file;
    const { raw, eol, bom } = this;
    const text = this.code.value();
    await this.draftWork(() => writeDraft(file, { raw: this.deleted ? null : raw, text, eol, bom }));
    this.draftText = undefined;
    this.code.set_value(this.base);
    this.text = this.base;
    this.eol = this.baseEol;
    this.bom = this.baseBom;
  },

  closeSlot(cx) {
    const hide = () => run("layout.hide", { id: SLOT_NODE });
    if (this.dirty()) this.askToLetGo(cx, hide);
    else hide();
  },

  // A command from keys.json's "mod:awsome-viewer" section, for the viewer whose editor has the
  // keyboard (main.js). Each edit is one replace, so one Ctrl+Z takes it back.
  runCommand(command, cx) {
    if (!this.code || this.gutterOn || this.showsPreview()) return;
    if (command === "save") return this.save(cx);
    if (command === "goto") return this.openLineBar(cx);
    if (command === "wrap") return this.toggleWrap();
    const text = this.code.value();
    const sel = this.code.selected_range();
    // Moving the selection changes no text, so these work in a read-only viewer too.
    if (command === "selectLine") return this.moveSelection(selectLine(text, sel));
    if (command === "matchBracket") return this.moveSelection(matchBracket(text, sel));
    if (!this.editable()) return;
    if (command === "comment") this.applyEdit(toggleComment(text, sel, commentTokens(this.file.path)));
    else if (command === "moveUp") this.applyEdit(moveLines(text, sel, -1));
    else if (command === "moveDown") this.applyEdit(moveLines(text, sel, 1));
    else if (command === "duplicate") this.applyEdit(duplicateLines(text, sel));
    else if (command === "deleteLine") this.applyEdit(deleteLines(text, sel));
    else if (command === "insertBelow") this.applyEdit(insertLine(text, sel, 1));
    else if (command === "insertAbove") this.applyEdit(insertLine(text, sel, -1));
    else if (command === "indent") this.applyEdit(indentLines(text, sel, this.indentUnit(), 1));
    else if (command === "outdent") this.applyEdit(indentLines(text, sel, this.indentUnit(), -1));
    else if (command === "blockComment") this.applyEdit(toggleBlockComment(text, sel, commentTokens(this.file.path)?.block ?? null));
    else if (command === "joinLines") this.applyEdit(joinLines(text, sel));
  },

  applyEdit(edit) {
    if (!edit) return;
    this.code.set_selected_range({ start: edit.start, end: edit.end });
    this.code.replace(edit.replacement);
    this.code.set_selected_range(edit.select);
  },

  // Only the selection moves (selectLine, matchBracket), so no replace: it would fail in a read-only editor.
  moveSelection(edit) {
    if (edit) this.code.set_selected_range(edit.select);
  },

  // One level of indentation, as the file uses it (see newCode).
  indentUnit() {
    if (this.indent.type === "tab") return "\t";
    if (this.indent.type === "space") return " ".repeat(this.indent.amount);
    return "  ";
  },

  // Alt+Z: wraps only this viewer's file; the setting is left as it is.
  toggleWrap() {
    this.wrapped = !this.wrapped;
    this.code.set_soft_wrap(this.wrapped);
  },

  // The Wrap lines setting: "on" and "off" are for every file, "markdown" for Markdown only.
  wraps(file) {
    if (this.wrapSetting === "on") return true;
    if (this.wrapSetting === "off") return false;
    return isMarkdown(file.path);
  },

  // Ctrl+G: the operation bar under the header, for "line" or "line:column". Open already, it
  // takes the keyboard again with its text selected.
  openLineBar(cx) {
    if (this.lineInput) {
      this.lineInput.focus();
      this.lineInput.set_selected_range({ start: 0, end: this.lineInput.value().length });
      cx.notify();
      return;
    }
    const count = this.code.value().split("\n").length;
    const input = InputState.new({ placeholder: `line or line:column, 1–${count}` });
    input.on("change", (_e, cx) => {
      if (this.lineInput !== input) return;
      this.lineBad = false;
      cx.notify();
    });
    input.on("submit", (_e, cx) => {
      if (this.lineInput !== input) return;
      this.goToLine(cx);
    });
    input.on("focus", (_e, cx) => {
      if (this.lineInput !== input) return;
      this.lineFocused = true;
      cx.notify();
    });
    input.on("blur", (_e, cx) => {
      if (this.lineInput !== input) return;
      this.lineFocused = false;
      cx.notify();
    });
    this.lineInput = input;
    this.lineBad = false;
    this.lineFocused = true;
    input.focus();
    cx.notify();
  },

  // Esc and × close it; the editor gets the keyboard back.
  closeLineBar(cx) {
    if (!this.lineInput) return;
    this.lineInput.release();
    this.lineInput = null;
    this.code?.focus();
    cx.notify();
  },

  // Enter or Go: "line" or "line:column"; out-of-range numbers go to the first or last line, as in
  // VS Code. The text is split when the answer comes, since it may have changed since the bar opened.
  goToLine(cx) {
    const match = /^\s*(\d+)\s*(?::\s*(\d+)\s*)?$/.exec(this.lineInput.value());
    if (!match) {
      this.lineBad = true;
      cx.notify();
      return;
    }
    const lines = this.code.value().split("\n");
    const line = Math.min(Math.max(Number(match[1]), 1), lines.length);
    const column = Math.min(Math.max(match[2] ? Number(match[2]) : 1, 1), lines[line - 1].length + 1);
    const offset = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0) + column - 1;
    this.code.set_selected_range({ start: offset, end: offset });
    this.closeLineBar(cx);
  },

  // The bar's row: label, input, Go, and a close button (docs/REQUIREMENTS.md section 4.8).
  lineBar(t) {
    return h_flex()
      .id("viewer-line-bar")
      .flex_none()
      .p(LINE_BAR.pad)
      .gap(LINE_BAR.gap)
      .items_center()
      .border_b(1)
      .border_color(t.border)
      .on_key_down((e, cx) => {
        if (e.key === "escape") {
          this.closeLineBar(cx);
          cx.stop_propagation();
        }
      })
      .child(div().flex_none().text_size(LINE_BAR.label).text_color(t.dim).child("Line"))
      .child(
        div()
          .flex_1()
          .min_w(0)
          .h(LINE_BAR.input)
          .px(10)
          .flex()
          .items_center()
          .rounded(LINE_BAR.radius)
          .border_1()
          .border_color(this.lineBad ? t.ansi1 : this.lineFocused ? t.accent : t.border)
          .child(Input.new(this.lineInput).h_full().text_size(LINE_BAR.text).text_color(t.foreground)),
      )
      .child(
        h_flex()
          .id("viewer-line-go")
          .h(LINE_BAR.input)
          .px(LINE_BAR.button)
          .items_center()
          .rounded(LINE_BAR.radius)
          .border_1()
          .border_color(t.input)
          .bg(t.raised)
          .text_size(LINE_BAR.text)
          .cursor_pointer()
          .hover((s) => s.opacity(0.9))
          .on_click((_e, cx) => this.goToLine(cx))
          .child("Go"),
      )
      .child(PaneButton({ id: "viewer-line-close", icon: "x", label: "Close (Esc)", onClick: (cx) => this.closeLineBar(cx) }));
  },

  // Indentation follows the file, as VS Code's editor.detectIndentation does. Nothing found keeps
  // Herdr's 2 spaces (docs/REQUIREMENTS.md section 4.8).
  newCode(file, value) {
    const t = theme();
    const indent = detectIndent(value);
    this.indent = indent;
    this.wrapped = this.wraps(file);
    const code = EditorState.new({
      language: languageOf(file.path),
      readonly: !this.editable(),
      value,
      soft_wrap: this.wrapped,
      ...(indent.type === "space" ? { tab_size: Math.min(16, indent.amount) } : {}),
      hard_tabs: indent.type === "tab",
      font_family: codeFont(),
      font_size: codeSize(),
      syntax: {
        keyword: t.ansi5,
        string: t.ansi2,
        comment: t.dim,
        function: t.ansi4,
        type: t.ansi3,
        number: t.ansi1,
        constant: t.ansi6,
        boolean: t.ansi6,
        operator: t.ansi6,
        "string.escape": t.ansi6,
      },
    });
    // The rendered Markdown and the header's `*` follow what is typed; commands go to the
    // viewer whose editor has the keyboard.
    code.on("change", (_e, cx) => {
      if (this.code !== code) return;
      this.text = code.value();
      cx.notify();
    });
    code.on("focus", () => {
      if (this.code !== code) return;
      this.editorFocused = true;
      setShared(ACTIVE, this.viewerId);
    });
    code.on("blur", () => {
      if (this.code === code) this.editorFocused = false;
    });
    return code;
  },

  // What the pane's header row says, the same row a diff uses: file, folder, and whether
  // this is the shared tab. `*` marks unsaved edits (Notepad's mark: the sidebar's `●` already
  // means an agent wants you).
  viewerHead() {
    const file = this.file;
    if (!file) return null;
    const name = baseName(file.path);
    const folder = file.path.slice(file.root.length + 1, -name.length - 1);
    const picture = fileIcon(this.fileIcons, file.path, { light: isLight(theme().background) });
    return {
      title: `${this.dirty() ? "*" : ""}${name}`,
      detail: [folder, this.deleted ? "Deleted" : null, this.viewerEntry()?.preview ? "Preview" : null].filter(Boolean).join(" · "),
      // color: a full-colour picture, which Awsome Changes' pane header draws untinted.
      ...(picture ? { icon: picture, color: true } : { icon: "mods/awsome-viewer/icons/file.svg" }),
    };
  },

  publishHead() {
    // Never onto a tab in another space: that one has its own viewer.
    const entry = this.viewerEntry();
    const tab = entry && !this.wrongTab(entry) ? entry.tab : null;
    const pane = tab && panes().find((p) => p.mod === "awsome-viewer" && p.tab === tab)?.pane;
    const head = this.viewerHead();
    if (!pane || !head) return;
    const heads = shared("pane-heads") ?? {};
    if (JSON.stringify(heads[pane]) !== JSON.stringify(head))
      setShared("pane-heads", { ...heads, [pane]: head });
  },

  // Awsome Changes' pane header shows a published title. With any other header, the file
  // draws its own row, so there's always exactly one.
  headerShowsTitle() {
    const find = (node) =>
      node?.content?.pane?.header?.content?.mod ?? (node?.children ?? []).map(find).find(Boolean);
    return find(layout()) === "awsome-changes";
  },

  // The file as rows, the way Awsome Changes draws a diff. Herdr's editor can't mark a line,
  // and marks laid over it slid as it scrolled, but here a line's colour is part of its row.
  linesView() {
    const lines = this.fileLines();
    const runs = this.lineRuns(lines);
    const rows = buildRows(lines, this.hunks ?? [], this.openHunks);
    const height = rowHeight();
    const sized = rows.some((row) => row.type === "removed")
      ? rows.map((row) => (row.type === "removed" ? REMOVED_ROW : height))
      : height;
    const listId = `viewer-lines-${this.viewerId}-${this.file.path}`;
    const list = v_virtual_list(
      listId,
      rows.length,
      sized,
      (i) => rows[i].key,
      (range) => rows.slice(range.start, range.end).map((row) => this.fileRow(row, runs)),
    )
      // A handler per list, not per row: Herdr's virtual lists allow no handlers in a row.
      .on_item_click((key, cx) => this.toggleChange(rows.find((row) => row.key === key), cx))
      .size_full();
    const widest = lines.reduce((most, line) => Math.max(most, line.length), 0);
    return div()
      .id("viewer-lines")
      .flex_1()
      .min_h(0)
      .min_w(0)
      .relative()
      .font_family(codeFont())
      .text_size(codeSize())
      .child(
        div()
          .id("viewer-x")
          .size_full()
          .overflow_x_scrollbar()
          .child(
            div()
              .w_full()
              .min_w(Math.max(300, (widest * CHAR_WIDTH + LINE_COLUMNS) * codeSize()))
              .h_full()
              .child(list),
          ),
      )
      .child(Scrollbar.vertical(listId).viewport_from_layout().absolute().inset_0());
  },

  // Only a change that replaced something has anything to open.
  toggleChange(row, cx) {
    if (!row?.hunk?.old.length) return;
    const key = hunkKey(row.hunk);
    if (!this.openHunks.delete(key)) this.openHunks.add(key);
    cx.notify();
  },

  // Split once per version of the file: rows are drawn on every scroll.
  fileLines() {
    if (this.linesOf !== this.text) {
      this.linesOf = this.text;
      this.lines = fileLinesOf(this.text ?? "");
    }
    return this.lines;
  },

  // Coloured once per version too, top to bottom, so a comment or string opened on one
  // line is still one on the next, in steps by `colorStep`. Until those finish, and for a
  // huge file or one the lexer fails on, there are no runs here: rows are coloured one at a
  // time as they're drawn (`rowRuns`). The runs are kept only once they're complete, so a row
  // never shows another file's text.
  lineRuns(lines) {
    // Keyed on the path too: two files with the same text share `lines`, not a language.
    if (this.runsFor !== lines || this.runsPath !== this.file.path) {
      const path = this.file.path;
      this.runs = null;
      this.runsFor = lines;
      this.runsPath = path;
      if (lines.length <= WHOLE_FILE_LINES)
        this.colorLater(lines, lexerLanguage(path), {
          live: () => this.runsFor === lines && this.runsPath === path,
          done: (runs) => (this.runs = runs),
        });
    }
    return this.runs;
  },

  colorLater(lines, language, { live, done }) {
    (this.colorJobs ??= []).push({ lines, language, live, done, runs: [], state: null });
  },

  colorStep(cx) {
    const jobs = this.colorJobs;
    if (this.colorQueued || !jobs?.length) return;
    let budget = COLOR_CHARS;
    while (budget > 0 && jobs.length) {
      const job = jobs[0];
      if (!job.live()) {
        jobs.shift();
        continue;
      }
      try {
        while (budget > 0 && job.runs.length < job.lines.length) {
          const line = job.lines[job.runs.length];
          const result = tokenizeLine(line, job.language, job.state);
          job.state = result.state;
          job.runs.push(result.runs);
          budget -= line.length + 1;
        }
      } catch {
        jobs.shift();
        continue;
      }
      if (job.runs.length < job.lines.length) break;
      jobs.shift();
      job.done(job.runs);
      cx.notify();
    }
    if (!jobs.length) return;
    this.colorQueued = true;
    cx.timer.after(COLOR_TICK_MS, (cx) => {
      this.colorQueued = false;
      this.colorStep(cx);
    });
  },

  // One row's runs: from the whole-file pass when there is one, else that line on its own.
  rowRuns(row, lineRuns) {
    const runs = lineRuns?.[row.number - 1];
    if (runs) return runs;
    try {
      return tokenizeLine(row.text, lexerLanguage(this.file.path)).runs;
    } catch {
      return [{ text: row.text, kind: null }];
    }
  },

  fileRow(row, lineRuns) {
    const t = theme();
    if (row.type === "removed")
      return h_flex()
        .id(`viewer-${row.key}`)
        .h(REMOVED_ROW)
        .w_full()
        .items_center()
        .cursor_pointer()
        .child(div().h(2).w_full().bg(t.ansi1));
    const old = row.type === "old";
    const open = row.hunk && this.openHunks.has(hunkKey(row.hunk));
    // A line whose old version is showing reads as what replaced it.
    const color = old
      ? t.ansi1
      : row.hunk
        ? { added: t.ansi2, changed: open ? t.ansi2 : t.ansi3 }[row.hunk.kind]
        : null;
    const SYNTAX = syntaxColors(t);
    const runs = old ? [{ text: row.text, kind: "old" }] : this.rowRuns(row, lineRuns);
    return h_flex()
      .id(`viewer-${row.key}`)
      .h(rowHeight())
      .w_full()
      .items_center()
      .when(Boolean(color), (el) => el.bg(`${color?.slice(0, 7)}26`))
      .when(Boolean(row.hunk?.old.length), (el) => el.cursor_pointer())
      .child(
        div()
          .id(color && !old ? `viewer-mark-${row.number - 1}` : `viewer-bar-${row.key}`)
          .w(3)
          .h_full()
          .flex_none()
          .when(Boolean(color), (el) => el.bg(color)),
      )
      .child(
        div()
          .w(codeSize() * 3.5)
          .pr(codeSize())
          .flex_none()
          .text_right()
          .text_color(t.dim)
          .child(String(row.number)),
      )
      .child(
        h_flex()
          .flex_1()
          .min_w(0)
          .whitespace_nowrap()
          .children(
            runs.map((run) =>
              div()
                .flex_none()
                .whitespace_nowrap()
                .text_color(run.kind === "old" ? t.ansi1 : (SYNTAX[run.kind] ?? t.foreground))
                .child(run.text || " "),
            ),
          ),
      );
  },

  // Removes copies this tab made, given as paths under Herdr's folder.
  async dropCopies(copies) {
    if (!copies.length) return true;
    let removed = true;
    for (let i = 0; i < copies.length; i += 32) {
      const { program, args } = pickRm(copies.slice(i, i + 32).map(absolute), window()?.platform);
      const result = await exec(program, args, { timeout: 10000 }).catch(() => null);
      if (result?.code !== 0) removed = false;
    }
    return removed;
  },

  // Herdr only loads images from under its own folder, so the file is shown through a copy
  // in this mod's cache, named for what's in it. The copy it replaces goes once it's in.
  readImage(cx) {
    if (this.closed) return;
    const file = this.file;
    if (file.on || this.imageReading) return;
    if (this.imageFor !== file.path) {
      this.imageFor = file.path;
      this.imageShown = null;
    }
    this.imageReading = file;
    cx.spawn(async (cx) => {
      const { program, args } = pickCopyImage(file.path, absolute(CACHE), this.viewerId, extension(file.path), absolute(this.imageCopy), window()?.platform, Boolean(this.imageCopy));
      const result = await exec(program, args, { timeout: 10000 }).catch(() => null);
      const copy = result?.code === 0 ? `${CACHE}/${result.stdout.trim()}` : null;
      if (copy) {
        this.imageCopies ??= new Set();
        this.imageCopies.add(copy);
      }
      if (!this.closed && this.file === file && result?.code !== BUSY) {
        const problem = copy ? null : `This file is no longer available: ${file.path}`;
        if (problem !== this.problem || copy !== this.imageShown) {
          this.problem = problem;
          this.imageShown = copy;
          cx.notify();
        }
      }
      const obsolete = [...(this.imageCopies ?? [])].filter(path => this.closed || path !== this.imageShown);
      const batch = obsolete.slice(0, 32);
      const deferred = obsolete.slice(32);
      for (const path of batch) {
        const removed = await this.dropCopies([path]);
        this.imageCopies.delete(path);
        if (!removed) {
          if (this.closed) deferred.push(path);
          else this.imageCopies.add(path);
        }
      }
      this.queueCleanup(deferred);
      for (const path of deferred) this.imageCopies.delete(path);
      this.imageCopy = this.imageShown;
      if (this.imageReading === file) this.imageReading = null;
      if (this.closed) this.releaseCacheOwner();
      if (!this.closed && this.file !== file && this.file && isImage(this.file.path)) this.readImage(cx);
    });
  },

  // Another machine's file isn't on this one to load.
  imageView() {
    if (this.file.on) return Message("Images on another machine can't be shown here.");
    if (this.problem) return Message(this.problem);
    if (!this.imageShown) return Message("Loading…");
    return h_flex()
      .id("viewer-image")
      .flex_1()
      .min_h(0)
      .min_w(0)
      .p(16)
      .child(image(this.imageShown).flex_1().min_w(0).h_full());
  },

  // Preview or Code, chosen per tab and kept in the registry, else the setting (source first,
  // as VS Code opens Markdown: docs/REQUIREMENTS.md section 4.8).
  markdownView() {
    return this.viewerEntry()?.markdown ?? this.markdownDefault ?? "code";
  },

  showsPreview() {
    return Boolean(this.file && isMarkdown(this.file.path)) && this.markdownView() === "preview";
  },

  // Split once per version of the file, like the code view's lines.
  previewBlocks() {
    const key = `${this.file.path}\0${this.text}`;
    if (this.blocksOf !== key) {
      this.blocksOf = key;
      this.blocks = markdownBlocks(this.text ?? "", parentOf(this.file.path));
    }
    return this.blocks;
  },

  // Every picture a Markdown file shows, on its own line or in a row.
  markdownSources() {
    return this.previewBlocks().flatMap((block) =>
      block.type === "image" ? [block] : block.type === "images" ? block.rows.flatMap((row) => row.items) : [],
    );
  },

  // A Markdown file's pictures, copied into the cache the way the image viewer does. One from
  // this computer gets a name of its own for as long as the tab is open, and is checked whenever
  // the file is. The last copy stays on screen until the new one is in: a name shown before its
  // file is there would stay blank, as Herdr doesn't see the hidden folder change. One from the
  // web is downloaded once per tab, and kept for a day under a name of its address, so every
  // tab shares it.
  readMarkdownImages(cx) {
    if (this.closed) return;
    const file = this.file;
    if (!file || !isMarkdown(file.path) || this.text === undefined) return;
    this.markdownCopies ??= new Map();
    this.markdownShown ??= new Map();
    this.markdownCopying ??= new Set();
    this.markdownSlots ??= new Map();
    for (const { path, url } of this.markdownSources()) {
      const key = url ?? path;
      if (!key || this.markdownCopying.has(key) || (path && file.on) || (url && this.markdownShown.has(key))) continue;
      this.markdownCopying.add(key);
      if (url) {
        const base = absolute(`${CACHE}/${webName(url)}`);
        cx.spawn(async (cx) => {
          const { program, args } = pickFetchImage(url, base, window()?.platform);
          const result = await exec(program, args, {}).catch(() => null);
          this.markdownCopying.delete(key);
          const copy = result?.code === 0 ? result.stdout.trim() : "";
          if (copy.startsWith(`${appHome()}/`)) this.markdownCopies.set(key, copy.slice(appHome().length + 1));
          this.markdownShown.set(key, this.markdownCopies.has(key));
          cx.notify();
        });
        continue;
      }
      if (!this.markdownSlots.has(path)) this.markdownSlots.set(path, this.markdownSlots.size + 1);
      const start = `${this.viewerId}-m${this.markdownSlots.get(path)}`;
      this.markdownLocalPending ??= new Set();
      this.markdownLocalPending.add(path);
      cx.spawn(async (cx) => {
        const old = this.markdownCopies.get(path);
        const { program, args } = pickCopyImage(path, absolute(CACHE), start, extension(path), absolute(old), window()?.platform);
        const result = await exec(program, args, { timeout: 10000 }).catch(() => null);
        this.markdownCopying.delete(path);
        this.markdownLocalPending.delete(path);
        if (result?.code === BUSY) return;
        const copy = result?.code === 0 ? `${CACHE}/${result.stdout.trim()}` : null;
        if (copy && this.closed) {
          if (!(await this.dropCopies([copy]))) this.queueCleanup([copy]);
          return;
        }
        if (copy) this.markdownCopies.set(path, copy);
        if (this.markdownShown.get(path) !== Boolean(copy) || copy !== old) {
          this.markdownShown.set(path, Boolean(copy));
          cx.notify();
        }
      });
    }
  },

  // A web link opens in the browser, a link to a file here opens it like a click in the tree,
  // and `#anchor` scrolls to the heading it names. Other schemes do nothing.
  followLink(url, cx) {
    if (/^https?:\/\//i.test(url)) return cx.open_url(url);
    if (url.startsWith("#")) {
      let anchor = url.slice(1);
      try {
        anchor = decodeURIComponent(anchor);
      } catch {}
      const index = this.previewBlocks().findIndex((block) => block.anchor === anchor.toLowerCase());
      if (index >= 0) {
        this.previewScroll?.scroll_to_item(index);
        cx.notify();
      }
      return;
    }
    const file = this.file;
    const path = resolvePath(parentOf(file.path), url);
    if (!path || path === file.path) return;
    const root = path.startsWith(`${file.root}/`) ? file.root : parentOf(path);
    this.openFile({ path, root, on: file.on ?? null }, cx);
  },

  // One picture. In a row (`small`), one that's loading or missing shows its name in small
  // dim text instead of a message, so a row of badges stays a row.
  previewImage(item, id, small = false) {
    const t = theme();
    const name = item.alt || baseName(item.path ?? item.url);
    const note = (text) => (small ? div().flex_none().text_size(TEXT.caption).text_color(t.dim).child(text) : Message(text));
    if (item.path && this.file.on) return note(`${name}: images on another machine can't be shown here.`);
    const key = item.url ?? item.path;
    const shown = this.markdownShown?.get(key);
    if (shown === false) return note(small ? name : `${name} isn't available.`);
    if (!shown) return note(small ? name : "Loading…");
    const picture = image(this.markdownCopies.get(key))
      .flex_none()
      .max_w_full()
      .when(Boolean(item.width), (el) => el.w(item.width))
      .when(Boolean(item.height), (el) => el.h(item.height));
    if (!item.href) return picture;
    return div()
      .id(id)
      .flex_none()
      .cursor_pointer()
      .tooltip(item.href)
      .on_click((_e, cx) => this.followLink(item.href, cx))
      .child(picture);
  },

  // Lines of pictures, a row each: badges side by side, and a bullet where they were a list.
  previewImages(block, i) {
    const t = theme();
    return v_flex()
      .id(`viewer-images-${i}`)
      .w_full()
      .min_w(0)
      .flex_none()
      .gap(6)
      .children(
        block.rows.map((row, r) =>
          h_flex()
            .w_full()
            .min_w(0)
            .flex_wrap()
            .gap(6)
            .items_center()
            .when(row.bullet, (el) => el.child(div().flex_none().w(14).text_color(t.dim).child("•")))
            .children(row.items.map((item, n) => this.previewImage(item, `viewer-image-${i}-${r}-${n}`, true))),
        ),
      );
  },

  // A fenced block, drawn here rather than by TextView: the code font at the terminals' size,
  // the lexer's colours, the language at the top left and a copy button at the top right.
  previewCode(block, i) {
    const t = theme();
    const SYNTAX = syntaxColors(t);
    const lines = block.text.split("\n");
    if (!block.runs && !block.queued) {
      block.queued = true;
      if (lines.length <= WHOLE_FILE_LINES)
        this.colorLater(lines, fenceLanguage(block.lang), {
          live: () => this.blocks?.includes(block),
          done: (runs) => (block.runs = runs),
        });
    }
    const blockRuns = block.runs ?? lines.map((line) => [{ text: line, kind: null }]);
    const widest = lines.reduce((n, line) => Math.max(n, line.length), 0);
    const copied = this.copiedCode === i;
    return v_flex()
      .id(`viewer-code-${i}`)
      .w_full()
      .min_w(0)
      .flex_none()
      .rounded(6)
      .border_1()
      .border_color(t.border)
      .bg(t.raised)
      .child(
        h_flex()
          .h(26)
          .pl(10)
          .pr(2)
          .items_center()
          .justify_between()
          .child(div().text_size(TEXT.caption).text_color(t.dim).child(block.lang || " "))
          .child(
            IconButton({
              id: `viewer-code-copy-${i}`,
              icon: copied ? "check" : "copy",
              label: copied ? "Copied" : "Copy code",
              small: true,
              onClick: (cx) => {
                cx.write_to_clipboard(block.text);
                this.copiedCode = i;
                cx.timer.after(COPIED_MS, (cx) => {
                  if (this.copiedCode !== i) return;
                  this.copiedCode = null;
                  cx.notify();
                });
                cx.notify();
              },
            }),
          ),
      )
      .child(
        div()
          .id(`viewer-code-lines-${i}`)
          .w_full()
          .overflow_x_scrollbar()
          .px(10)
          .pb(8)
          .child(
            v_flex()
              .min_w(Math.ceil(widest * CHAR_WIDTH * codeSize()))
              .font_family(codeFont())
              .text_size(codeSize())
              .children(
                blockRuns.map((runs) =>
                  h_flex()
                    .h(rowHeight())
                    .items_center()
                    .whitespace_nowrap()
                    .children(
                      runs.map((run) =>
                        div()
                          .flex_none()
                          .whitespace_nowrap()
                          .text_color(SYNTAX[run.kind] ?? t.foreground)
                          .child(run.text || " "),
                      ),
                    ),
                ),
              ),
          ),
      );
  },

  previewView() {
    // `#anchor` links scroll to their heading's block, a direct child of this list.
    return v_flex()
      .id("viewer-preview")
      .flex_1()
      .min_h(0)
      .min_w(0)
      .overflow_y_scrollbar()
      .when(Boolean(this.previewScroll), (el) => el.track_scroll(this.previewScroll))
      .px(24)
      .py(16)
      .gap(12)
      .children(
        this.previewBlocks().map((block, i) => {
          if (block.type === "image") return this.previewImage(block, `viewer-image-${i}`);
          if (block.type === "images") return this.previewImages(block, i);
          if (block.type === "code") return this.previewCode(block, i);

          const id = `viewer-md-${this.viewerId}-${i}`;
          const markdown = (key, text) => Markdown(key, text).on_link_click((url, cx) => this.followLink(url, cx));
          // shortcut: style leading ATX headings; use native heading styles when TextView exposes them.
          const heading = /^( {0,3}(#{1,6})(?:[ \t]+[^\n]*|(?=\n|$)))(?:\n|$)/.exec(block.text);
          const section = i > 0 && Boolean(heading);
          if (!heading || heading[2].length > 2) return markdown(id, block.text).when(section, (el) => el.mt(12));

          const body = block.text.slice(heading[0].length);
          const lines = body.split("\n").filter((line) => line.trim());
          const references = lines.filter((line) => REFERENCE.test(line));
          return v_flex()
            .when(section, (el) => el.mt(12))
            .gap(10)
            .child(
              div().border_b_1().border_color(theme().border).pb(5)
                .child(markdown(id, [heading[1], "", ...references].join("\n"))),
            )
            .when(lines.length > references.length, (el) => el.child(markdown(`${id}-body`, body)));
        }),
      );
  },

  viewerActions() {
    const file = this.file;
    const preview = this.viewerEntry()?.preview;
    const editors = file?.on ? [] : foundEditors();
    const markdown = Boolean(file && isMarkdown(file.path));
    const previewing = this.showsPreview();
    const showView = (view) => (cx) => {
      this.setViewer(this.viewerId, { markdown: view });
      cx.notify();
    };
    // Only changes that replaced something have old lines to show.
    const openable = this.gutterOn && !previewing ? (this.hunks ?? []).filter((hunk) => hunk.old.length).map(hunkKey) : [];
    const allOpen = openable.length > 0 && openable.every((key) => this.openHunks.has(key));
    return h_flex()
      .id("viewer-actions")
      .gap(6)
      .items_center()
      .when(markdown, (el) =>
        el.child(
          h_flex()
            .id("viewer-view")
            .gap(2)
            .child(PaneButton({ id: "viewer-view-preview", icon: "eye", label: "Rendered view", active: previewing, onClick: showView("preview") }))
            .child(PaneButton({ id: "viewer-view-code", icon: "code", label: "Source", active: !previewing, onClick: showView("code") })),
        ),
      )
      .when(openable.length > 0, (el) =>
        el.child(
          TextButton({
            id: "viewer-show-old",
            label: "Expand all",
            active: allOpen,
            onClick: (cx) => {
              this.openHunks = new Set(allOpen ? [] : openable);
              cx.notify();
            },
          }),
        ),
      )
      .when(this.slot && this.hovered, (el) =>
        el
          .when(markdown, (el) => el.child(div().w(1).h(12).flex_none().bg(theme().border)))
          .child(
            h_flex()
              .gap(2)
              .child(PaneButton({ id: "viewer-slot-tab", icon: "tabs", label: "Open in tab", onClick: (cx) => this.promoteToTab(file, cx) }))
              .child(PaneButton({ id: "viewer-slot-close", icon: "x", label: "Close preview", onClick: (cx) => this.closeSlot(cx) })),
          ),
      )
      .when(Boolean(preview), (el) =>
        el.child(
          TextButton({
            id: "viewer-keep",
            label: "Keep tab",
            onClick: (cx) => {
              this.setViewer(this.viewerId, { preview: false });
              cx.notify();
            },
          }),
        ),
      )
      .when(editors.length > 0, (el) =>
        el.child(
          this.chooser({
            id: "viewer-open-in",
            accessibilityLabel: "Open in an editor",
            width: 200,
            trigger: MenuButton({ id: "viewer-open-in-trigger", label: "Open in" }),
            choices: editors.map((e) => ({ id: editorId(e), label: e.name })),
            onChoose: (id) => {
              this.openInEditor(editors.find((e) => editorId(e) === id), file.path);
            },
          }),
        ),
      );
  },

  viewerView() {
    const t = theme();
    if (this.slot && !this.slotShown()) return v_flex().size_full().bg(t.background);
    const head = this.viewerHead();
    const inHeader = !this.slot && this.headerShowsTitle();
    const root = v_flex()
      .id("awsome-viewer-viewer")
      .relative()
      .size_full()
      .min_w(0)
      .min_h(0)
      .overflow_hidden()
      .bg(t.background)
      .text_color(t.foreground)
      .text_size(TEXT.body);
    if (!inHeader && head)
      root.child(
        h_flex()
          .id("viewer-bar")
          .on_hover((hovered, cx) => {
            this.hovered = hovered;
            cx.notify();
          })
          .h(30)
          .flex_none()
          .px(10)
          .gap(8)
          .items_center()
          .border_b(1)
          .border_color(t.border)
          .text_size(TEXT.small)
          .child(
            FileIcon({ icons: this.fileIcons, path: this.file.path, color: t.dim, t }),
          )
          .child(div().flex_none().truncate().max_w(260).font_medium().child(head.title))
          .when(Boolean(this.readOnlyReason()), (el) =>
            el.child(div().id("viewer-read-only").flex_none().tooltip(this.readOnlyReason()).child(Icon("pencil-simple-slash").text_color(t.dim))),
          )
          .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(head.detail))
          .child(this.viewerActions()),
      );
    // The operation bar shows over the editor only; the image, problem, preview and changed-lines
    // views have no editor for it to work on.
    const editorShown = !(this.file && isImage(this.file.path)) && !this.problem && this.text !== undefined && !this.showsPreview() && !this.gutterOn;
    const barShown = editorShown && Boolean(this.lineInput);
    if (barShown) root.child(this.lineBar(t));
    if (this.file && isImage(this.file.path)) root.child(this.imageView());
    else if (this.problem) root.child(Message(this.problem));
    else if (this.text === undefined) root.child(Message(head ? "Loading…" : "This tab has no file."));
    else if (this.showsPreview()) root.child(this.previewView());
    else if (this.gutterOn) root.child(this.linesView());
    else root.child(v_flex().flex_1().min_h(0).child(Editor.new(this.code).flex_1().min_h(0)));
    // There's no row of its own to sit in, so the actions float over the file's corner, under the
    // operation bar when it shows. On the file's own colour, nearly opaque, so the text under it
    // fades out without a box.
    if (inHeader)
      root.child(
        div()
          .absolute()
          .top(6 + (barShown ? 2 * LINE_BAR.pad + LINE_BAR.input + 1 : 0))
          .right(18)
          .p(3)
          .rounded(7)
          .bg(`${t.background.slice(0, 7)}E6`)
          .child(this.viewerActions()),
      );
    return root;
  },
};
