// Syllables from the learned letters (owner, 2026-11-19): every open syllable
// «consonant + vowel» — М С К + А О У → МА МО МУ СА СО СУ КА КО КУ. Only what Russian
// writing has: no ЖЫ ШЫ ЦЫ / ЖЯ ШЮ (after Ж Ш Ц), no ЧЯ ЩЮ ЧЫ (after Ч Щ), no КЫ ГЫ ХЫ,
// no ЦЁ; Й Ь Ъ make no syllables. Reversals (АМ, ОС) are only tricky wrong options.
export const CONSONANTS = [..."БВГДЖЗКЛМНПРСТФХЦЧШЩ"];
export const VOWELS = [..."АОУЫЭЕЁИЮЯ"];

export function allowed(c, v) {
  if ("ЖШЦ".includes(c) && "ЫЯЮ".includes(v)) return false;
  if ("ЧЩ".includes(c) && "ЯЮЫ".includes(v)) return false;
  if ("КГХ".includes(c) && v === "Ы") return false;
  if (c === "Ц" && v === "Ё") return false;
  return true;
}

export function syllablesOf(letters) {
  const cs = CONSONANTS.filter((c) => letters.includes(c));
  const vs = VOWELS.filter((v) => letters.includes(v));
  return cs.flatMap((c) => vs.filter((v) => allowed(c, v)).map((v) => c + v));
}

export const allSyllables = () => syllablesOf([...CONSONANTS, ...VOWELS]);

// Wrong options that look or sound close: the reversal (МА → АМ), the same consonant
// with another vowel (МО), the same vowel with another consonant (НА) — learned first.
export function lookalikeSyllables(target, learned, count) {
  const [c, v] = target;
  const pool = syllablesOf(learned);
  const out = [];
  const add = (s) => { if (s && s !== target && !out.includes(s) && out.length < count) out.push(s); };
  add(v + c);
  const shuffled = (list) => [...list].sort(() => Math.random() - 0.5);
  const sameC = shuffled(pool.filter((s) => s[0] === c));
  const sameV = shuffled(pool.filter((s) => s[1] === v));
  for (let i = 0; i < Math.max(sameC.length, sameV.length); i++) { add(sameC[i]); add(sameV[i]); }
  shuffled(pool).forEach(add);
  shuffled(allSyllables()).forEach(add);
  return out;
}
