// A word of the dictation split into syllables, for the repeat «по слогам» (2026-10-29). The school rule: as many syllables as vowels;
// the consonants between two vowels go to the next syllable (an open syllable: мо-ло-ко, ко-шка), except й (it closes the syllable before:
// май-ка), a sonorant л м н р (with its ь) standing before another consonant (лам-па, вил-ка, конь-ки, мол-ни-я) and a doubled
// consonant, split in two (ван-на). A word the rule splits wrong
// gets its own `syl` in topic.json (words[].syl: ["…", "…"]), which wins.
const VOWELS = "аеёиоуыэюя";
const SONORANTS = "лмнр";
const isVowel = (ch) => VOWELS.includes(ch);
const isConsonant = (ch) => /[а-яё]/.test(ch) && !isVowel(ch) && ch !== "ь" && ch !== "ъ";

export function syllabify(word) {
  const w = String(word ?? "").toLowerCase();
  const nuclei = [...w].map((ch, i) => (isVowel(ch) ? i : -1)).filter((i) => i >= 0);
  if (nuclei.length < 2) return w ? [w] : [];
  const cuts = [];
  for (let k = 0; k < nuclei.length - 1; k += 1) {
    const from = nuclei[k] + 1;
    const to = nuclei[k + 1]; // the cluster between the two vowels: w.slice(from, to)
    let cut = from;
    if (w[cut] === "й") cut += 1;
    if (w[cut] === w[cut + 1] && cut + 1 < to) cut += 1; // a doubled consonant splits: ван-на
    else if (SONORANTS.includes(w[cut])) {
      const after = w[cut + 1] === "ь" ? cut + 2 : cut + 1;
      if (after < to && isConsonant(w[after]) && w[after] !== "й") cut = after;
    }
    cuts.push(cut);
  }
  const out = [];
  let start = 0;
  for (const c of cuts) { out.push(w.slice(start, c)); start = c; }
  out.push(w.slice(start));
  return out;
}

// The syllables of a topic.json word entry: its own `syl` if it has one, else the rule.
export const wordSyllables = (entry) => (Array.isArray(entry?.syl) && entry.syl.length ? entry.syl.map((s) => s.toLowerCase()) : syllabify(entry?.word));

// The clip of a syllable: /audio/propis-dictation/syl_<syllable>.mp3, one clip per syllable shared by every word that has it (ло in
// мо-ло-ко and со-ло-ма). Lowercase only, so the Cyrillic key cannot collide on a case-folding filesystem (dictationAudio.js).
export const syllableDictationKey = (syllable) => `syl_${String(syllable).toLowerCase()}`;
