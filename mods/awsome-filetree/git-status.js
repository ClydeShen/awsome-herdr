// The one Git status every awsome mod shows (docs/REQUIREMENTS.md §2.4): a letter for each Git
// status code, its colour token, its word, its weight. Identical copies in awsome-filetree,
// awsome-changes and awsome-viewer (scripts/ui-check.py C5); no other code maps statuses (C15).

// A porcelain XY ("??", " M", "AM", "UU"…) or one --name-status letter ("R", "C", "T"…) as one of
// U D A R M, the first that holds: conflict, deleted, new (untracked, added, copied), renamed,
// modified (the rest, type changes too). "" for no change (" ", "!!").
export const gitLetter = (code) =>
  /U/.test(code) || code === "AA" || code === "DD" ? "U"
    : code.includes("D") ? "D"
    : code === "??" || code.includes("A") || code.includes("C") ? "A"
    : code.includes("R") ? "R"
    : /[MT]/.test(code) ? "M"
    : "";

const TOKEN = { M: "ansi3", A: "ansi2", D: "ansi1", R: "ansi6", U: "ansi5" };
export const gitColor = (t, letter) => (letter ? t[TOKEN[letter]] : null);

// Lower case, for tooltips and counts ("3 modified"); capitalise at the start of a tooltip.
export const GIT_WORD = { M: "modified", A: "new", D: "deleted", R: "renamed", U: "conflict" };

// A folder shows the weightiest status inside it: conflict, deleted, modified or renamed, new.
const WEIGHT = { A: 1, R: 2, M: 2, D: 3, U: 4 };
export const weightier = (a, b) => (!a ? b : !b ? a : WEIGHT[b] > WEIGHT[a] ? b : a);

// The order every list of statuses follows (§2.4): new, modified, renamed, deleted, conflict.
export const GIT_ORDER = ["A", "M", "R", "D", "U"];

// The summary's three counts (§2.9), in that order: new, modified (renamed and conflicts too), deleted.
export const gitBucket = (letter) => (letter === "A" ? 0 : letter === "D" ? 2 : 1);
