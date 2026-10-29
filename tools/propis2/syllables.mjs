// Fills `syllables` on the dictation words of tools/propis2/topic.json («По слогам», 2026-10-29): the repeat that plays a word syllable by
// syllable, one recorded clip per syllable. Only words without `syllables` are filled, so a split the owner corrected by hand stays.
// The split is the school one (rising sonority, as Russian first-grade books teach it: ко-шка, лам-па, конь-ки, чай-ник):
// a syllable ends on its vowel; й, a doubled consonant's first half, a sonorant before a noisy consonant and a consonant with ь/ъ before
// another consonant stay with the syllable before; every other consonant group goes to the next one.
// Usage: node tools/propis2/syllables.mjs [--check]  (--check: print the splits, write nothing)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const VOWELS = "аеёиоуыэюя";
const SONORANTS = "лмнр";
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
  if (SIGNS.includes(group[1])) return group.length > 2 ? 2 : 0; // конь-ки, паль-то, but се-мья (the sign right before the vowel)
  if (group[0] === group[1]) return 1;
  if (SONORANTS.includes(group[0]) && !SONORANTS.includes(group[1])) return 1;
  return 0;
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
