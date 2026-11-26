// Awsome Statusline: the window's bottom bar (docs/REQUIREMENTS.md §4.9). It draws Herdr's own
// items (machine, branch, agent count, command hint) and the items other mods register in
// shared("awsome-statusline.items") as { "<mod>": [ item ] }. A click on an item is written to
// shared("awsome-statusline.click") for its owner; an item with choices opens awsome-menu's
// statusline scope instead, and the chosen row is written there.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, theme, run, window, keys, shared, setShared, openOverlay } from "herdr";
import { menuFrame } from "./menu.js";

const ITEMS = "awsome-statusline.items";
const CLICK = "awsome-statusline.click";
const ICON = (name) => `mods/workspace-chrome/${name}.svg`;

// Sizes in px, estimated for the shrink decision: about 6.6 per character at 11.8, the 13px icon
// with its 6px gap, a chip's 6px padding on each side. Gaps: 16 between Herdr's items, 4 between
// chips, 10 between the two (so text is 16 from text everywhere, with a chip's own padding).
const CHAR_PX = 6.6, ICON_PX = 13, GAP_PX = 6, CHIP_PAD = 6, BAR_PAD = 14;
const gapBetween = (a, b) => (a.native && b.native ? 16 : a.native || b.native ? 10 : 4);

function widthOf(e, mode) {
  const text = mode === "icon" ? 0 : (e.text ?? "").length * CHAR_PX;
  const icon = e.icon ? ICON_PX : 0;
  return icon + (icon && text ? GAP_PX : 0) + text + (e.native ? 0 : CHIP_PAD * 2);
}

// What each item shows at this width, as a map key -> "full" | "icon" | "hidden" (missing: "full").
// Steps, in order (§4.9 "Shrinking"): the right side's chips by ascending keep (icon only, or hidden
// when they have no icon), then the left's the same way; then the chips still showing are hidden by
// ascending keep. Before the first chip with keep 90 or more is hidden, the machine's name goes.
function shrink(left, right, avail) {
  const modes = new Map();
  const modeOf = (e) => modes.get(e.key) ?? "full";
  const shown = (list) => list.filter((e) => modeOf(e) !== "hidden");
  const sized = (list) => shown(list).reduce((sum, e, i, a) => sum + (i ? gapBetween(a[i - 1], e) : 0) + widthOf(e, modeOf(e)), 0);
  const fits = () => sized(left) + sized(right) <= avail;
  const chipsOf = (list) => list.filter((e) => !e.native);
  const byKeep = (list) => [...list].sort((a, b) => a.keep - b.keep);
  const steps = [];
  let machineDone = false;
  const hide = (e, to) => {
    if (to === "hidden" && e.keep >= 90 && !machineDone) { machineDone = true; steps.push(["machine", "icon"]); }
    steps.push([e.key, to]);
  };
  for (const e of byKeep(chipsOf(right))) hide(e, e.icon ? "icon" : "hidden");
  for (const e of byKeep(chipsOf(left))) hide(e, e.icon ? "icon" : "hidden");
  for (const e of byKeep([...chipsOf(right), ...chipsOf(left)].filter((e) => e.icon))) hide(e, "hidden");
  for (const [key, to] of steps) {
    if (fits()) break;
    modes.set(key, to);
  }
  return modeOf;
}

// Herdr's own label: the icon (13) and the text, 6 apart. Icon-only drops the text.
const iconLabel = (icon, text, mode) => {
  const row = h_flex().gap(6).items_center().child(svg(icon).size(13));
  return mode === "icon" ? row : row.child(text);
};

// A contributed item: a chip with the hover look of Herdr's Esc chip (§4.9).
function chip(c, mode, t, click) {
  return h_flex().id(`statusline-${c.key}`).px(6).py(2).gap(6).items_center().rounded(5).cursor_pointer()
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .when(Boolean(c.tip), (el) => el.tooltip(c.tip))
    .on_click(() => click(c))
    .when(Boolean(c.icon), (el) => el.child(svg(c.icon).size(13).text_color(c.active ? t.foreground : t.dim)))
    .when(mode === "full" && Boolean(c.text), (el) => el.child(c.text));
}

// A choice-less item writes its click for its owner. An item with choices opens the menu beside the
// pointer, with the item's name as its title; the chosen row comes back through the click key.
function click(c) {
  if (!c.choices) {
    setShared(CLICK, { item: c.key, at: Date.now() });
    return;
  }
  const title = c.tip ?? c.text ?? "";
  const entries = [{ title }, ...c.choices.map((ch) => (ch === "-" ? "-" : { id: ch.id, label: ch.label }))];
  openOverlay({ mod: "awsome-menu", kind: "popup", frame: "none", at: "pointer", ...menuFrame(entries),
    props: { scope: "statusline", item: c.key, title, choices: c.choices } });
}

export default class AwsomeStatusline extends View {
  // The palette key as actually bound, not a hardcoded one; without a binding the hint stays
  // useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render() {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const list = agents();
    const needs = list.filter((a) => a.status === "blocked").length;
    const count = `${list.length} ${list.length === 1 ? "agent" : "agents"}`;
    const needText = `· ${needs} ${needs === 1 ? "needs" : "need"} you`;
    const machine = space?.machine ?? null;
    const branch = space?.branch ?? null;
    const hint = this.hint(t);

    const natives = [
      { key: "machine", native: true, order: 10, icon: ICON(machine ? "server" : "monitor"), text: machine ?? "This computer",
        draw: (mode) => iconLabel(ICON(machine ? "server" : "monitor"), machine ?? "This computer", mode) },
      ...(branch ? [{ key: "branch", native: true, order: 20, icon: ICON("branch"), text: branch,
        draw: () => iconLabel(ICON("branch"), branch, "full") }] : []),
      { key: "agents", native: true, order: 100, icon: true, text: needs ? `${count} ${needText}` : count,
        draw: () => h_flex().gap(6).items_center().child(div().size(6).rounded(3).bg(t.dim)).child(count)
          .when(needs > 0, (el) => el.child(div().text_color(t.blocked).child(needText))) },
    ];
    const palette = { key: "palette", native: true, text: hint,
      draw: () => div().id("palette").text_color(t.dim).on_click(() => run("app.palette")).child(hint) };

    const map = shared(ITEMS) ?? {};
    const chips = Object.entries(map).flatMap(([mod, items]) => (Array.isArray(items) ? items : []).map((it) => ({
      ...it, key: `${mod}.${it.id}`, keep: it.keep ?? 50, native: false, draw: (mode) => chip({ ...it, key: `${mod}.${it.id}` }, mode, t, click),
    })));
    const byOrder = (a, b) => a.order - b.order;
    const left = [...natives, ...chips.filter((c) => c.side !== "right")].sort(byOrder);
    const right = [...chips.filter((c) => c.side === "right").sort(byOrder), palette];

    const avail = this.width == null ? Infinity : this.width - BAR_PAD * 2;
    const modeOf = shrink(left, right, avail);
    const shown = (list) => list.filter((e) => modeOf(e) !== "hidden");
    const row = (list) => shown(list).map((e, i, a) => {
      const el = e.draw(modeOf(e));
      return i ? el.ml(gapBetween(a[i - 1], e)) : el;
    });

    return h_flex().size_full().px(BAR_PAD).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .on_size_change((s, cx) => { if (s.width !== this.width) { this.width = s.width; cx.notify(); } })
      .child(h_flex().items_center().children(row(left)))
      .child(div().flex_1())
      .child(h_flex().items_center().children(row(right)));
  }
}
