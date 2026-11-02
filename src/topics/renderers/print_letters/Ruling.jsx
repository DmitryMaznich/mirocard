// Real physical size, in mm, not arbitrary screen pixels — this is a sheet
// meant to be printed. FINE_MM is a normal school-notebook cell (5mm). The
// page-wide background grid (print_letters.css, .pl-sheet) ticks every
// FINE_MM; every length in a block (LetterBlock.jsx) is a whole number of
// these cells, so nothing drifts off the printed grid lines. A letter is 2
// cells tall and 1 cell wide (2 for wide letters like Ш) — see topic.json.
export const FINE_MM = 5;
