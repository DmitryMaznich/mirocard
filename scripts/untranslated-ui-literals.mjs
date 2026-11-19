// Russian text written straight into the app's interface code instead of the
// dictionaries (src/shared/i18n). Counts, per file, string literals, template
// text and JSX text containing Cyrillic — comments do not count.
//
//   node scripts/untranslated-ui-literals.mjs          list the counts
//   node scripts/untranslated-ui-literals.mjs --write  save them as the baseline
//
// src/shared/i18n/untranslatedLiterals.test.js fails when a file gets more
// such strings than its baseline (or a new file has any): new interface text
// goes into the dictionaries. Moving a screen to the dictionaries lowers its
// count; then run --write so the baseline follows. Lesson material in topics
// (src/topics) is outside this check: it is content, not interface
// (docs/localization/adding-a-language.md).
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "@babel/parser";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE_PATH = join(ROOT, "src/shared/i18n/untranslated-baseline.json");
const SCOPE = ["src/features", "src/shared/components", "src/App.jsx", "src/core"];
const CYRILLIC = /[А-Яа-яЁё]/;
const SKIP_KEYS = new Set(["loc", "start", "end", "leadingComments", "trailingComments", "innerComments", "extra"]);

function count(source) {
  let n = 0;
  const walk = (node) => {
    if (!node || typeof node.type !== "string") return;
    const text = node.type === "StringLiteral" ? node.value
      : node.type === "TemplateElement" ? node.value.cooked
      : node.type === "JSXText" ? node.value : null;
    if (text && CYRILLIC.test(text)) n += 1;
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") walk(value);
    }
  };
  walk(parse(source, { sourceType: "module", plugins: ["jsx"], errorRecovery: true }).program);
  return n;
}

export function scanUntranslatedLiterals() {
  const files = execSync(`git ls-files ${SCOPE.join(" ")}`, { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter((file) => /\.(jsx?|mjs)$/.test(file) && !/\.(test|spec)\./.test(file));
  const counts = {};
  for (const file of files) {
    const n = count(readFileSync(join(ROOT, file), "utf8"));
    if (n) counts[file] = n;
  }
  return counts;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const counts = scanUntranslatedLiterals();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (process.argv.includes("--write")) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2)}\n`);
    console.log(`baseline: ${total} strings in ${Object.keys(counts).length} files → ${BASELINE_PATH}`);
  } else {
    for (const [file, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), file);
    console.log(`${total} strings in ${Object.keys(counts).length} files`);
  }
}
