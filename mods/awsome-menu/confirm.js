// The awsome-* confirmation dialog: the look and keys of Herdr's own confirm mod
// (popover, radius 8, 15px semibold title, 32px buttons, Enter confirms, Esc cancels)
// plus the shared rules in docs/REQUIREMENTS.md §2.6: a question with a count as the
// title, the affected names (8, then "+N more"), a red button that names the action,
// and "Don't ask again" only for actions that can be undone elsewhere (the Recycle Bin).
// Byte-identical copies live in each mod that uses it; change one, copy it to the others.
//
//   confirmView({ id, title, names, note, action, danger, dontAsk, onToggle, onConfirm, onCancel, mono })
// dontAsk: null hides the checkbox, true/false shows it checked or not.

import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";

export const CONFIRM = { width: 420, pad: 18, gap: 12, title: 15, text: 13, name: 20, button: 32, radius: 8, shown: 8 };

// The dialog's height for this content, so openOverlay can size it exactly.
export function confirmHeight({ names = [], note, dontAsk = null }) {
  const lines = Math.min(names.length, CONFIRM.shown) + (names.length > CONFIRM.shown ? 1 : 0);
  let h = CONFIRM.pad * 2 + 22 + CONFIRM.gap + CONFIRM.button;
  if (lines) h += CONFIRM.gap + lines * CONFIRM.name + 12;
  if (note) h += CONFIRM.gap + 18;
  if (dontAsk !== null) h += CONFIRM.gap + 18;
  return h;
}

// Text on a colored button: whichever of the theme's foreground and background reads better on it.
function inkOn(hex, t) {
  const lum = (h) => {
    const c = String(h ?? "").replace("#", "").slice(0, 6);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(c.slice(i, i + 2), 16)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  return ratio(t.foreground, hex) >= ratio(t.background, hex) ? t.foreground : t.background;
}

export function confirmKey(key, onConfirm, onCancel) {
  if (key === "enter") { onConfirm(); return true; }
  if (key === "escape") { onCancel(); return true; }
  return false;
}

export function confirmView({ id, title, names = [], note, action, danger = true, dontAsk = null, onToggle, onConfirm, onCancel, mono }) {
  const t = theme();
  const shown = names.slice(0, CONFIRM.shown), more = names.length - shown.length;
  const fill = danger ? t.blocked : t.solid;
  const button = (bid, label, bg, fg, border, act) => h_flex().id(bid).h(CONFIRM.button).px(14).items_center().rounded(CONFIRM.radius)
    .border_1().border_color(border).bg(bg).text_color(fg).cursor_pointer().hover((s) => s.opacity(0.9)).on_click((_e, cx) => act(cx)).child(label);
  return v_flex().id(id).size_full().p(CONFIRM.pad).gap(CONFIRM.gap).rounded(CONFIRM.radius).bg(t.popover).text_size(CONFIRM.text).text_color(t.foreground)
    .child(div().text_size(CONFIRM.title).font_semibold().child(title))
    .when(shown.length > 0, (el) => el.child(v_flex().p(6).rounded(6).border_1().border_color(t.border).bg(t.raised).font_family(mono ?? "JetBrains Mono")
      .children(shown.map((n) => div().h(CONFIRM.name).flex().items_center().px(4).truncate().child(n)))
      .when(more > 0, (l) => l.child(div().h(CONFIRM.name).flex().items_center().px(4).text_color(t.muted).child(`+${more} more`)))))
    .when(Boolean(note), (el) => el.child(div().text_color(t.muted).child(note)))
    .when(dontAsk !== null, (el) => el.child(h_flex().id(`${id}-ask`).gap(8).items_center().cursor_pointer().text_color(t.muted)
      .on_click((_e, cx) => onToggle?.(cx))
      .child(div().size(14).rounded(3).border_1().border_color(dontAsk ? t.accent : t.input).bg(dontAsk ? t.accent : t.popover))
      .child("Don’t ask again")))
    .child(h_flex().justify_end().gap(8).text_size(12)
      .child(button(`${id}-no`, "Cancel", t.raised, t.foreground, t.input, (cx) => onCancel(cx)))
      .child(button(`${id}-yes`, action, fill, inkOn(fill, t), fill, (cx) => onConfirm(cx))));
}
