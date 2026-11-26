// Drafts keep unsaved edits when Herdr closes a tab or pane, quits, or reloads the mod, which the
// viewer cannot stop (docs/REQUIREMENTS.md section 4.8, VS Code's hot exit). One file per viewed
// file, in the mod's own data folder.
import { appHome } from "herdr";
import { exists, mkdir, readFile, readdir, unlink, writeFile } from "fs/promises";

const DRAFT_DAYS = 30;

const folder = () => `${appHome()}/data/awsome-viewer/drafts`;

// FNV-1a, the same hash as the web badges' names in views/viewer.js.
export function draftPath(file) {
  const text = `${file.on ?? ""}\0${file.path}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${folder()}/${(hash >>> 0).toString(16)}.json`;
}

export async function readDraft(file) {
  const path = draftPath(file);
  if (!(await exists(path))) return null;
  let draft;
  try {
    draft = JSON.parse(await readFile(path, "utf8"));
  } catch {
    // A draft cut short by a crash mid-write is dropped: the file on disk is what's left.
    return null;
  }
  return draft.path === file.path && (draft.on ?? null) === (file.on ?? null) ? draft : null;
}

// `raw` is null when the file was deleted; the draft then says so, and saving makes it again.
export async function writeDraft(file, { raw, text, eol, bom }) {
  await mkdir(folder(), { recursive: true });
  await writeFile(draftPath(file), JSON.stringify({ path: file.path, on: file.on ?? null, raw, text, eol, bom, at: Date.now() }));
}

export async function deleteDraft(file) {
  const path = draftPath(file);
  if (await exists(path)) await unlink(path);
}

// Drafts nobody has touched for a month are gone; a draft that can't be read counts as old.
export async function pruneDrafts() {
  if (!(await exists(folder()))) return;
  for (const name of await readdir(folder())) {
    if (!name.endsWith(".json")) continue;
    const path = `${folder()}/${name}`;
    let at = 0;
    try {
      at = JSON.parse(await readFile(path, "utf8")).at ?? 0;
    } catch {}
    if (Date.now() - at > DRAFT_DAYS * 86400000) await unlink(path);
  }
}
