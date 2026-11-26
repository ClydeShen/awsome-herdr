// Comment tokens per file type. Entered by hand from VS Code's built-in
// language-configuration.json (comments.lineComment / comments.blockComment).
// Keyed by file extension rather than highlighter name, because some
// extensions share a highlighter but not a comment style.

const TOKEN_GROUPS = [
  [
    ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "c", "h", "cc", "cpp", "cxx", "hpp", "hh",
      "cs", "java", "go", "rs", "swift", "kt", "kts", "scala", "dart", "php", "json", "jsonc",
      "groovy", "fs", "less", "scss"],
    { line: "//", block: ["/*", "*/"] },
  ],
  [
    ["py", "sh", "bash", "zsh", "fish", "rb", "pl", "pm", "yaml", "yml", "toml", "r", "dockerfile",
      "makefile", "mk", "cmake", "properties", "conf", "jl", "ex", "exs", "nim", "coffee",
      "gitignore", "gitattributes", "editorconfig"],
    { line: "#" },
  ],
  [["ps1"], { line: "#", block: ["<#", "#>"] }],
  [["sql"], { line: "--" }],
  [["lua"], { line: "--", block: ["--[[", "]]"] }],
  [["hs"], { line: "--", block: ["{-", "-}"] }],
  [["ini", "lisp", "el"], { line: ";" }],
  [["clj", "cljs"], { line: ";;" }],
  [["tex", "sty"], { line: "%" }],
  [["vb"], { line: "'" }],
  [["bat", "cmd"], { line: "@REM" }],
  [
    ["html", "htm", "xhtml", "xml", "svg", "vue", "svelte", "md", "markdown"],
    { block: ["<!--", "-->"] },
  ],
  [["css"], { block: ["/*", "*/"] }],
];

const TABLE = new Map();
for (const [keys, tokens] of TOKEN_GROUPS) {
  for (const key of keys) TABLE.set(key, tokens);
}

// Tokens for a file path, or null when the type has no known comment style.
// Names without a dot (Makefile, Dockerfile) are looked up by their whole lowercased name.
export function commentTokens(path) {
  const base = path.replace(/^.*[/\\]/, "").toLowerCase();
  const dot = base.lastIndexOf(".");
  const key = dot === -1 ? base : base.slice(dot + 1);
  return TABLE.has(key) ? TABLE.get(key) : null;
}
