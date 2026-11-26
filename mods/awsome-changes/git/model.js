// Pure transformations: Git output → changed files → tree/diff display rows.
// No Herdr APIs or filesystem access belong here, so parsing stays testable.

/** Parse `git diff --numstat -z` without losing tabs inside filenames. */
function parseNumstat(text) {
  // Filenames such as "constructor" and "__proto__" must be ordinary keys.
  const stats = Object.create(null);
  for (const entry of text.split("\0")) {
    const [added, deleted, ...pathParts] = entry.split("\t");
    if (!pathParts.length) continue;

    // Git uses '-' instead of a line count for binary files.
    stats[pathParts.join("\t")] = {
      add: Number(added) || 0,
      del: Number(deleted) || 0,
      binary: added === "-",
    };
  }
  return stats;
}

// What each unmerged status means, in Git's X (yours) and Y (incoming) columns.
const CONFLICT_KINDS = {
  UU: "both edited",
  AA: "both added",
  DD: "both deleted",
  DU: "deleted by you",
  UD: "deleted incoming",
  AU: "added by you",
  UA: "added incoming",
};

/**
 * Combine porcelain-v1 status with [index, working-tree] numstat output.
 * Callers disable rename detection so each NUL-delimited entry has one path.
 * A partially staged file belongs to both groups, with separate statistics.
 */
export function changedFiles(status, numstats) {
  const statistics = numstats.map(parseNumstat);
  const emptyStats = { add: 0, del: 0 };

  return status
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      // Porcelain's X column describes the index; Y describes the working tree.
      const xy = entry.slice(0, 2);
      const path = entry.slice(3);
      const fresh = xy === "??";
      const conflict = xy.includes("U") || xy === "AA" || xy === "DD";
      const stagedStats = statistics[0]?.[path] ?? emptyStats;
      const unstagedStats = statistics[1]?.[path] ?? emptyStats;

      return {
        path,
        fresh,
        conflict,
        conflictKind: conflict ? CONFLICT_KINDS[xy] : null,
        // `unstaged` stays true for a conflict; the sidebar lists conflicts apart.
        staged: !fresh && !conflict && xy[0] !== " " && xy[0] !== "?",
        unstaged: fresh || conflict || xy[1] !== " ",
        status: conflict ? "U" : xy.includes("D") ? "D" : fresh || xy.includes("A") ? "A" : "M",
        stagedStatus: conflict ? "U" : xy[0],
        unstagedStatus: fresh ? "A" : conflict ? "U" : xy[1],
        stagedStats,
        unstagedStats,
        add: stagedStats.add + unstagedStats.add,
        del: stagedStats.del + unstagedStats.del,
        binary: Boolean(stagedStats.binary || unstagedStats.binary),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Build directory-first display rows, omitting descendants of closed folders. */
// The most serious status among a folder's files (§4.3a): conflict, deleted, modified, new.
const SEVERITY = { U: 4, D: 3, M: 2, R: 1, C: 1, A: 1, "?": 1 };
function worstOf(node, statusOf) {
  let worst = null;
  const counts = {};
  const visit = (n) => {
    for (const file of n.files) {
      const s = statusOf(file);
      counts[s] = (counts[s] ?? 0) + 1;
      if ((SEVERITY[s] ?? 0) > (SEVERITY[worst] ?? 0)) worst = s;
    }
    for (const child of n.dirs.values()) visit(child);
  };
  visit(node);
  return { worst, counts };
}

// A Git status as a word, for tooltips (§4.3a: "Modified · +4 −1").
export const STATUS_WORD = { M: "modified", A: "new", "?": "new", D: "deleted", R: "renamed", C: "copied", U: "conflict" };

// statusOf(file): the status a row shows, which depends on the group; folders take the worst one.
// A folder whose only content is one folder joins it on one row ("mods/awsome-filetree"), as VS
// Code's compact folders do (§4.5).
export function fileTree(files, closed = new Set(), statusOf = (file) => file.status) {
  const root = { dirs: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop(); // The final component is the filename, not a directory.
    let node = root;
    let path = "";

    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      if (!node.dirs.has(part)) {
        node.dirs.set(part, { path, dirs: new Map(), files: [] });
      }
      node = node.dirs.get(part);
    }
    node.files.push(file);
  }

  const rows = [];
  function walk(node, depth) {
    const directories = [...node.dirs].sort(([a], [b]) => a.localeCompare(b));
    for (let [name, directory] of directories) {
      while (!directory.files.length && directory.dirs.size === 1) {
        const [[sub, only]] = [...directory.dirs];
        name = `${name}/${sub}`;
        directory = only;
      }
      const { worst, counts } = worstOf(directory, statusOf);
      rows.push({ kind: "folder", name, path: directory.path, depth, status: worst, counts });
      if (!closed.has(directory.path)) walk(directory, depth + 1);
    }
    for (const file of node.files) {
      rows.push({ kind: "file", file, depth });
    }
  }

  walk(root, 0);
  return rows;
}

// Text draws a tab as nothing. Expand it to the next four-column stop.
export function expandTabs(text) {
  return text.replace(/[^\t]*\t/g, (part) =>
    part.slice(0, -1).padEnd(part.length - 1 - ((part.length - 1) % 4) + 4),
  );
}

/**
 * Attach old/new line numbers to unified diff lines. Hunk headers reset both
 * counters; metadata such as "No newline at end of file" consumes neither.
 */
export function diffRows(lines) {
  let oldLine = 0;
  let newLine = 0;
  return lines.map((text) => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(text);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      return { kind: "@", text };
    }

    const kind = text[0];
    if (kind === "-") return { kind, old: oldLine++, text: expandTabs(text.slice(1)) };
    if (kind === "+") return { kind, next: newLine++, text: expandTabs(text.slice(1)) };
    if (kind === " ") {
      return { kind, old: oldLine++, next: newLine++, text: expandTabs(text.slice(1)) };
    }
    return { kind: "", text };
  });
}

/**
 * Align each replacement block by position, not textual similarity. Missing
 * counterparts become blank cells. Never pair across context or hunk boundaries.
 */
export function splitDiffRows(rows) {
  const paired = [];
  const removed = [];
  const added = [];

  function flushReplacement() {
    for (let index = 0; index < Math.max(removed.length, added.length); index++) {
      paired.push({
        kind: "pair",
        left: removed[index] ?? null,
        right: added[index] ?? null,
      });
    }
    removed.length = 0;
    added.length = 0;
  }

  for (const row of rows) {
    if (row.kind === "-") removed.push(row);
    else if (row.kind === "+") added.push(row);
    else {
      flushReplacement();
      // Context appears on both sides; headers and metadata span both columns.
      paired.push(row.kind === " " ? { kind: "pair", left: row, right: row } : row);
    }
  }
  flushReplacement();
  return paired;
}

const CONTEXT_LINES = 3;

// Split a conflicted file into its plain lines and its marked blocks, each line
// keeping its number in the file. A marker with no end stays plain text.
function conflictParts(text) {
  const lines = text
    .replace(/\n$/, "")
    .split("\n")
    .map((text, index) => ({ text, line: index + 1 }));
  const parts = [];
  let plain = [];
  for (let i = 0; i < lines.length; i++) {
    const block = /^<{7}( |$)/.test(lines[i].text) ? readBlock(lines, i) : null;
    if (!block) {
      plain.push(lines[i]);
      continue;
    }
    parts.push({ plain }, { block });
    plain = [];
    i = block.end;
  }
  parts.push({ plain });
  return parts;
}

// One block from its `<<<<<<<`: yours, the optional `|||||||` base, and incoming.
function readBlock(lines, start) {
  const block = { open: lines[start], yours: [], base: [], incoming: [], end: start };
  let section = block.yours;
  for (let i = start + 1; i < lines.length; i++) {
    const { text } = lines[i];
    if (section === block.yours && /^\|{7}( |$)/.test(text)) {
      block.baseMarker = lines[i];
      section = block.base;
    } else if (section !== block.incoming && text === "=======") {
      block.divider = lines[i];
      section = block.incoming;
    } else if (section === block.incoming && /^>{7}( |$)/.test(text)) {
      block.close = lines[i];
      block.end = i;
      return block;
    } else {
      section.push(lines[i]);
    }
  }
  return null;
}

/**
 * Rows for showing a conflicted file with its traditional markers: only the
 * blocks, with a few lines around each. `inline` keeps the file as it is;
 * `split` puts yours on the left and incoming on the right. Null if no markers.
 */
export function conflictRows(text) {
  const parts = conflictParts(text);
  const count = parts.filter((part) => part.block).length;
  if (!count) return null;
  const inline = [];
  const split = [];
  const context = (entry) => ({ kind: " ", old: entry.line, next: entry.line, text: entry.text });
  const marker = (entry) => ({
    kind: "marker",
    old: entry.line,
    next: entry.line,
    text: entry.text,
  });
  // Two blocks close together share the lines between them, so show those once.
  let shownUpTo = 0;
  const addContext = (entries) => {
    for (const entry of entries) {
      if (entry.line <= shownUpTo) continue;
      shownUpTo = entry.line;
      inline.push(context(entry));
      split.push({ kind: "pair", left: context(entry), right: context(entry) });
    }
  };
  let number = 0;
  parts.forEach((part, index) => {
    if (!part.block) return;
    number++;
    const { open, yours, baseMarker, base, divider, incoming, close } = part.block;
    const before = parts[index - 1].plain;
    const after = parts[index + 1].plain;
    const heading = { kind: "@", text: `Conflict ${number} of ${count} · line ${open.line}` };
    inline.push(heading);
    split.push(heading);
    addContext(before.slice(-CONTEXT_LINES));

    inline.push(marker(open));
    for (const entry of yours)
      inline.push({ kind: "yours", next: entry.line, old: entry.line, text: entry.text });
    if (baseMarker) {
      inline.push(marker(baseMarker));
      for (const entry of base)
        inline.push({ kind: "base", next: entry.line, old: entry.line, text: entry.text });
    }
    inline.push(marker(divider));
    for (const entry of incoming)
      inline.push({ kind: "incoming", next: entry.line, old: entry.line, text: entry.text });
    inline.push(marker(close));

    split.push({ kind: "pair", left: marker(open), right: marker(close) });
    for (let i = 0; i < Math.max(yours.length, incoming.length); i++) {
      const left = yours[i] && { kind: "yours", old: yours[i].line, text: yours[i].text };
      const right = incoming[i] && {
        kind: "incoming",
        next: incoming[i].line,
        text: incoming[i].text,
      };
      split.push({ kind: "pair", left: left ?? null, right: right ?? null });
    }
    split.push({ kind: "pair", left: marker(divider), right: marker(divider) });

    shownUpTo = close.line;
    addContext(after.slice(0, CONTEXT_LINES));
  });
  return { inline, split, count };
}

// `git log` records separated by \x1e; fields by \0: hash, short hash, author, email,
// unix time, parents, refs (%D with --decorate=full), subject, body. Git adds a newline
// after each record.
export function parseLog(text) {
  return text
    .split("\x1e")
    .filter((record) => record.includes("\0"))
    .map((record) => {
      const [hash, short, author, email, at, parents, refs, committer, committedAt, subject, body = ""] = record
        .replace(/^\n/, "")
        .split("\0");
      return {
        hash,
        short,
        author,
        email,
        at: Number(at),
        committer,
        committedAt: Number(committedAt),
        parents: parents ? parents.split(" ") : [],
        refs: parseRefs(refs),
        subject,
        body: body.trim(),
      };
    });
}

const REF_ORDER = { head: 0, current: 0, branch: 1, remote: 2, tag: 3 };

// `%D` with --decorate=full: "HEAD -> refs/heads/main, refs/remotes/origin/main, tag: refs/tags/v1".
// A detached HEAD is a bare "HEAD". A remote's HEAD (origin/HEAD) only repeats a branch: left out.
export function parseRefs(text) {
  const refs = [];
  for (const part of (text ?? "").split(", ").filter(Boolean)) {
    if (part === "HEAD") {
      refs.push({ kind: "head", name: "HEAD" });
      continue;
    }
    const current = part.startsWith("HEAD -> ");
    const ref = part.replace(/^HEAD -> /, "").replace(/^tag: /, "");
    if (ref.startsWith("refs/heads/"))
      refs.push({ kind: current ? "current" : "branch", name: ref.slice(11) });
    else if (ref.startsWith("refs/remotes/") && !ref.endsWith("/HEAD"))
      refs.push({ kind: "remote", name: ref.slice(13) });
    else if (ref.startsWith("refs/tags/")) refs.push({ kind: "tag", name: ref.slice(10) });
  }
  return refs.sort((a, b) => REF_ORDER[a.kind] - REF_ORDER[b.kind]);
}

// Lays commits out on lanes. Commits come newest first, every child before its parents
// (git log --date-order). A lane is a column waiting for one commit and keeps its column
// until that commit arrives, so lines bend only where branches fork or merge (the idea of
// herdr-git-graph's lanes.js, MIT). Each row gets the commit's lane and its segments
// [fromLane, fromY, toLane, toY, colorLane], y 0 = the row's top, 0.5 = the dot, 1 = its
// bottom. width: the most lanes any row uses.
export function layoutLanes(commits) {
  const lanes = []; // lanes[i]: the hash column i waits for, or null
  const free = () => {
    const i = lanes.indexOf(null);
    return i < 0 ? lanes.length : i;
  };
  let width = 1;
  const rows = commits.map((commit) => {
    const above = lanes.slice();
    const segments = [];
    let lane = above.indexOf(commit.hash);
    if (lane < 0) {
      lane = free(); // a branch tip: nothing above it
      lanes[lane] = commit.hash;
    }
    above.forEach((hash, i) => {
      if (hash === null || hash === undefined) return;
      if (hash !== commit.hash) segments.push([i, 0, i, 1, i]);
      else {
        segments.push([i, 0, lane, 0.5, i]);
        if (i !== lane) lanes[i] = null; // a branch that ends here
      }
    });
    const [first, ...rest] = commit.parents;
    lanes[lane] = first ?? null;
    if (first) segments.push([lane, 0.5, lane, 1, lane]);
    for (const parent of rest) {
      let k = lanes.indexOf(parent);
      if (k < 0) {
        k = free();
        lanes[k] = parent;
      }
      segments.push([lane, 0.5, k, 1, k]);
    }
    width = Math.max(width, above.length, lanes.length);
    while (lanes.length && lanes.at(-1) === null) lanes.pop();
    return { lane, segments };
  });
  return { rows, width };
}

// Combine `show --numstat -z` and `show --name-status -z` output for one commit.
// Binary files report "-" counts. Status falls back to M when a path is missing.
// A commit's files from `--numstat -z` and `--name-status -z`, with renames (-M): a rename is
// "R100\0old\0new" in name-status and "add\tdel\t\0old\0new" in numstat (§4.5b B1).
export function commitFiles(numstat, nameStatus) {
  const status = new Map();
  const fields = nameStatus.split("\0");
  for (let i = 0; i < fields.length; ) {
    const code = fields[i];
    if (!code) break;
    if (code[0] === "R" || code[0] === "C") {
      status.set(fields[i + 2], { status: code[0], from: fields[i + 1] });
      i += 3;
    } else {
      status.set(fields[i + 1], { status: code[0] });
      i += 2;
    }
  }
  const files = [];
  const parts = numstat.split("\0");
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const [add, del, inline] = parts[i].split("\t");
    let path = inline;
    if (!inline) {
      path = parts[i + 2];
      i += 2;
    }
    const binary = add === "-";
    const named = status.get(path);
    files.push({
      path,
      add: binary ? 0 : Number(add),
      del: binary ? 0 : Number(del),
      binary,
      status: named?.status ?? "M",
      from: named?.from ?? null,
    });
  }
  return files;
}

// "2026-11-26 14:03:12 +08:00": the full time with its zone, for a tooltip.
export function stampFull(at) {
  const d = new Date(at * 1000);
  const two = (n) => String(Math.abs(n)).padStart(2, "0");
  const offset = -d.getTimezoneOffset();
  const zone = `${offset < 0 ? "-" : "+"}${two(Math.trunc(offset / 60))}:${two(offset % 60)}`;
  return `${stamp(at)}:${two(d.getSeconds())} ${zone}`;
}

const UNITS = [
  ["y", 31536000],
  ["mo", 2592000],
  ["w", 604800],
  ["d", 86400],
  ["h", 3600],
  ["m", 60],
];

export function timeAgo(at, now = Date.now() / 1000) {
  const seconds = Math.max(0, now - at);
  for (const [unit, size] of UNITS)
    if (seconds >= size) return `${Math.floor(seconds / size)}${unit} ago`;
  return "just now";
}

// "3h": a graph row's time.
export function shortAgo(at, now = Date.now() / 1000) {
  const seconds = Math.max(0, now - at);
  for (const [unit, size] of UNITS) if (seconds >= size) return `${Math.floor(seconds / size)}${unit}`;
  return "now";
}

// "2026-11-26 14:03": a commit's time in full.
export function stamp(at) {
  const d = new Date(at * 1000);
  const two = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

// "1,015": the runtime's toLocaleString adds no separators.
export const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// "owner/repo" for a GitHub remote URL (https, git@, or ssh), else null.
export function githubRepo(remote) {
  const match =
    /^(?:(?:https?|git):\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/(?:git@)?github\.com(?::[0-9]+)?\/)([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(
      (remote ?? "").trim(),
    );
  return match && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(match[1]) ? match[1] : null;
}
