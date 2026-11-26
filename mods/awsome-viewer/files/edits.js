// Pure text edits for the editor: comments, moving and duplicating lines.
// Offsets are UTF-16 indexes into LF-only text. Every edit returns either null
// or { start, end, replacement, select }: replace text.slice(start, end) with
// replacement; select is the new selection in offsets of the new text.

function countNewlines(text, end) {
  let n = 0;
  for (let i = 0; i < end; i++) if (text[i] === "\n") n++;
  return n;
}

// Start of the line that contains pos.
function lineStartAt(text, pos) {
  return pos === 0 ? 0 : text.lastIndexOf("\n", pos - 1) + 1;
}

// End of the line that contains pos (the offset of its "\n", or text.length).
function lineEndAt(text, pos) {
  const i = text.indexOf("\n", pos);
  return i === -1 ? text.length : i;
}

// The lines an action applies to, following VS Code: a multi-line selection
// that ends at column 0 does not include that last line.
export function touchedLines(text, sel) {
  const first = countNewlines(text, sel.start);
  let last = countNewlines(text, sel.end);
  const endsAtLineStart = sel.end === lineStartAt(text, sel.end);
  if (sel.start !== sel.end && last > first && endsAtLineStart) last -= 1;

  const from = lineStartAt(text, sel.start);
  let to = from;
  for (let i = first; i < last; i++) to = text.indexOf("\n", to) + 1;
  to = lineEndAt(text, to);
  return { first, last, from, to };
}

// Comment or uncomment lines (line token), or wrap or unwrap the block (block tokens).
export function toggleComment(text, sel, tokens) {
  if (!tokens || (!tokens.line && !tokens.block)) return null;
  const t = touchedLines(text, sel);
  if (tokens.line) return toggleLine(text, sel, t, tokens.line);
  return toggleBlock(text, t, tokens.block);
}

function toggleLine(text, sel, t, token) {
  const lines = text.slice(t.from, t.to).split("\n");
  const indentOf = (line) => line.match(/^\s*/)[0].length;
  const isBlank = (line) => indentOf(line) === line.length;

  const code = lines.filter((line) => !isBlank(line));
  // VS Code uncomments only when every non-blank line is already commented.
  const uncomment = code.length > 0 && code.every((line) => line.slice(indentOf(line)).startsWith(token));
  const minIndent = code.length > 0 ? Math.min(...code.map(indentOf)) : 0;

  // One edit per line: at column `col`, remove `removed` chars, insert `inserted`.
  const edits = lines.map((line) => {
    if (uncomment) {
      if (isBlank(line)) return null;
      const col = indentOf(line);
      const removed = line[col + token.length] === " " ? token.length + 1 : token.length;
      return { col, removed, inserted: "" };
    }
    // All lines blank: VS Code puts the token at the end of each line's indentation.
    if (code.length === 0) return { col: indentOf(line), removed: 0, inserted: token + " " };
    if (isBlank(line)) return null;
    return { col: minIndent, removed: 0, inserted: token + " " };
  });

  const newLines = lines.map((line, i) => {
    const e = edits[i];
    if (!e) return line;
    return line.slice(0, e.col) + e.inserted + line.slice(e.col + e.removed);
  });
  const replacement = newLines.join("\n");

  // Map an offset in the old text to the new text, line by line. A selection that starts where
  // the token goes takes it in, as in VS Code (`keep`).
  const newCol = (c, e, keep) => {
    if (!e || c < e.col || (keep && c === e.col)) return c;
    if (c >= e.col + e.removed) return c - e.removed + e.inserted.length;
    return e.col + e.inserted.length;
  };
  const mapOffset = (p, keep = false) => {
    if (p < t.from) return p;
    if (p > t.to) return p + replacement.length - (t.to - t.from);
    let origStart = t.from;
    let newStart = t.from;
    for (let i = 0; i < lines.length; i++) {
      const origEnd = origStart + lines[i].length;
      if (p <= origEnd) return newStart + newCol(p - origStart, edits[i], keep);
      origStart = origEnd + 1;
      newStart += newLines[i].length + 1;
    }
    return p;
  };

  return {
    start: t.from,
    end: t.to,
    replacement,
    select: { start: mapOffset(sel.start, sel.start !== sel.end), end: mapOffset(sel.end) },
  };
}

function toggleBlock(text, t, [open, close]) {
  const block = text.slice(t.from, t.to);

  // Whitespace-only block: insert an empty pair and put the cursor between the spaces.
  if (block.trim() === "") {
    const at = t.to;
    return {
      start: at,
      end: at,
      replacement: open + "  " + close,
      select: { start: at + open.length + 1, end: at + open.length + 1 },
    };
  }

  // Keep the surrounding whitespace outside the wrap.
  const lead = block.match(/^\s*/)[0];
  const trail = block.match(/\s*$/)[0];
  const inner = block.slice(lead.length, block.length - trail.length);

  let wrapped;
  if (inner.length >= open.length + close.length && inner.startsWith(open) && inner.endsWith(close)) {
    // Unwrap: drop the one space after open and the one space before close.
    let body = inner.slice(open.length);
    if (body[0] === " ") body = body.slice(1);
    body = body.slice(0, body.length - close.length);
    if (body.endsWith(" ")) body = body.slice(0, -1);
    wrapped = body;
  } else {
    wrapped = open + " " + inner + " " + close;
  }

  const replacement = lead + wrapped + trail;
  return {
    start: t.from,
    end: t.to,
    replacement,
    select: { start: t.from, end: t.from + replacement.length },
  };
}

// Move the touched lines one line up (dir -1) or down (dir +1).
export function moveLines(text, sel, dir) {
  const t = touchedLines(text, sel);
  if (dir < 0 && t.first === 0) return null;
  if (dir > 0 && t.last === countNewlines(text, text.length)) return null;

  const block = text.slice(t.from, t.to);
  const blockLen = block.length;

  if (dir < 0) {
    // Swap the block with the line above it.
    const prevStart = lineStartAt(text, t.from - 1);
    const prev = text.slice(prevStart, t.from - 1);
    const replacement = block + "\n" + prev;
    const map = (p) => {
      if (p >= t.from && p <= t.to) return p - prev.length - 1;
      if (p >= prevStart && p < t.from) return p + blockLen + 1;
      return p;
    };
    return {
      start: prevStart,
      end: t.to,
      replacement,
      select: { start: map(sel.start), end: map(sel.end) },
    };
  }

  // Swap the block with the line below it.
  const nextStart = t.to + 1;
  const nextEnd = lineEndAt(text, nextStart);
  const next = text.slice(nextStart, nextEnd);
  const replacement = next + "\n" + block;
  const map = (p) => {
    if (p >= t.from && p <= t.to) return p + next.length + 1;
    if (p >= nextStart && p <= nextEnd) return p - blockLen - 1;
    return p;
  };
  return {
    start: t.from,
    end: nextEnd,
    replacement,
    select: { start: map(sel.start), end: map(sel.end) },
  };
}

// Copy the touched lines and insert the copy below them; the selection moves to the copy.
export function duplicateLines(text, sel) {
  const t = touchedLines(text, sel);
  const block = text.slice(t.from, t.to);
  const shift = block.length + 1;
  return {
    start: t.to,
    end: t.to,
    replacement: "\n" + block,
    select: { start: sel.start + shift, end: sel.end + shift },
  };
}

// Delete the touched lines with one newline. The cursor goes to the same column
// on the line that takes their place.
export function deleteLines(text, sel) {
  const t = touchedLines(text, sel);
  const col = sel.start - lineStartAt(text, sel.start);
  if (t.to < text.length) {
    // Take the following newline; the next line moves up into this place.
    const next = t.to + 1;
    const pos = t.from + Math.min(col, lineEndAt(text, next) - next);
    return { start: t.from, end: next, replacement: "", select: { start: pos, end: pos } };
  }
  if (t.from > 0) {
    // Last line: take the newline before it; the line above takes its place.
    const prevStart = lineStartAt(text, t.from - 1);
    const pos = prevStart + Math.min(col, t.from - 1 - prevStart);
    return { start: t.from - 1, end: t.to, replacement: "", select: { start: pos, end: pos } };
  }
  // The only line: the text becomes empty.
  return { start: 0, end: text.length, replacement: "", select: { start: 0, end: 0 } };
}

// Add an empty line above (dir -1) or below (dir +1) the touched lines, with the same indent.
export function insertLine(text, sel, dir) {
  const t = touchedLines(text, sel);
  // Above uses the first touched line, below the last one.
  const at = dir < 0 ? t.from : t.to;
  const line = text.slice(lineStartAt(text, at), lineEndAt(text, at));
  const indent = line.match(/^[ \t]*/)[0];
  if (dir < 0) {
    const pos = t.from;
    return {
      start: pos,
      end: pos,
      replacement: indent + "\n",
      select: { start: pos + indent.length, end: pos + indent.length },
    };
  }
  const pos = t.to;
  const cursor = pos + 1 + indent.length;
  return { start: pos, end: pos, replacement: "\n" + indent, select: { start: cursor, end: cursor } };
}

// Select whole lines. Covered lines are extended by the next line; otherwise the
// selection grows to whole touched lines. The edit itself is a no-op.
export function selectLine(text, sel) {
  const covers =
    sel.start !== sel.end &&
    sel.start === lineStartAt(text, sel.start) &&
    (sel.end === text.length || sel.end === lineStartAt(text, sel.end));
  let start;
  let end;
  if (covers) {
    if (sel.end === text.length) return null;
    start = sel.start;
    const nextEnd = lineEndAt(text, sel.end);
    end = nextEnd < text.length ? nextEnd + 1 : text.length;
  } else {
    const t = touchedLines(text, sel);
    start = t.from;
    end = t.to < text.length ? t.to + 1 : text.length;
  }
  if (start === sel.start && end === sel.end) return null;
  return { start: sel.start, end: sel.start, replacement: "", select: { start, end } };
}

// Indent (dir +1) or outdent (dir -1) the touched lines by one unit ("\t" or spaces).
export function indentLines(text, sel, unit, dir) {
  const t = touchedLines(text, sel);
  const lines = text.slice(t.from, t.to).split("\n");
  const blank = (line) => /^[ \t]*$/.test(line);
  const allBlank = lines.every(blank);
  // A selection keeps its start at column 0 when indenting, as VS Code does.
  const keep = sel.start !== sel.end;

  // Characters added (> 0) or removed (< 0) at the start of each line.
  const delta = lines.map((line) => {
    if (dir > 0) return blank(line) && !allBlank ? 0 : unit.length;
    if (unit && line.startsWith(unit)) return -unit.length;
    // A tab is one indent when the unit is spaces.
    if (!unit.startsWith("\t") && line.startsWith("\t")) return -1;
    return -Math.min(line.match(/^ */)[0].length, unit.length);
  });
  const newLines = lines.map((line, i) => {
    const d = delta[i];
    if (d > 0) return unit + line;
    if (d < 0) return line.slice(-d);
    return line;
  });
  const replacement = newLines.join("\n");
  if (replacement === text.slice(t.from, t.to)) return null;

  // Map an offset in the old text to the new text, line by line.
  const map = (p, isStart) => {
    if (p < t.from) return p;
    if (p > t.to) return p + replacement.length - (t.to - t.from);
    let origStart = t.from;
    let newStart = t.from;
    for (let i = 0; i < lines.length; i++) {
      const origEnd = origStart + lines[i].length;
      if (p <= origEnd) {
        const c = p - origStart;
        const d = delta[i];
        let col;
        if (d > 0) col = isStart && keep && c === 0 ? 0 : c + d;
        else col = Math.max(0, c + d);
        return newStart + col;
      }
      origStart = origEnd + 1;
      newStart += newLines[i].length + 1;
    }
    return p;
  };

  return {
    start: t.from,
    end: t.to,
    replacement,
    select: { start: map(sel.start, true), end: map(sel.end, false) },
  };
}

// Wrap the selection in a block comment, or unwrap it when it already is one.
// An empty selection inserts an empty pair with the cursor between the spaces.
export function toggleBlockComment(text, sel, block) {
  if (!block) return null;
  const [open, close] = block;
  const selected = text.slice(sel.start, sel.end);
  const inner = selected.trim();

  if (inner.length >= open.length + close.length && inner.startsWith(open) && inner.endsWith(close)) {
    // Unwrap: drop one space after the open token and one before the close token.
    const lead = selected.match(/^\s*/)[0];
    const trail = selected.slice(lead.length + inner.length);
    let body = inner.slice(open.length, inner.length - close.length);
    if (body.startsWith(" ")) body = body.slice(1);
    if (body.endsWith(" ")) body = body.slice(0, -1);
    const start = sel.start + lead.length;
    return {
      start: sel.start,
      end: sel.end,
      replacement: lead + body + trail,
      select: { start, end: start + body.length },
    };
  }

  if (sel.start === sel.end) {
    const at = sel.start + open.length + 1;
    return {
      start: sel.start,
      end: sel.start,
      replacement: open + "  " + close,
      select: { start: at, end: at },
    };
  }

  const replacement = open + " " + selected + " " + close;
  return {
    start: sel.start,
    end: sel.end,
    replacement,
    select: { start: sel.start, end: sel.start + replacement.length },
  };
}

// Bracket pairs. Strings and comments are not skipped: a bracket inside them still counts.
const OPENER = { "(": ")", "[": "]", "{": "}" };
const CLOSER = { ")": "(", "]": "[", "}": "{" };
const isBracket = (ch) => ch in OPENER || ch in CLOSER;

// Offset of the bracket that pairs with text[i], counting only brackets of the same kind.
function samePartner(text, i) {
  const ch = text[i];
  let depth = 0;
  if (OPENER[ch]) {
    for (let j = i; j < text.length; j++) {
      if (text[j] === ch) depth += 1;
      else if (text[j] === OPENER[ch]) {
        depth -= 1;
        if (depth === 0) return j;
      }
    }
    return -1;
  }
  for (let j = i; j >= 0; j--) {
    if (text[j] === ch) depth += 1;
    else if (text[j] === CLOSER[ch]) {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return -1;
}

// Offset of the nearest opener before p that no closer before p matches, any kind.
function enclosingOpener(text, p) {
  const stack = [];
  for (let i = p - 1; i >= 0; i--) {
    const ch = text[i];
    if (CLOSER[ch]) stack.push(ch);
    else if (OPENER[ch]) {
      // Kinds are not checked against the stack; the scan is only an approximation.
      if (stack.length) stack.pop();
      else return i;
    }
  }
  return -1;
}

// Move the cursor to the bracket that pairs with the one next to it. With no bracket
// next to it, move to the closer of the nearest enclosing opener.
export function matchBracket(text, sel) {
  const p = sel.end;
  let q;
  if (p < text.length && isBracket(text[p])) q = samePartner(text, p);
  else if (p > 0 && isBracket(text[p - 1])) q = samePartner(text, p - 1);
  else {
    const open = enclosingOpener(text, p);
    q = open < 0 ? -1 : samePartner(text, open);
  }
  if (q < 0) return null;
  return { start: p, end: p, replacement: "", select: { start: q, end: q } };
}

// Join the touched lines, or the cursor line with the next one. Leading whitespace of
// the joined lines is dropped; one space joins them unless either side has none to add.
export function joinLines(text, sel) {
  const t = touchedLines(text, sel);
  let lines;
  let to;
  if (t.last > t.first) {
    lines = text.slice(t.from, t.to).split("\n");
    to = t.to;
  } else {
    if (t.to >= text.length) return null;
    to = lineEndAt(text, t.to + 1);
    lines = [text.slice(t.from, t.to), text.slice(t.to + 1, to)];
  }

  let joined = lines[0];
  let cursor = joined.length;
  for (let i = 1; i < lines.length; i++) {
    const rest = lines[i].replace(/^[ \t]+/, "");
    const space = joined !== "" && !/[ \t]$/.test(joined) && rest !== "" ? " " : "";
    cursor = joined.length + space.length;
    joined += space + rest;
  }
  const pos = t.from + cursor;
  return { start: t.from, end: to, replacement: joined, select: { start: pos, end: pos } };
}

// Remove trailing spaces and tabs from every line.
export function trimTrailing(text) {
  return text.replace(/[ \t]+$/gm, "");
}

// End the text with one newline, unless it is empty or already ends with one.
export function withFinalNewline(text) {
  return text === "" || text.endsWith("\n") ? text : text + "\n";
}
