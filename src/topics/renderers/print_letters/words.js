import { TILE, copyPitch, letterW, rowCells } from "./model";

// Syllable and word blocks (owner, 2026-11-03: «блок — это то, что пишем»; mockup
// docs/mockups/print-letters-words.html). A word block is
//   { id, kind: "word", words: ["НИ", "НЕ"], color, size, rows }
// and each of its rows is { id, text, elements, line, guide, dots } — `text` one of the block's
// words, `elements` the positions of the letters drawn on the contours after the sample (a left-out
// letter leaves its letter-cell blank: «впиши пропущенную»); [] is a blank row. The sample — the
// row's first copy — always shows the whole word. Words are made only of letters the topic has
// drawn (byId); no typing.
//
// Geometry, as in Ilyukhina's workbook: every letter of a word stands in its own letter-cell (the
// copy pitch, 2 of our cells at the normal size), and one clean letter-cell separates the words.

export const VOWELS = new Set([..."АЕЁИОУЫЭЮЯ"]);
export const ALPHABET = [..."АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"];

// The look of a new word row: dotted contours to the end, start dots on the sample only (dots on
// every letter of every copy turn a row of words into green noise).
export const WORD_STYLE = { line: "dash", guide: "full", dots: "sample", arrows: true };

export const isWordBlock = (block) => block?.kind === "word";

export function canWrite(text, byId) {
  return text.length > 0 && [...text].every((ch) => byId[ch]);
}

export function wordLetters(text, byId) {
  return [...text].map((ch) => byId[ch]).filter(Boolean);
}

export const allLetterIdx = (text) => [...text].map((_, i) => i);

// ---- plate ----------------------------------------------------------------
// The plate is as tall as a letter's (4 cells) and grows with the word: 2 cells a character plus a
// cell at each side (НИ — 6, НЕТ — 8), at most 14; words that don't fit are left off the plate.
const PLATE_MAX = 14;
export function plateWords(block) {
  const out = [];
  for (const w of block.words ?? []) {
    const next = [...out, w].join(" ");
    if (out.length && 2 + 2 * next.length > PLATE_MAX) break;
    out.push(w);
  }
  return out;
}
export function plateCells(block) {
  if (!isWordBlock(block)) return TILE;
  const n = plateWords(block).join(" ").length;
  return Math.min(PLATE_MAX, Math.max(TILE, 2 + 2 * n));
}

// ---- a word in a row ------------------------------------------------------
export function wordWidthCells(letters, size = 2) {
  if (!letters.length) return 0;
  return (letters.length - 1) * copyPitch(size) + letterW(letters[letters.length - 1], size);
}
export function wordPitchCells(letters, size = 2) {
  return (letters.length + 1) * copyPitch(size);
}
export function wordCopiesPerRow(letters, formatId, besidePlate, size, paper, plateW) {
  const w = wordWidthCells(letters, size);
  return Math.max(1, Math.floor((rowCells(formatId, besidePlate, paper, plateW) - w) / wordPitchCells(letters, size)) + 1);
}

// ---- rows -----------------------------------------------------------------
const vowelGaps = (text) => {
  const idx = allLetterIdx(text);
  const keep = idx.filter((i) => !VOWELS.has(text[i]));
  return keep.length && keep.length < idx.length ? keep : null;
};

// The ladder of a word block: the word over dotted contours → the vowel left out («впиши
// пропущенную») → a half-tone fading along the row → the sample alone → a blank row. With several
// words (a block of syllables): each over dotted contours, then each fading, then a blank row.
export function wordLadderRows(words) {
  const row = (text, extra = {}) => ({ text, elements: allLetterIdx(text), ...WORD_STYLE, ...extra });
  if (words.length === 1) {
    const [w] = words;
    const rows = [row(w)];
    const gaps = vowelGaps(w);
    if (gaps) rows.push(row(w, { elements: gaps }));
    rows.push(row(w, { line: "tone", guide: "fade" }));
    rows.push(row(w, { line: "tone", guide: "none" }));
    rows.push({ ...row(w), elements: [] });
    return rows;
  }
  return [
    ...words.map((w) => row(w)),
    ...words.map((w) => row(w, { line: "tone", guide: "fade" })),
    { ...row(words[0]), elements: [] },
  ];
}

// ---- what to offer --------------------------------------------------------
// Syllables: a consonant and a vowel, from the drawn letters, without spellings Russian doesn't
// use (ШЫ, ГЯ …).
const NO_AFTER = { Ш: "ЫЯЮ", Ж: "ЫЯЮ", Ч: "ЫЯЮ", Щ: "ЫЯЮ", Ц: "ЯЮЁ", Г: "ЫЯЮЁ", К: "ЫЯЮЁ", Х: "ЫЯЮЁ" };
const NOT_CONSONANT = new Set([..."ЬЪЙ"]);
export function syllableSuggestions(byId) {
  const have = ALPHABET.filter((ch) => byId[ch]);
  const vowels = have.filter((ch) => VOWELS.has(ch));
  const consonants = have.filter((ch) => !VOWELS.has(ch) && !NOT_CONSONANT.has(ch));
  const out = [];
  for (const c of consonants) for (const v of vowels) if (!(NO_AFTER[c] ?? "").includes(v)) out.push(c + v);
  return out;
}

// Short everyday words for 4–6-year-olds; only those made of drawn letters are offered, so the list
// grows by itself as letters are added.
const WORDS = [
  "НЕТ", "ТИП", "ШИП", "ТИШЕ", "ТЕНИ",
  "МАМА", "ПАПА", "БАБА", "ДОМ", "КОТ", "СОК", "НОС", "РОТ", "ЛУК", "СУП", "ЛЕС", "ДЫМ", "ДУБ", "МАК",
  "РАК", "СОМ", "МЯЧ", "ШАР", "ШУМ", "ЖУК", "ЁЖ", "ДА", "ОН", "ОНА", "МЫ", "ВЫ", "ТЫ", "КИТ", "ПОЛ",
  "ЛИСА", "РЫБА", "ЗИМА", "ВОДА", "НОГА", "РУКА", "КАША", "ЛУНА", "САНИ", "ОСА", "УХО", "ИВА", "ПИЛА",
  "ВАТА", "НОТЫ", "ПЕНА", "ТИНА", "МИНА", "ШИНА", "ТАНК", "ПАУК", "СЫР", "ЧАЙ", "ЛЕВ", "ВОЛК", "ЗАЯЦ",
];
export function wordSuggestions(byId) {
  return WORDS.filter((w) => canWrite(w, byId));
}
