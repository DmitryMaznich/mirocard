// Battleship-style column letters for the "coordinate" taskKind grid header.
// Skips Ё, Й and З (pronunciation/visual ambiguity). З is especially easy
// to mistake for the digit 3 when it stands directly beside a row number.
// docs/superpowers/specs/2026-08-12-symmetry-draw-coordinate-dictation-design.md.
export const COORDINATE_COLUMN_LETTERS = [
  "А", "Б", "В", "Г", "Д", "Е", "Ж", "И", "К", "Л", "М", "Н",
  "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ",
  "Ы", "Ь", "Э", "Ю", "Я",
];

export function columnLabel(col) {
  return COORDINATE_COLUMN_LETTERS[col] ?? `?${col}`;
}
