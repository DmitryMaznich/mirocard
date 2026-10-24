// The alphabet a `propis2` deck writes. The Russian one is the default; a variant deck (tools/propis2/variants/<id>, built by
// scripts/build-propis2-deck.mjs --variant <id>) names its own in `meta.alphabet`: { lower, noCapital }. Everything that
// lists "the letters" — the letter cards of «Узнай букву» / «Строчная и заглавная», the dictation of letters, the letter tiles of
// the constructor, the alphabet on the back of the cover — reads it from here, never from a string of its own.
import { LETTER_DATA } from "../propis/letters/letterData.js";

export const RU_LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
const RU_NO_CAPITAL = ["ъ", "ы", "ь"];

const cache = new WeakMap();

// { lower: [letters in order], noCapital: Set, letters: LETTER_DATA-shaped cards (lettersEngine.js) }.
// `glyphMap` (pageTask.js buildGlyphMap), when given, drops a capital the deck has no ink for (it then counts as lowercase only),
// so a card is never drawn empty: Bulgarian Ъ has a capital, but none is captured yet.
export function topicAlphabet(topicRecord, glyphMap) {
  const hit = topicRecord ? cache.get(topicRecord) : null;
  if (hit && hit.glyphMap === glyphMap) return hit.value;
  const spec = topicRecord?.meta?.alphabet;
  const lower = [...(spec?.lower ?? RU_LOWER)];
  const noCapital = new Set(spec?.noCapital ?? RU_NO_CAPITAL);
  if (glyphMap) for (const ch of lower) if (!noCapital.has(ch) && !glyphMap.get(ch.toUpperCase())) noCapital.add(ch);
  const byLower = new Map(LETTER_DATA.map((l) => [l.params.printed_lower, l]));
  const letters = lower.map((ch) => {
    const base = byLower.get(ch);
    const hasUpper = !noCapital.has(ch);
    return {
      id: base?.id ?? `letter_${ch}`,
      conceptId: base?.conceptId ?? `letter_${ch}`,
      primary: true,
      params: { ...(base?.params ?? { tags: [] }), printed_lower: ch, printed_upper: hasUpper ? ch.toUpperCase() : null, has_upper: hasUpper },
    };
  });
  const value = { lower, noCapital, letters };
  if (topicRecord) cache.set(topicRecord, { glyphMap, value });
  return value;
}

// The letters the card modes show: both cases of every letter that has a capital, the lowercase of the rest.
export function cardLetters(alphabet) {
  return alphabet.letters.flatMap((l) => (l.params.has_upper ? [l.params.printed_upper, l.params.printed_lower] : [l.params.printed_lower]));
}
