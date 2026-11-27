// Undo for the Files tree: the last created item (only while it is still empty) or the last rename
// (docs/REQUIREMENTS.md §4.3c 6).
import { exec, notify, setShared, window } from "herdr";
import { removeEmptyPlan, renamePlan, MESSAGES } from "./fileops.js";

const dirOf = (rel) => (rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "");
const platformOf = (tree) => (tree.on ? "linux" : window()?.platform);

async function run(tree, plan) {
  try { return await exec(plan.program, plan.args, { on: tree.on, timeout: 20000 }); }
  catch (e) { return { code: 1, stdout: "", stderr: String(e?.message ?? e) }; }
}

export async function undoLast(tree, cx) {
  if (tree.edit || !tree.undo?.length) return;
  const entry = tree.undo.pop();
  const platform = platformOf(tree);
  const rel = (abs) => abs.slice(tree.root.length).replace(/^[\\/]+/, "");
  const paths = entry.kind === "create" ? [entry.abs] : [entry.from, entry.to];
  try {
    if (!paths.every((p) => p.startsWith(tree.root))) {
      notify({ title: "Outside this folder", level: "error", timeout: 3000 });
      return cx.notify();
    }
    if (entry.kind === "create") {
      const r = await run(tree, removeEmptyPlan(platform, entry.what, entry.abs));
      if (r.code !== 0) {
        notify({ title: MESSAGES.notEmpty, level: "info", timeout: 3000 });
        return cx.notify();
      }
      if (tree.file === rel(entry.abs)) tree.closePreview();
      tree.index = null;
      tree.refresh(cx);
      tree.cursor = tree.anchor = dirOf(rel(entry.abs));
    } else {
      const from = rel(entry.from), to = rel(entry.to);
      for (const plan of renamePlan(platform, entry.to, entry.from, String(Date.now()))) {
        const r = await run(tree, plan);
        if (r.code !== 0) {
          notify({ title: "Could not undo the rename", body: String(r.stderr ?? "").split("\n")[0], level: "error" });
          return cx.notify();
        }
      }
      for (const f of [...tree.folders]) {
        if (f === to || f.startsWith(to + "/")) {
          tree.folders.add(from + f.slice(to.length));
          tree.folders.delete(f);
        }
      }
      if (tree.file === to) {
        tree.closePreview();
        setShared("awsome-filetree.preview", { root: tree.root, rel: from, n: Date.now() });
      }
      tree.index = null;
      tree.refresh(cx);
      tree.cursor = tree.anchor = from;
    }
  } catch (e) {
    notify({ title: "Undo failed", body: String(e?.message ?? e), level: "error" });
  }
  cx.notify();
}
