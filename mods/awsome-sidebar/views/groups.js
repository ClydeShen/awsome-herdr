// Groups in the spaces list (docs/REQUIREMENTS.md §4.2.4): one tinted block per group, a header row
// that folds it, members that line up with the rows outside, and dragging in and out. Mixed into
// Spaces (spaces.js), so `this` is the Spaces view.
//
// The groups are kept in shared("awsome-sidebar.groups") as { list: [{ id, name, color, folded,
// machine }], of: { "machine|folder": groupId } }; awsome-menu writes it too (Group ▸, Ungroup).
// A worktree follows its main space: only the main space's folder is looked up.
import { div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { spaces, openOverlay, shared, setShared } from "herdr";
import { Icon } from "./ui.js";

export const GROUPS = "awsome-sidebar.groups";
// awsome-menu asks for a group's name to be edited by putting its id here.
export const RENAME = "awsome-sidebar.rename";
// Moving the pointer this far with the button down starts a drag (docs §2.6).
const DRAG_PX = 6;
const HEAD = 28;

const keyOf = (w) => `${w.machine ?? ""}|${w.folder ?? ""}`;

export const groupMethods = {
  // ── The stored groups ─────────────────────────────────────────────────────

  groupData() {
    const g = shared(GROUPS) ?? {};
    return { list: Array.isArray(g.list) ? g.list : [], of: g.of && typeof g.of === "object" ? g.of : {} };
  },

  // The group a space belongs to, on its own machine, else null.
  groupOf(w) {
    const { list, of } = this.groupData();
    const g = list.find((x) => x.id === of[keyOf(w)]);
    return g && (g.machine ?? null) === (w.machine ?? null) ? g : null;
  },

  // Writes a change to one group.
  editGroup(id, change) {
    const d = this.groupData();
    setShared(GROUPS, { ...d, list: d.list.map((g) => (g.id === id ? { ...g, ...change } : g)) });
  },

  // A group with no members left goes away; so does a membership whose group is gone.
  tidyGroups(d) {
    const used = new Set(Object.values(d.of));
    const list = d.list.filter((g) => used.has(g.id));
    const ids = new Set(list.map((g) => g.id));
    const of = Object.fromEntries(Object.entries(d.of).filter(([, id]) => ids.has(id)));
    return { list, of };
  },

  // Sets (or with null, removes) the group of these main spaces.
  setMembers(spaceList, groupId) {
    const d = this.groupData();
    const of = { ...d.of };
    for (const w of spaceList) {
      if (groupId) of[keyOf(w)] = groupId;
      else delete of[keyOf(w)];
    }
    setShared(GROUPS, this.tidyGroups({ list: d.list, of }));
  },

  ungroup(id) {
    const d = this.groupData();
    setShared(GROUPS, this.tidyGroups({ list: d.list, of: Object.fromEntries(Object.entries(d.of).filter(([, g]) => g !== id)) }));
  },

  // ── Order: members sit together ───────────────────────────────────────────

  // Rows (a main space followed by its worktrees) with each group's families side by side, at the
  // place of the group's first one. Every family keeps its own order.
  gatherGroups(rows) {
    const fams = [];
    for (const r of rows) {
      if (r.tree && fams.length) fams.at(-1).push(r);
      else fams.push([r]);
    }
    const first = new Map();
    const out = [];
    for (const f of fams) {
      const g = this.groupOf(f[0].w);
      if (!g) {
        out.push(f);
        continue;
      }
      if (first.has(g.id)) first.get(g.id).push(...f);
      else {
        const part = [...f];
        first.set(g.id, part);
        out.push(part);
      }
    }
    return out.flat();
  },

  // ── Drawing ───────────────────────────────────────────────────────────────

  // The rows of one machine's block: plain rows, and a tinted block for each group. Between a
  // block and what is next to it there are 8px (the list's own gap is 4); that gap is a drop
  // target too, the way out of a group.
  layoutRows(rows, draw, t, collapsed) {
    const fams = [];
    for (const r of rows) {
      if (r.tree && fams.length) fams.at(-1).rows.push(r);
      else fams.push({ head: r.w.id, rows: [r] });
    }
    const parts = [];
    const blocks = new Map();
    for (const f of fams) {
      const g = collapsed ? null : this.groupOf(f.rows[0].w);
      for (const r of f.rows) this.headOf[r.w.id] = f.head;
      this.famIds[f.head] = f.rows.map((r) => r.w.id);
      this.famGroup[f.head] = g?.id ?? null;
      let part = g ? blocks.get(g.id) : null;
      if (!part) {
        part = { group: g, fams: [] };
        if (g) blocks.set(g.id, part);
        parts.push(part);
      }
      part.fams.push(f);
    }
    if (collapsed) return rows.flatMap(draw);
    const out = [];
    parts.forEach((part, i) => {
      const prev = parts[i - 1];
      if (prev && (prev.group || part.group)) {
        const last = prev.fams.at(-1).head;
        this.stripAfter.add(last);
        this.prevOf[part.fams[0].head] = last;
        out.push(this.strip(last, t));
      }
      if (part.group) out.push(this.block(part, draw, t));
      else for (const f of part.fams) out.push(...f.rows.flatMap(draw));
    });
    return out;
  },

  // One group: its header and, unless it is folded, its members.
  block(part, draw, t) {
    const g = part.group;
    const hue = this.hueOf(g.color);
    const members = part.fams.flatMap((f) => f.rows);
    const el = v_flex()
      .id(`group-${g.id}`)
      .relative()
      .flex_none()
      .gap(4)
      .rounded(8)
      // Without a color the block is a plain hover tone.
      .bg(hue ? this.tint(hue, t) : t.hover)
      .child(this.groupHead(g, members, t));
    if (!g.folded) for (const r of members) el.children(draw(r));
    if (this.drag?.active && this.target?.header === g.id)
      el.child(div().absolute().top(0).left(0).right(0).bottom(0).rounded(8).border_1().border_color(t.accent));
    return el;
  },

  groupHead(g, members, t) {
    const editing = this.renaming?.id === g.id;
    const need = members.some((r) => r.w.status === "blocked");
    const count = members.filter((r) => !r.tree).length;
    return h_flex()
      .id(`group-head-${g.id}`)
      .h(HEAD)
      .flex_none()
      .px(8)
      .gap(8)
      .items_center()
      .rounded(8)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .when(g.folded, (el) => el.tooltip(`${count} ${count === 1 ? "space" : "spaces"}`))
      .on_mouse_down("right", () => this.groupMenu(g))
      .on_mouse_down("left", (e) => {
        this.pressed = g.id;
        this.drag = { kind: "group", group: g.id, start: e.position, active: false };
      })
      .on_mouse_move((e, cx) => this.dragOver(e, cx, { header: g.id }))
      .on_mouse_up("left", (_e, cx) => {
        const d = this.drag;
        this.rowUp = true;
        if (d?.active) this.drop(cx);
        else if (d?.group === g.id) this.editGroup(g.id, { folded: !g.folded });
        this.endDrag(cx);
      })
      .child(h_flex().size(16).flex_none().items_center().justify_center().child(Icon(`chevron-${g.folded ? "right" : "down"}`, 12).text_color(t.muted)))
      .child(editing ? this.renameField(g, t) : div().min_w(0).truncate().text_size(13).font_medium().text_color(t.foreground).child(g.name))
      .when(need, (el) => el.child(div().id(`needs-${g.id}`).size(8).flex_none().rounded_full().bg(t.blocked).tooltip("An agent needs you")));
  },

  // The gap that is the way out of a group: dropping here puts the space after `last`, outside.
  strip(last, t) {
    const at = { fam: last, side: "after", join: null };
    const on = this.drag?.active && this.target && this.target.fam === last && this.target.side === "after" && !this.target.join;
    return div()
      .id(`group-gap-${last}`)
      .relative()
      .flex_none()
      .h(8)
      .my(-4)
      .on_mouse_move((e, cx) => this.dragOver(e, cx, at))
      .on_mouse_up("left", (_e, cx) => {
        this.rowUp = true;
        if (this.drag?.active) this.drop(cx);
        this.endDrag(cx);
      })
      .when(on, (el) => el.child(div().absolute().left(0).right(0).top(3).h(2).bg(t.accent)));
  },

  // ── Naming a group in place ───────────────────────────────────────────────

  renameField(g, t) {
    return h_flex()
      .flex_1()
      .min_w(0)
      .h(24)
      .px(6)
      .items_center()
      .rounded(6)
      .bg(t.canvas ?? t.background)
      .border_1()
      .border_color(t.accent)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_mouse_up("left", (_e, cx) => cx.stop_propagation())
      .on_key_down((ev, cx) => {
        if (ev.key !== "escape") return;
        cx.stop_propagation();
        this.finishRename(false, cx);
      })
      .child(Input.new(this.renaming.input).flex_1().h_full().text_size(13).text_color(t.foreground));
  },

  // Starts editing a group's name: the text is all selected and the keyboard is in it. The input is
  // focused a moment later, once it has been drawn (see `tickRename`).
  startRename(id, cx) {
    const g = this.groupData().list.find((x) => x.id === id);
    if (!g) return;
    this.finishRename(true, cx);
    const input = InputState.new({ value: g.name });
    this.renaming = { id, input, armed: false };
    input.on("submit", (_e, cx2) => this.finishRename(true, cx2));
    input.on("blur", (_e, cx2) => this.renaming?.armed && this.finishRename(true, cx2));
    cx.notify();
  },

  // Once the field is on screen: focus it and select its text.
  tickRename(cx) {
    const r = this.renaming;
    if (!r || r.armed) return;
    r.armed = true;
    r.input.focus();
    r.input.set_selected_range({ start: 0, end: r.input.value().length });
    cx.notify();
  },

  // Enter, a click elsewhere: keep the text (empty is fine). Esc: keep the old name.
  finishRename(save, cx) {
    const r = this.renaming;
    if (!r) return;
    this.renaming = null;
    if (save) this.editGroup(r.id, { name: r.input.value().trim() });
    r.input.release();
    cx.notify();
  },

  groupMenu(g) {
    const size = (shared("awsome-menu.size") ?? {}).group ?? { width: 200, height: 160 };
    openOverlay({ mod: "awsome-menu", kind: "popup", frame: "none", ...size, props: { scope: "group", group: g.id } });
  },

  // A group folded away opens when its space is shown. Once per change of the shown space.
  unfoldShown() {
    const shown = spaces().find((s) => s.active);
    if (!shown || shown.id === this.unfolded) return;
    this.unfolded = shown.id;
    const g = this.groupOf(shown);
    if (g?.folded) this.editGroup(g.id, { folded: false });
  },

  // ── Dragging ──────────────────────────────────────────────────────────────

  // A press on a space row: a click when it comes up in place, a drag after DRAG_PX of movement.
  pressRow(w, e) {
    this.pressed = w.id;
    const draggable = spaceSortIsManual() && this.headOf?.[w.id] === w.id;
    this.drag = draggable ? { kind: "space", id: w.id, start: e.position, active: false } : null;
  },

  // Movement over a row, a header or a gap: starts the drag, and says where it would land.
  dragOver(e, cx, spot) {
    const d = this.drag;
    if (!d) return;
    // The button came up where nothing was listening (outside the window): that ends it.
    if (!e.pressed_button) {
      this.endDrag(cx);
      return;
    }
    if (!d.active) {
      if (Math.hypot(e.position.x - d.start.x, e.position.y - d.start.y) < DRAG_PX) return;
      d.active = true;
      d.heads = this.draggedHeads(d);
      this.listFocus.focus();
    }
    const next = this.landing(spot, e, d);
    if (JSON.stringify(next) !== JSON.stringify(this.target)) {
      this.target = next;
      cx.notify();
    }
  },

  // The main spaces being moved: the selection when the pressed row is part of it, else that row;
  // for a group, all its members.
  draggedHeads(d) {
    if (d.kind === "group") return Object.keys(this.famGroup).filter((h) => this.famGroup[h] === d.group);
    const sel = this.selected.size > 1 && this.selected.has(d.id) ? [...this.selected] : [d.id];
    return [...new Set(sel.map((id) => this.headOf[id] ?? id))].filter((h) => this.order.includes(h));
  },

  // Where a drop at `spot` would land, or null where it can't: another machine, or on itself.
  // spot: { header } over a group's header; { fam, side, join } over a gap; { row } over a row.
  landing(spot, e, d) {
    const moving = new Set((d.heads ?? []).flatMap((h) => this.famIds[h] ?? [h]));
    let target = spot;
    if (spot.row) {
      const head = this.headOf[spot.row];
      const side = e.local_position?.y < HEAD / 2 ? "before" : "after";
      target = { fam: head, side, join: this.famGroup[head] ?? null };
      // Right after a block, "before this row" is the gap that follows the block.
      if (side === "before" && !target.join && this.prevOf[head]) target = { fam: this.prevOf[head], side: "after", join: null };
    }
    const anchor = target.header ? this.membersOf(target.header)[0] : target.fam;
    if (!anchor) return null;
    const a = spaces().find((s) => s.id === anchor);
    const from = spaces().find((s) => s.id === d.heads[0]);
    if (!a || !from || (a.machine ?? null) !== (from.machine ?? null)) return null;
    if (d.kind === "group") {
      // A group goes between rows, never into another group: onto one it lands after that block.
      if (target.header === d.group || (target.join && target.join === d.group)) return null;
      if (target.header) return { fam: this.membersOf(target.header).at(-1), side: "after", join: null };
      if (target.join) return { fam: this.membersOf(target.join).at(-1), side: "after", join: null };
      if (moving.has(target.fam)) return null;
      return target;
    }
    if (!target.header && moving.has(target.fam)) return null;
    return target;
  },

  // A group's main spaces in the list's order.
  membersOf(id) {
    return Object.keys(this.famGroup).filter((h) => this.famGroup[h] === id);
  },

  // The insertion line on a space row, if the drop would go before or after it.
  lineOn(w, t) {
    const tg = this.target;
    if (!this.drag?.active || !tg || tg.header) return null;
    const ids = this.famIds[tg.fam];
    if (!ids) return null;
    const mine = tg.side === "before" ? ids[0] === w.id : ids.at(-1) === w.id && !(!tg.join && this.stripAfter.has(tg.fam));
    if (!mine) return null;
    return div().absolute().left(0).right(0).h(2).bg(t.accent).when(tg.side === "before", (l) => l.top(0)).when(tg.side === "after", (l) => l.bottom(0));
  },

  endDrag(cx) {
    this.pressed = null;
    this.drag = null;
    this.target = null;
    cx?.notify();
  },

  // Lets go over a target: the moved spaces take their place in Herdr's own order, so the numbers
  // keys follow the list, and join or leave a group.
  drop(cx) {
    const d = this.drag;
    const target = this.target;
    if (!d?.active || !target) return;
    const sp = spaces();
    const order = sp.map((s) => s.id);
    const ids = (h) => this.famIds[h] ?? [h];
    const moving = new Set(d.heads.flatMap(ids));
    const rest = order.filter((id) => !moving.has(id));
    let ref = target.fam;
    if (target.header) ref = this.membersOf(target.header).filter((h) => !d.heads.includes(h)).at(-1) ?? null;
    let next = order;
    if (ref) {
      const around = ids(ref).filter((id) => rest.includes(id));
      const at = target.header || target.side === "after" ? rest.indexOf(around.at(-1)) + 1 : rest.indexOf(around[0]);
      const mine = order.filter((id) => moving.has(id));
      next = [...rest.slice(0, at), ...mine, ...rest.slice(at)];
    }
    if (d.kind === "space") {
      const group = target.header ?? target.join ?? null;
      this.setMembers(d.heads.map((h) => sp.find((s) => s.id === h)).filter(Boolean), group);
    }
    this.applyOrder(order, next);
    cx?.notify();
  },
};

function spaceSortIsManual() {
  return (shared("spaces.sort") ?? "manual") === "manual";
}
