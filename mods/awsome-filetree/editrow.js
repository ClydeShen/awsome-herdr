// The inline name row of the Files tree (docs/REQUIREMENTS.md §4.3c). Drawn in place of a row
// while a name is typed (new file, new folder, rename).
import { div, image } from "gpui-kit";
import { h_flex, v_flex, Input } from "gpui-base";
import { settings } from "herdr";

export function editRow(tree, r, t, R, H) {
  const { P } = H, { edit } = tree;
  const dir = edit.kind === "newFolder" || Boolean(r.e?.dir);
  const name = edit.input.value() || r.e?.name || "untitled";
  const msg = edit.error ?? edit.warning;
  const indent = P.rowPx + r.depth * P.indent;
  const box = h_flex().flex_1().min_w(0).h(H.ROW).px(4).items_center().rounded(R).border_1()
    .border_color(edit.error ? t.ansi1 : t.accent).bg(t.canvas ?? t.background)
    .font_family(H.codeFont()).text_size(13).text_color(t.foreground)
    .child(Input.new(edit.input).flex_1().h_full().text_size(13).text_color(t.foreground));
  const line = h_flex().h(P.tree).flex_none().pl(indent).pr(P.rowPx).gap(P.treeGap).items_center()
    .child(div().w(12).flex_none())
    .child(image(H.iconOf(tree.fileIcons, name, dir, false, settings().dark !== false)).size(16).flex_none())
    .child(box);
  const note = msg ? div().h(H.MSG).pl(indent + 12 + P.treeGap + 16 + P.treeGap).text_size(P.secondary).text_color(t.foreground).truncate().child(msg) : null;
  return v_flex().id("ft-edit").flex_none().child(line).when(Boolean(note), (el) => el.child(note));
}
