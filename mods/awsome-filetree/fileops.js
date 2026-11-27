// File operations for the Files tree (docs/REQUIREMENTS.md §4.3c). Pure data: every function
// returns what to run, and the caller runs it with `exec`. No imports, so this also runs in Node.
//
// Safety rules kept here:
// - Nothing overwrites. Creates and renames refuse an existing target.
// - `mv -n` exits 0 even when it refuses, so every POSIX rename checks the result itself.
// - The only delete commands are in removeEmptyPlan, and they refuse anything that is not empty.
// - Move to Trash never falls back to rm, rmdir or Remove-Item.

export const MESSAGES = {
  trashFailed: (name) => `Could not move “${name}” to the Trash`,
  trashDone: (name) => `Moved “${name}” to the Trash`,
  notEmpty: "Not empty; left in place",
  windowsDisabled: "Not yet verified on Windows",
  remoteDisabled: "The folder is on another machine",
};

const RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

// Case-insensitive on macOS and Windows, exact on Linux.
export const casePolicy = (platform) => platform === "macos" || platform === "windows";

const sameName = (platform, a, b) => (casePolicy(platform) ? a.toLowerCase() === b.toLowerCase() : a === b);

// Quotes a value for a PowerShell single-quoted string. The four curly single quotes are
// PowerShell quote characters too, so each one is doubled like the straight quote.
export const psQuote = (s) => "'" + String(s).replace(/['‘’‚‛]/g, "$&$&") + "'";

const invalidSegment = (seg, platform) => {
  if (seg === "." || seg === "..") return true;
  if (seg.includes("\0")) return true;
  if (platform === "windows") {
    if (/[<>:"|?*]/.test(seg)) return true;
    if (/[ .]$/.test(seg)) return true;
    if (RESERVED.has(seg.split(".")[0].toUpperCase())) return true;
  }
  return false;
};

// Checks a name typed into the inline input (VS Code's validateFileName order, shorter texts: L10).
// `taken` holds the names already in the same folder; the item being renamed is left out by the caller.
// Empty segments (a trailing slash, a doubled slash) are ignored, so `isDir` makes no difference.
export function validateName(name, { platform, taken = [] } = {}) {
  const fail = (error) => ({ error, warning: null });
  if (name.trim() === "") return fail("Enter a name");
  if (/^[\/\\]/.test(name)) return fail("No leading slash");

  const segments = name.split(/[\/\\]/).filter((s) => s !== "");
  const first = segments[0];
  if (taken.some((t) => sameName(platform, t, first))) {
    return fail(`“${first}” already exists`);
  }
  const bad = segments.find((seg) => invalidSegment(seg, platform));
  if (bad !== undefined) {
    return fail(`“${bad}” is not a valid name`);
  }
  const warning = name !== name.trim() ? "Leading or trailing space" : null;
  return { error: null, warning };
}

// Splits an absolute path into its folder part (separator included) and its leaf name.
const splitLeaf = (platform, abs) => {
  const re = platform === "windows" ? /[\\/]/g : /\//g;
  let idx = -1;
  for (const m of abs.matchAll(re)) idx = m.index;
  return { dir: abs.slice(0, idx + 1), leaf: abs.slice(idx + 1) };
};

const POSIX_FILE = 'mkdir -p -- "$(dirname -- "$1")" && { set -C; : > "$1"; }';
const POSIX_FOLDER = 'mkdir -p -- "$(dirname -- "$1")" && mkdir -- "$1"';
// Refuses an existing target first (mv would move a file into an existing folder). After the
// move, the source must be gone and the target present; `mv -n` alone cannot be trusted.
const POSIX_RENAME =
  '[ ! -e "$2" ] && [ ! -L "$2" ] && mv -n -- "$1" "$2" && { [ ! -e "$1" ] && [ ! -L "$1" ] && { [ -e "$2" ] || [ -L "$2" ]; }; }';
// Only a regular, non-link file with zero bytes; rmdir only removes an empty folder.
const POSIX_REMOVE_EMPTY_FILE = '[ -f "$1" ] && [ ! -L "$1" ] && [ ! -s "$1" ] && rm -- "$1"';
const POSIX_REMOVE_EMPTY_FOLDER = 'rmdir -- "$1"';
const JXA_TRASH = `ObjC.import('Foundation');
function run(argv) {
  const path = argv[0];
  const fm = $.NSFileManager.defaultManager;
  if (!fm.fileExistsAtPath(path)) throw new Error('No such file or folder');
  const ok = fm.trashItemAtURLResultingItemURLError($.NSURL.fileURLWithPath(path), null, Ref());
  if (!ok) throw new Error('Could not move to the Trash');
}`;

const posix = (script, abs, ...more) => ({ program: "/bin/sh", args: ["-c", script, "sh", abs, ...more] });
const powershell = (script) => ({ program: "powershell", args: ["-NoProfile", "-NonInteractive", "-Command", script] });

// One exec call that creates a new empty file or folder, with its missing parents.
// Fails (non-zero) when the item already exists.
export function createPlan(platform, kind, abs) {
  if (platform === "windows") {
    // New-Item has no -LiteralPath and treats [ ] as wildcards, so these use .NET and Test-Path -LiteralPath.
    const q = psQuote(abs);
    const guard = `$p = ${q}; if (Test-Path -LiteralPath $p) { throw 'exists' }`;
    if (kind === "folder") return powershell(`${guard}; [void][System.IO.Directory]::CreateDirectory($p)`);
    return powershell(
      `${guard}; [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($p)); [System.IO.File]::Open($p, [System.IO.FileMode]::CreateNew).Dispose()`,
    );
  }
  return posix(kind === "folder" ? POSIX_FOLDER : POSIX_FILE, abs);
}

// The exec calls for a rename, to run in order. Stops at the first non-zero exit.
// A case-only change on macOS or Windows goes through a hidden temp name, because those
// filesystems treat the two names as one. `tag` makes the temp name unique (the caller's choice).
export function renamePlan(platform, from, to, tag = "0") {
  if (from === to) return [];
  const a = splitLeaf(platform, from);
  const b = splitLeaf(platform, to);
  const caseOnly = sameName(platform, from, to) && casePolicy(platform);

  if (platform === "windows") {
    const step = (src, leafName) => powershell(`Rename-Item -LiteralPath ${psQuote(src)} -NewName ${psQuote(leafName)} -ErrorAction Stop`);
    if (!caseOnly) return [step(from, b.leaf)];
    const temp = `.${a.leaf}.rename-${tag}`;
    return [step(from, temp), step(a.dir + temp, b.leaf)];
  }
  if (caseOnly && casePolicy(platform)) {
    const temp = `${a.dir}.${a.leaf}.rename-${tag}`;
    return [posix(POSIX_RENAME, from, temp), posix(POSIX_RENAME, temp, to)];
  }
  return [posix(POSIX_RENAME, from, to)];
}

// Move to the system's Trash. Never rm: a failure leaves the item where it is.
export function trashPlan(platform, abs) {
  if (platform === "windows") return { disabled: MESSAGES.windowsDisabled };
  if (platform === "macos") return { program: "osascript", args: ["-l", "JavaScript", "-e", JXA_TRASH, abs] };
  return { program: "gio", args: ["trash", "--", abs] };
}

// Undo of a just-created item only. Applies only when the item is still empty: a file with 0 bytes
// or a folder with no children. Anything else makes the command fail and leaves the item alone.
export function removeEmptyPlan(platform, kind, abs) {
  if (platform === "windows") {
    const q = psQuote(abs);
    if (kind === "folder") {
      return powershell(
        `$c = @(Get-ChildItem -LiteralPath ${q} -Force -ErrorAction Stop); if ($c.Count -eq 0) { Remove-Item -LiteralPath ${q} -ErrorAction Stop } else { exit 1 }`,
      );
    }
    return powershell(
      `$i = Get-Item -LiteralPath ${q} -ErrorAction Stop; if ($i.Length -eq 0) { Remove-Item -LiteralPath ${q} -ErrorAction Stop } else { exit 1 }`,
    );
  }
  return posix(kind === "folder" ? POSIX_REMOVE_EMPTY_FOLDER : POSIX_REMOVE_EMPTY_FILE, abs);
}
