// The awsome-* context menu: Herdr's own menu look (mods/menu: 31px rows, 12.8 text,
// radius 7, 14px muted icons, keys on the right) plus the shared rules in
// docs/REQUIREMENTS.md §2.6: fixed group order, danger last and red, unavailable items
// greyed with the reason as a tooltip. Byte-identical copies live in each mod that uses
// it (mods cannot import from each other); change one, copy it to the others.
//
// An entry is "-" (a separator), a group title { title: "Terminals" }, or
//   { id, label, icon?, image?, keys?, danger?, disabled?, reason?, run(cx) }
// icon is a one-color svg path ("mods/awsome-icons/ui/copy.svg"), drawn muted; image is a
// full-color picture (a program's own icon). keys is the muted text on the right.

import { div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme, keys as boundKeys } from "herdr";

// Spacing after shadcn/ui's ContextMenu (new-york-v4): content p-1, rounded-md, border,
// shadow-md; item px-2 py-1.5 gap-2 rounded-sm, 16px muted icons; separator -mx-1 my-1.
// Text stays at the app's 13px. `margin` leaves room for the shadow inside the popup.
export const MENU = { margin: 6, pad: 4, radius: 8, row: 30, px: 8, gap: 8, itemRadius: 6, text: 13, icon: 16, keys: 11.5, sep: 9 };

// The popup's size for these entries, so openOverlay can size it exactly ({ frame: "none" }).
export function menuHeight(entries) {
  const rows = entries.filter((e) => e !== "-").length;
  const seps = entries.filter((e) => e === "-").length;
  return MENU.margin * 2 + 2 + MENU.pad * 2 + rows * MENU.row + seps * MENU.sep;
}
export function menuWidth(entries) {
  const items = entries.filter((e) => e !== "-").map((e) => (e.title ? { label: e.title } : e));
  const label = Math.max(0, ...items.map((e) => e.label.length)) * 7.2;
  const keys = Math.max(0, ...items.map((e) => (e.keys ? e.keys.length * 7.4 + 24 : 0)));
  const w = MENU.margin * 2 + 2 + MENU.pad * 2 + MENU.px * 2 + MENU.icon + MENU.gap + label + keys;
  return Math.round(Math.min(340, Math.max(180, w)));
}

// Separators only between groups: none at the ends, never two in a row.
export function tidy(entries) {
  const out = [];
  for (const e of entries) {
    if (!e) continue;
    if (e === "-" && (out.length === 0 || out[out.length - 1] === "-")) continue;
    out.push(e);
  }
  while (out[out.length - 1] === "-") out.pop();
  return out;
}

// The key bound to an action, as people read it ("Ctrl+Alt+Enter", "⌘⇧G" on macOS).
export function keyFor(action, mac) {
  const hit = (boundKeys() ?? []).find((k) => k.action === action);
  if (!hit) return null;
  const words = { ctrl: "Ctrl", alt: mac ? "⌥" : "Alt", shift: mac ? "⇧" : "Shift", cmd: "⌘", super: "Super", enter: "Enter", backspace: "Backspace", delete: "Delete", escape: "Esc", tab: "Tab", space: "Space" };
  const parts = hit.keys.split("-").map((p) => words[p] ?? (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)));
  return mac ? parts.join("") : parts.join("+");
}

// ↑/↓ move between enabled items, Enter runs, Esc closes. Returns the new cursor, or
// null when the key isn't a menu key.
export function menuKey(entries, at, key, run, close) {
  const live = entries.map((e, i) => (e !== "-" && !e.title && !e.disabled ? i : -1)).filter((i) => i >= 0);
  if (key === "escape") { close(); return at; }
  if (key === "enter") { const e = entries[at]; if (e && e !== "-" && !e.title && !e.disabled) run(e); return at; }
  if (key !== "up" && key !== "down") return null;
  if (!live.length) return at;
  const k = live.indexOf(at);
  if (k < 0) return key === "down" ? live[0] : live[live.length - 1];
  return live[(k + (key === "down" ? 1 : live.length - 1)) % live.length];
}

// A color at some opacity, as #rrggbbaa.
const alpha = (hex, a) => `${String(hex).slice(0, 7)}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
const darkTheme = (t) => { const c = String(t.popover).slice(1, 7); return parseInt(c.slice(0, 2), 16) + parseInt(c.slice(2, 4), 16) + parseInt(c.slice(4, 6), 16) < 384; };

// The popup body. `at` is the keyboard cursor (-1: none); `run(entry, cx)` is called on click.
// Open it with openOverlay({ kind: "popup", frame: "none", width: menuWidth(e), height: menuHeight(e) }).
export function menuView({ id, entries, at, run, mono, t: given }) {
  const t = given ?? theme();
  const dangerBg = alpha(t.blocked, darkTheme(t) ? 0.2 : 0.1);
  return div().id(id).size_full().p(MENU.margin).child(
    v_flex().size_full().p(MENU.pad).rounded(MENU.radius).border_1().border_color(t.border).bg(t.popover).shadow_md()
      .text_color(t.foreground).text_size(MENU.text)
      .children(entries.map((e, i) => {
        if (e === "-") return div().flex_none().mx(-MENU.pad).my(4).h(1).bg(t.border);
        if (e.title) return div().h(MENU.row).flex_none().flex().items_center().px(MENU.px).font_medium().child(e.title);
        const hot = e.danger ? dangerBg : t.hover;
        return h_flex().id(`${id}-${e.id}`).h(MENU.row).flex_none().px(MENU.px).gap(MENU.gap).items_center().rounded(MENU.itemRadius)
          .text_color(e.danger ? t.blocked : t.foreground)
          .when(Boolean(e.disabled), (el) => el.opacity(0.5))
          .when(!e.disabled, (el) => el.cursor_pointer().hover((s) => s.bg(hot)).on_click((_ev, cx) => run(e, cx)))
          .when(i === at && !e.disabled, (el) => el.bg(hot))
          .when(Boolean(e.disabled && e.reason), (el) => el.tooltip(e.reason))
          .child(e.image ? image(e.image).size(MENU.icon).flex_none()
            : e.icon ? svg(e.icon).size(MENU.icon).flex_none().text_color(e.danger ? t.blocked : t.muted) : div().w(MENU.icon).flex_none())
          .child(div().flex_1().min_w(0).truncate().child(e.label))
          .when(Boolean(e.keys), (el) => el.child(div().flex_none().ml(16).text_size(MENU.keys).font_family(mono ?? "JetBrains Mono").text_color(t.muted).child(e.keys)));
      })));
}
