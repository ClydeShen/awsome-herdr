// The design kit: tokens and small components. UI only: values in, callbacks out,
// no Git or Herdr commands. Components return ordinary elements, so callers can chain.
// The parts at the end (the panel frame and History, docs/REQUIREMENTS.md §4.6a) follow
// design/tokens.json `history`. The older parts above came from the upstream mod: they are
// an initial state, not a standard, and are redone against the spec as each area is (P4).
import { div, image, svg, PathBuilder } from "gpui-kit";
import { h_flex, v_flex, Popover, Textarea } from "gpui-base";
import { theme, settings } from "herdr";
import { fileIcon, isLight } from "../file-icons.js";

// Plain px: Herdr scales a mod's sizes by zoom itself.
export const TEXT = { badge: 10, caption: 11, small: 12, menu: 12.8, body: 13 };
const RADIUS = { small: 4, control: 6, row: 7, button: 8, panel: 10 };
export const SIZE = {
  button: 32,
  header: 42,
  paneHeader: 30,
  tab: 29,
  row: 28,
  group: 30,
  menu: 31,
  icon: 26,
  iconSmall: 20,
};
// The tree's grid: a 14px slot and a 6px gap. Every row at a depth starts in the
// same column, a folder with its chevron and a file with its icon, and names align.
const SLOT = 14;
const ROW_GAP = 6;
const ROW_PADDING = 8;
const INDENT = SLOT + ROW_GAP;
// One turn of a spinning icon, the speed of Herdr's own spinner.
export const SPIN_MS = 900;
const GUIDE_X = ROW_PADDING + SLOT / 2 - 0.5;
const STEM = 7; // From just under a 12px chevron, centred in a 28px row, to the row's end.

// shortcut: icons resolve inside this mod, upgrade when the kit is copied into a second mod.
const ICONS = "mods/awsome-changes/icons";

export const codeFont = () => settings().font_family ?? "JetBrains Mono";
// The terminals' size, which a layout can set. Rows and columns of code grow with it.
export const codeSize = () => settings().font_size ?? 14;

export const Icon = (name, size = 14) => svg(`${ICONS}/${name}.svg`).size(size).flex_none();

// A file's or folder's icon: Awsome Icons' one when it's installed, else this mod's plain file,
// tinted. Folders draw it only with the table. t: the theme the caller already holds.
export function FileIcon({ icons, path, dir = false, open = false, color, t, size = 14 }) {
  const picture = fileIcon(icons, path, { dir, open, light: isLight(t.background) });
  if (picture) return image(picture).size(size).flex_none();
  return Icon("file", size).text_color(color);
}

// A folder's first column.
export function Chevron(open) {
  const t = theme();
  return div()
    .w(SLOT)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .text_color(t.dim)
    .child(Icon(open ? "chevron-down" : "chevron-right", 12));
}

// A sidebar panel's frame. A tab's content sits inside Herdr's pane frame, so `framed: false`.
export function Panel({ id, framed = true }) {
  const t = theme();
  return v_flex()
    .id(id)
    .size_full()
    .min_h(0)
    .overflow_hidden()
    .bg(t.background)
    .text_color(t.foreground)
    .text_size(TEXT.body)
    .when(framed, (el) => el.rounded(RADIUS.panel).border_1().border_color(t.border));
}

export function PanelHeader() {
  const t = theme();
  return h_flex()
    .h(SIZE.header)
    .flex_none()
    .px(14)
    .gap(8)
    .items_center()
    .border_b(1)
    .border_color(t.border);
}

// A row matching Herdr's pane header, for a layout that doesn't use ours.
export function PaneBar() {
  const t = theme();
  return h_flex()
    .h(SIZE.paneHeader)
    .flex_none()
    .px(10)
    .gap(8)
    .items_center()
    .border_b(1)
    .border_color(t.border)
    .text_size(TEXT.small);
}

function Badge(text) {
  const t = theme();
  return div()
    .flex_none()
    .px(5)
    .py(1)
    .rounded(RADIUS.small)
    .border_1()
    .border_color(t.border)
    .text_size(TEXT.badge)
    .text_color(t.muted)
    .child(String(text));
}

// A panel title that doubles as a tab, the same pill as Herdr's tab bar.
export function HeaderTab({ id, label, count, active, onClick }) {
  const t = theme();
  return h_flex()
    .id(id)
    .h(SIZE.tab)
    .flex_none()
    .px(10)
    .gap(7)
    .items_center()
    .rounded(RADIUS.row)
    .border(1)
    .border_color(active ? t.border : t.background)
    .bg(active ? t.raised : t.background)
    .text_size(TEXT.menu)
    .text_color(active ? t.foreground : t.muted)
    .cursor_pointer()
    .hover((s) => s.bg(t.hover))
    .role("tab")
    .aria_selected(Boolean(active))
    .on_click((_e, cx) => onClick(cx))
    .child(label)
    .when(count !== undefined && count !== null, (el) => el.child(Badge(count)));
}

export function IconButton({
  id,
  icon,
  label,
  onClick,
  small = false,
  disabled = false,
  spinning = false,
}) {
  const t = theme();
  const size = small ? SIZE.iconSmall : SIZE.icon;
  return div()
    .id(id)
    .size(size)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .rounded(small ? RADIUS.small : RADIUS.control)
    .text_color(t.dim)
    .accessibility_label(label)
    .tooltip(label)
    .when(!disabled, (el) => el.hover((s) => s.bg(t.hover).text_color(t.foreground)))
    .when(Boolean(onClick) && !disabled, (el) =>
      el.on_click((_e, cx) => {
        cx.stop_propagation();
        onClick(cx);
      }),
    )
    .child(spinning ? Icon(icon, small ? 12 : 15).spin(SPIN_MS) : Icon(icon, small ? 12 : 15));
}

// A small labelled action, for a heading with room to say what it does.
export function TextButton({ id, icon, label, onClick, active = false }) {
  const t = theme();
  return h_flex()
    .id(id)
    .h(SIZE.iconSmall)
    .flex_none()
    .px(5)
    .gap(4)
    .items_center()
    .rounded(RADIUS.small)
    .text_size(TEXT.caption)
    .text_color(active ? t.foreground : t.dim)
    .when(active, (el) => el.bg(t.selected))
    .cursor_pointer()
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .on_click((_e, cx) => {
      cx.stop_propagation();
      onClick(cx);
    })
    .when(Boolean(icon), (el) => el.child(Icon(icon, 12)))
    .child(label);
}

// A section heading in a list, as in Herdr's agents list. With `onClick` it
// collapses its section; `divided` draws the rule that separates it from the last.
export function GroupHeader({
  id,
  label,
  count,
  detail,
  danger = false,
  collapsed = false,
  divided = false,
  action,
  onClick,
}) {
  const t = theme();
  return h_flex()
    .id(id)
    .h(SIZE.group)
    .flex_none()
    .px(ROW_PADDING)
    .gap(ROW_GAP)
    .items_center()
    .text_size(TEXT.caption)
    .text_color(t.muted)
    .when(divided, (el) => el.mt(4).border_t(1).border_color(t.border))
    .when(Boolean(onClick), (el) =>
      el
        .cursor_pointer()
        .hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => onClick(cx))
        .child(Chevron(!collapsed)),
    )
    .child(
      div()
        .flex_none()
        .font_medium()
        .when(danger, (el) => el.text_color(t.ansi1))
        .child(label),
    )
    .child(Badge(count))
    .child(
      div()
        .flex_1()
        .min_w(0)
        .truncate()
        .text_right()
        .text_color(t.dim)
        .child(detail ?? ""),
    )
    .when(Boolean(action), (el) => el.child(action));
}

// A list row. `depth` indents it, with a guide under each ancestor's chevron;
// rows touch, so the guides read as one line. `stem` starts an open folder's
// guide right under its own chevron, so it joins the rows inside.
export function Row({ id, depth = 0, selected = false, stem = false, onClick }) {
  const t = theme();
  const guide = (level) =>
    div()
      .absolute()
      .bottom(0)
      .left(GUIDE_X + level * INDENT)
      .w(1)
      .bg(t.border);
  const guides = Array.from({ length: depth }, (_, level) => guide(level).top(0));
  if (stem) guides.push(guide(depth).h(STEM));
  return h_flex()
    .id(id)
    .relative()
    .h(SIZE.row)
    .flex_none()
    .pl(ROW_PADDING + depth * INDENT)
    .pr(ROW_PADDING)
    .gap(ROW_GAP)
    .items_center()
    .rounded(RADIUS.row)
    .cursor_pointer()
    .when(selected, (el) => el.bg(t.selected))
    .hover((s) => s.bg(t.hover))
    .on_click((_e, cx) => onClick(cx))
    .children(guides);
}

export function DiffStat({ add, del }) {
  const t = theme();
  return h_flex()
    .flex_none()
    .gap(5)
    .text_size(TEXT.caption)
    .when(add > 0, (el) => el.child(div().text_color(t.ansi2).child(`+${add}`)))
    .when(del > 0, (el) => el.child(div().text_color(t.ansi1).child(`−${del}`)));
}

export function StatusLetter(status) {
  const t = theme();
  const color = status === "A" ? t.ansi2 : status === "D" || status === "U" ? t.ansi1 : t.blocked;
  return div()
    .w(12)
    .flex_none()
    .text_center()
    .text_size(TEXT.caption)
    .text_color(color)
    .child(status);
}

export function Message(text, error = false) {
  const t = theme();
  return div()
    .flex_none()
    .p(8)
    .text_size(TEXT.small)
    .whitespace_normal()
    .text_color(error ? t.ansi1 : t.dim)
    .child(text);
}

// A multi-line field, the look of Herdr's commit message field.
export function TextBox({ id, state, focused, label, height = 84 }) {
  const t = theme();
  return Textarea.new(state)
    .id(id)
    .w_full()
    .h(height)
    .px(10)
    .py(7)
    .rounded(RADIUS.button)
    .border_1()
    .border_color(focused ? t.accent : t.border)
    .text_size(TEXT.small)
    .text_color(t.foreground)
    .accessibility_label(label);
}

// A primary action and, joined to it, the trigger for choosing another one.
export function SplitButton({ id, icon, label, enabled, primary = true, onClick, menu }) {
  const t = theme();
  const solid = enabled && primary;
  return h_flex()
    .id(id)
    .h(SIZE.button)
    .w_full()
    .gap(1)
    .items_center()
    .text_size(TEXT.small)
    .child(
      h_flex()
        .id(`${id}-main`)
        .h_full()
        .flex_1()
        .min_w(0)
        .px(14)
        .gap(7)
        .items_center()
        .justify_center()
        .rounded_l(RADIUS.button)
        .bg(solid ? t.solid : t.raised)
        .text_color(solid ? t.solid_foreground : enabled ? t.foreground : t.dim)
        .accessibility_label(label)
        .when(enabled, (el) =>
          el
            .cursor_pointer()
            .hover((s) => (solid ? s.opacity(0.88) : s.bg(t.hover)))
            .on_click((_e, cx) => onClick(cx)),
        )
        .child(Icon(icon, 14))
        .child(label),
    )
    .child(menu);
}

export function SplitTrigger({ id, label }) {
  const t = theme();
  return div()
    .id(id)
    .w(30)
    .h(SIZE.button)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .rounded_r(RADIUS.button)
    .bg(t.raised)
    .text_color(t.foreground)
    .cursor_pointer()
    .accessibility_label(label)
    .tooltip(label)
    .hover((s) => s.bg(t.hover))
    .child(Icon("chevron-down", 12));
}

// A popup anchored to its trigger.
export function Menu({
  id,
  open,
  onOpenChange,
  focus,
  trigger,
  children,
  width = 200,
  anchor = "top_right",
}) {
  const t = theme();
  const body = v_flex()
    .id(`${id}-body`)
    .w(width)
    .p(5)
    .gap(1)
    .rounded(RADIUS.row)
    .border_1()
    .border_color(t.border)
    .bg(t.popover)
    .text_color(t.foreground)
    .track_focus(focus)
    .on_key_down((event, cx) => {
      if (event.key !== "escape") return;
      cx.stop_propagation();
      onOpenChange(false, cx);
    })
    .children(children);
  return Popover.new(id)
    .open(open)
    .anchor(anchor)
    .track_focus(focus)
    .on_open_change((value, cx) => onOpenChange(value, cx))
    .trigger(trigger)
    .when(open, (el) => el.content(body));
}

export function MenuLabel(text) {
  const t = theme();
  return div()
    .px(8)
    .pt(6)
    .pb(3)
    .text_size(TEXT.caption)
    .font_medium()
    .text_color(t.dim)
    .child(text);
}

export function MenuDivider() {
  const t = theme();
  return div().h(1).my(4).bg(t.border);
}

export function MenuOption({ id, icon, label, selected, onClick }) {
  const t = theme();
  return h_flex()
    .id(id)
    .h(SIZE.menu)
    .flex_none()
    .px(8)
    .gap(9)
    .items_center()
    .rounded(RADIUS.row)
    .cursor_pointer()
    .text_size(TEXT.menu)
    .role("menu_item_radio")
    .aria_selected(Boolean(selected))
    .hover((s) => s.bg(t.hover))
    .on_click((_e, cx) => onClick(cx))
    .child(Icon(icon, 14).text_color(t.muted))
    .child(div().flex_1().child(label))
    .when(selected, (el) => el.child(Icon("check", 14)));
}

// ── The panel frame and History (docs/REQUIREMENTS.md §4.6a) ──────────────────

// design/tokens.json `history`; scripts/ui-check.py C9 keeps the two equal.
export const HISTORY = {
  inset: 8,
  px: 8,
  gap: 8,
  row: 28,
  radius: 8,
  text: 13,
  secondary: 11,
  icon: 16,
  header: 30,
  tab: 22,
  tabPx: 8,
  tabGap: 5,
  tabRadius: 6,
  tabText: 12,
  tabIcon: 14,
  tabBetween: 2,
  title: 32,
  titleText: 11,
  action: 20,
  actionIcon: 16,
  actionGap: 2,
  actionRadius: 6,
  chevron: 12,
  lane: 16,
  lanes: 6,
  dot: 8,
  ring: 10,
  ringStroke: 2,
  line: 1,
  labelMax: 120,
  labels: 2,
  labelPx: 5,
  labelRadius: 4,
  labelText: 10,
  time: 28,
  subjectMin: 64,
  labelMin: 32,
  detailShare: 0.4,
  detailMin: 120,
  listRows: 3,
  loadAhead: 10,
};
const H = HISTORY;

// Phosphor, shared by every awsome-* mod (§2.2).
export const UiIcon = (name, size) => svg(`mods/awsome-icons/ui/${name}.svg`).size(size).flex_none();

// The panel's top row: the Changes / History tabs and nothing else, as high as a pane's header.
export function PanelTabs(children) {
  const t = theme();
  return h_flex()
    .h(H.header)
    .flex_none()
    .pl(H.inset)
    .gap(H.tabBetween)
    .items_center()
    .bg(t.background)
    .border_b(1)
    .border_color(t.border)
    .role("tab_list")
    .children(children);
}

// One tab: Herdr tabs' panelButton. icon: an svg path.
export function PanelTab({ id, icon, label, tip, active, onClick }) {
  const t = theme();
  return h_flex()
    .id(id)
    .h(H.tab)
    .px(H.tabPx)
    .gap(H.tabGap)
    .flex_none()
    .items_center()
    .rounded(H.tabRadius)
    .text_size(H.tabText)
    .text_color(active ? t.foreground : t.muted)
    .when(active, (el) => el.bg(t.selected))
    .hover((s) => s.bg(t.hover))
    .cursor_pointer()
    .role("tab")
    .aria_selected(Boolean(active))
    .tooltip(tip)
    .on_click((_e, cx) => onClick(cx))
    .child(svg(icon).size(H.tabIcon).flex_none())
    .child(label);
}

// A group title's action. `active`: a switch that is on.
export function ToolButton({ id, icon, label, onClick, active = false, spinning = false }) {
  const t = theme();
  return div()
    .id(id)
    .size(H.action)
    .flex_none()
    .flex()
    .items_center()
    .justify_center()
    .rounded(H.actionRadius)
    .cursor_pointer()
    .text_color(active ? t.foreground : t.dim)
    .when(active, (el) => el.bg(t.selected))
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .accessibility_label(label)
    .tooltip(label)
    .on_click((_e, cx) => {
      cx.stop_propagation();
      onClick(cx);
    })
    .child(spinning ? UiIcon(icon, H.actionIcon).spin(SPIN_MS) : UiIcon(icon, H.actionIcon));
}

// A group's title row, the sidebar's: a chevron (or an icon) in the icon column, the title at
// the name column, actions at the end. `onClick` folds the group; `actions` show only while open.
export function GroupTitle({ id, open = true, icon, title, actions = [], divided = true, onClick }) {
  const t = theme();
  return h_flex()
    .id(id)
    .h(H.title)
    .flex_none()
    .mx(H.inset)
    .pl(H.px)
    .gap(H.gap)
    .items_center()
    .text_size(H.titleText)
    .when(divided, (el) => el.border_t(1).border_color(t.border))
    .when(Boolean(onClick), (el) => el.cursor_pointer().on_click((_e, cx) => onClick(cx)))
    .child(
      div()
        .w(H.icon)
        .flex_none()
        .flex()
        .items_center()
        .justify_center()
        .text_color(onClick ? t.dim : t.muted)
        .child(onClick ? UiIcon(open ? "caret-down" : "caret-right", H.chevron) : UiIcon(icon, H.icon)),
    )
    .child(h_flex().flex_1().min_w(0).gap(6).items_center().children(title))
    .when(open && actions.length > 0, (el) =>
      el.child(h_flex().flex_none().gap(H.actionGap).children(actions)),
    );
}

// One commit's lanes. row: { lane, segments } from layoutLanes; lanes: the column's lane count;
// color(lane): that lane's color; ring: a hollow ring (HEAD, a merge) instead of a dot.
export function LaneCell({ row, lanes, color, ring }) {
  const x = (lane) => H.lane * lane + H.lane / 2;
  const centre = H.row / 2;
  // A ring is hollow: a line stops at its edge rather than run through it.
  const gap = ring ? H.ring / 2 : 0;
  const y = (lane, v, towards) =>
    v !== 0.5 || lane !== row.lane ? v * H.row : centre + (towards > 0.5 ? gap : -gap);
  const paths = new Map();
  for (const [a, ya, b, yb, c] of row.segments) {
    const fill = color(c);
    const top = y(a, ya, yb);
    const bottom = y(b, yb, ya);
    let path = (paths.get(fill) ?? PathBuilder.stroke(H.line)).move_to(x(a), top);
    if (a === b) path = path.line_to(x(b), bottom);
    else {
      const mid = (top + bottom) / 2;
      path = path.cubic_bezier_to(x(b), bottom, x(a), mid, x(b), mid);
    }
    paths.set(fill, path);
  }
  const size = ring ? H.ring : H.dot;
  const own = color(row.lane);
  const dot = div()
    .absolute()
    .left(x(row.lane) - size / 2)
    .top(centre - size / 2)
    .size(size)
    .rounded(size / 2);
  return div()
    .relative()
    .flex_none()
    .w(Math.min(lanes, H.lanes) * H.lane)
    .h(H.row)
    .overflow_hidden()
    .children(
      [...paths].map(([fill, path]) =>
        window.paint_path(path.build(), fill).absolute().top(0).left(0).size_full(),
      ),
    )
    .child(ring ? dot.border(H.ringStroke).border_color(own) : dot.bg(own));
}

// A branch or tag on a commit, in Herdr changes' count-chip shape. kind: current, head (a
// detached HEAD), branch, remote, tag, more (the "+3" of the ones left out); color: the
// commit's lane, which outlines a local branch.
export function RefLabel({ kind, name, color }) {
  const t = theme();
  const current = kind === "current" || kind === "head";
  const quiet = kind === "remote" || kind === "more";
  const edge = current ? t.accent : quiet ? t.border : kind === "tag" ? t.ansi3 : color;
  const fg = current ? t.accent_foreground : quiet ? t.muted : kind === "tag" ? t.ansi3 : t.foreground;
  return div()
    .px(H.labelPx)
    .py(1)
    .max_w(H.labelMax)
    .min_w(H.labelMin)
    .flex_shrink_1()
    .rounded(H.labelRadius)
    .border_1()
    .border_color(edge)
    .when(current, (el) => el.bg(t.accent))
    .truncate()
    .text_size(H.labelText)
    .font_family(codeFont())
    .text_color(fg)
    .child(name);
}
