// Fills `syllables` on the dictation words of tools/propis2/topic.json («По слогам», 2026-10-29): the repeat that plays a word syllable by
// syllable, one recorded clip per syllable. Only words without `syllables` are filled, so a split the owner corrected by hand stays.
// The split is the one an adult says aloud dictating (owner's call, 2026-10-29: лож-ка, сес-тра, фут-бол-ка, not the first-grade
// book's ло-жка): one consonant between vowels goes to the next syllable (ма-ма); of a group of them the first one (with its ь/ъ)
// stays with the syllable before, й too (яй-цо, конь-ки); a sign right before the vowel goes on with its consonant (се-мья).
// Usage: node tools/propis2/syllables.mjs [--check]  (--check: print the splits, write nothing)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const VOWELS = "аеёиоуыэюя";
const SIGNS = "ьъ";

export function splitSyllables(word) {
  const lower = word.toLowerCase();
  const vowelAt = [...lower].flatMap((ch, i) => (VOWELS.includes(ch) ? [i] : []));
  if (vowelAt.length < 2) return [word];
  const cuts = [];
  for (let v = 0; v < vowelAt.length - 1; v += 1) {
    const from = vowelAt[v] + 1;
    const group = lower.slice(from, vowelAt[v + 1]);
    cuts.push(from + leftPart(group));
  }
  return [0, ...cuts].map((start, i) => word.slice(start, cuts[i] ?? word.length));
}

// how many letters of the consonant group between two vowels stay with the syllable before
function leftPart(group) {
  if (group.length < 2) return 0;
  if (group[0] === "й") return 1 + leftPart(group.slice(1));
  if (SIGNS.includes(group[1])) return group.length > 2 ? 2 : 0;
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = new URL("./topic.json", import.meta.url);
  const topic = JSON.parse(readFileSync(path, "utf8"));
  const check = process.argv.includes("--check");
  let filled = 0;
  for (const w of topic.words) {
    if (check) console.log(`${w.word}\t${(w.syllables ?? splitSyllables(w.word)).join("-")}`);
    else if (!w.syllables) { w.syllables = splitSyllables(w.word); filled += 1; }
  }
  if (!check) {
    const json = JSON.stringify(topic, null, 2).replace(/"syllables": \[[^\]]*\]/g, (m) => m.replace(/\s+/g, " ").replace("[ ", "[").replace(" ]", "]"));
    writeFileSync(path, `${json}\n`);
    console.log(`syllables filled: ${filled}`);
  }
}
