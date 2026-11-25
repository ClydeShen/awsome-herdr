// The Appearance picker (docs/REQUIREMENTS.md §4.2.2): one popover from the menu family. Every
// part sits in one grid of 28px cells, 7 across with no gaps: the colors in the first row (none
// and the six space colors), a menu separator, then 28 icons in four rows. A group shows only the
// colors, a space inside a group only the icons. The current choice has the menu's selected
// overlay; the current color also has a ring inside its cell. Picking applies at once.
//
//   pickerView({ id, hues, colors, icons, color, icon, at, onPick(kind, value, cx), onDismiss, onSize })
// hues: [[name, hex], ...] in order (from awsome-sidebar); color / icon: the current ones, or
// null for the default; at: the keyboard cursor over the cells in reading order (-1: none).

import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { MENU } from "./menu.js";

export const PICKER = { pad: 4, radius: 8, cell: 28, cellRadius: 6, cellGap: 0, columns: 7, swatch: 16, icon: 16, sep: 9, iconRows: 4, ring: 2, ringGap: 2 };

export const ICONS = ["folder-simple", "code", "terminal-window", "globe", "database", "hard-drives", "cloud",
  "rocket-launch", "flask", "bug", "book-open", "shield-check", "cpu", "robot",
  "cube", "package", "wrench", "gear-six", "chart-line-up", "lightning", "star",
  "house-simple", "briefcase", "paint-brush", "game-controller", "git-branch", "lock-simple", "chat-circle"];

const COLOR_NAMES = ["Teal", "Orange", "Blue", "Purple", "Green", "Pink"];
const UI = (name) => `mods/awsome-icons/ui/${name}.svg`;
const iconName = (n) => { const s = n.replace(/-simple$/, "").replace(/-/g, " "); return s[0].toUpperCase() + s.slice(1); };

// The cells in reading order: { kind: "color" | "icon", value }.
export function pickerCells({ hues, colors, icons }) {
  return [
    ...(colors ? [{ kind: "color", value: null, label: "None" }, ...hues.map(([name], i) => ({ kind: "color", value: name, label: COLOR_NAMES[i] ?? name }))] : []),
    ...(icons ? ICONS.map((n) => ({ kind: "icon", value: n, label: iconName(n) })) : []),
  ];
}

// The popup's size, for openOverlay({ kind: "popup", frame: "none", ...pickerFrame(parts) }).
export function pickerFrame({ colors, icons }) {
  const body = (colors ? PICKER.cell : 0) + (colors && icons ? PICKER.sep : 0) + (icons ? PICKER.iconRows * PICKER.cell : 0);
  return { width: MENU.margin * 2 + 2 + PICKER.pad * 2 + PICKER.columns * PICKER.cell, height: MENU.margin * 2 + 2 + PICKER.pad * 2 + body };
}

// Arrow keys move over the grid (across the separator), Enter picks, Esc closes.
export function pickerNav(state, cells, key, pick, close) {
  const n = cells.length, c = PICKER.columns;
  const move = { left: -1, right: 1, up: -c, down: c }[key];
  if (move !== undefined) { state.at = state.at < 0 ? 0 : Math.max(0, Math.min(n - 1, state.at + move)); return true; }
  if (key === "enter" && state.at >= 0) { pick(cells[state.at]); return true; }
  if (key === "escape") { close(); return true; }
  return false;
}

export function pickerView({ id, hues, colors, icons, color, icon, at = -1, onPick, onDismiss, onSize }) {
  const t = theme();
  const cells = pickerCells({ hues, colors, icons });
  const hex = Object.fromEntries(hues);
  const cell = (c, i) => {
    const on = c.kind === "color" ? c.value === color : c.value === icon;
    const ring = PICKER.swatch + 2 * (PICKER.ringGap + PICKER.ring);
    const swatch = () => (c.value === null ? div().size(PICKER.swatch).rounded_full().border_1().border_color(t.border)
      : div().size(PICKER.swatch).rounded_full().bg(hex[c.value] ?? t.muted));
    const inner = c.kind === "icon" ? svg(UI(c.value)).size(PICKER.icon).flex_none().text_color(on ? t.foreground : t.muted)
      : on ? div().size(ring).rounded_full().border(PICKER.ring).border_color(t.foreground).flex().items_center().justify_center().child(swatch()) : swatch();
    return div().id(`${id}-${c.kind}-${c.value ?? "none"}`).size(PICKER.cell).flex_none().rounded(PICKER.cellRadius)
      .flex().items_center().justify_center().cursor_pointer().tooltip(c.label)
      .when(on, (el) => el.bg(t.selected))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)).when(i === at, (e) => e.bg(t.hover)))
      .on_click((_e, cx) => onPick(c.kind, c.value, cx))
      .child(inner);
  };
  const rows = [];
  for (let i = 0; i < cells.length; i += PICKER.columns) rows.push(h_flex().children(cells.slice(i, i + PICKER.columns).map((c, k) => cell(c, i + k))));
  const body = v_flex().p(PICKER.pad).rounded(PICKER.radius).border_1().border_color(t.border).bg(t.popover).shadow_md()
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation());
  rows.forEach((r, k) => {
    if (colors && icons && k === 1) body.child(div().flex_none().mx(-PICKER.pad).my(4).h(1).bg(t.border));
    body.child(r);
  });
  const frame = pickerFrame({ colors, icons });
  return div().id(id).w(frame.width).h(frame.height).p(MENU.margin)
    .when(Boolean(onSize), (el) => el.on_size_change((size, cx) => onSize(size, cx)))
    .on_mouse_down("left", (_e, cx) => onDismiss?.(cx))
    .child(body);
}
