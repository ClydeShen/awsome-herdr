// Commits the inline name edit of the Files tree: creates the file or folder, or renames the item
// (docs/REQUIREMENTS.md §4.3c 3, 4). Every command comes from fileops.js.

import { exec, setShared, window } from "herdr";
import { validateName, createPlan, renamePlan } from "./fileops.js";

const baseOf = (path) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
const join = (root, rel) => (rel ? (/[\\/]$/.test(root) ? root + rel : `${root}/${rel}`) : root);
const platformOf = (tree) => (tree.on ? "linux" : window()?.platform);

const firstLine = (r) => (r.stderr || r.stdout || "").split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 60);

async function runPlans(tree, plans, fallback) {
  for (const plan of plans) {
    let r;
    try { r = await exec(plan.program, plan.args, { on: tree.on, timeout: 20000 }); }
    catch (e) { r = { code: 1, stdout: "", stderr: String(e?.message ?? e) }; }
    if (r.code !== 0) return firstLine(r) || fallback;
  }
  return null;
}

export async function commitEdit(tree, cx) {
  const edit = tree.edit;
  if (!edit || edit.busy) return;
  try {
    const platform = platformOf(tree);
    const isRename = edit.kind === "rename";
    const typed = edit.input.value();
    const isDir = edit.kind === "newFolder" || (!isRename && typed.endsWith("/"));
    const name = edit.kind === "newFolder" ? typed.replace(/\/+$/, "") : typed;
    const base = isRename ? baseOf(edit.orig) : null;
    const taken = (tree.entries.get(edit.folder) ?? []).map((e) => e.name).filter((n) => n !== base);
    const v = validateName(name, { platform, taken });
    if (v.error) { edit.touched = true; edit.error = v.error; cx.notify(); return; }
    if (isRename) {
      if (name === base) { tree.edit = null; tree.handle.focus(); cx.notify(); return; }
      const from = join(tree.root, edit.orig);
      const newRel = edit.folder ? `${edit.folder}/${name}` : name;
      const to = join(tree.root, newRel);
      edit.busy = true;
      const err = await runPlans(tree, renamePlan(platform, from, to, String(Date.now())), "Could not rename it");
      if (err) { edit.busy = false; edit.error = err; cx.notify(); return; }
      tree.edit = null;
      tree.undo.push({ kind: "rename", from, to });
      if (tree.undo.length > 20) tree.undo.shift();
      if (tree.file === edit.orig) {
        tree.closePreview();
        setShared("awsome-filetree.preview", { root: tree.root, rel: newRel, n: Date.now() });
      }
      for (const f of [...tree.folders]) {
        if (f === edit.orig || f.startsWith(edit.orig + "/")) {
          tree.folders.delete(f);
          tree.entries.delete(f);
          tree.folders.add(newRel + f.slice(edit.orig.length));
        }
      }
      tree.index = null;
      tree.refresh(cx);
      tree.cursor = tree.anchor = newRel;
      tree.handle.focus();
      cx.notify();
      return;
    }
    const clean = name.replace(/\/+$/, "");
    const rel = edit.folder ? `${edit.folder}/${clean}` : clean;
    const abs = join(tree.root, rel);
    const plan = createPlan(platform, isDir ? "folder" : "file", abs);
    edit.busy = true;
    let r;
    try { r = await exec(plan.program, plan.args, { on: tree.on, timeout: 20000 }); }
    catch (e) { r = { code: 1, stdout: "", stderr: String(e?.message ?? e) }; }
    if (r.code !== 0) { edit.busy = false; edit.error = firstLine(r) || "Could not create it"; cx.notify(); return; }
    tree.edit = null;
    tree.undo.push({ kind: "create", what: isDir ? "folder" : "file", abs });
    if (tree.undo.length > 20) tree.undo.shift();
    tree.index = null;
    tree.refresh(cx);
    const first = clean.split("/")[0];
    tree.cursor = tree.anchor = edit.folder ? `${edit.folder}/${first}` : first;
    if (!isDir && !name.includes("/")) setShared("awsome-filetree.preview", { root: tree.root, rel, n: Date.now() });
    tree.handle.focus();
    cx.notify();
  } catch (e) {
    edit.busy = false;
    edit.error = String(e?.message ?? e).slice(0, 60);
    cx.notify();
  }
}
