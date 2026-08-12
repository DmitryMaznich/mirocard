// Battleship-style column letters for the "coordinate" taskKind grid header.
// Skips Ё and Й (pronunciation/visual ambiguity) — see design doc
// docs/superpowers/specs/2026-08-12-symmetry-draw-coordinate-dictation-design.md.
export const COORDINATE_COLUMN_LETTERS = [
  "А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н",
  "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ",
  "Ы", "Ь", "Э", "Ю", "Я",
];

export function columnLabel(col) {
  return COORDINATE_COLUMN_LETTERS[col] ?? `?${col}`;
}
