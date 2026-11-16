// Papers of the print style («Печатные», docs/propis2-languages.md «Печатные на клетке»): the three papers of «Печатные буквы»
// (print_letters/model.js PAPERS, after Ilyukhina's «Волшебные линии», docs/print-letters-ilyukhina.md) for the propis2 engine.
// A capital is `letterMm` tall (10 mm: two 5 mm cells, or one big cell); its letters are written apart and each one starts ON a line of the
// paper's cells (`snapMm`, wordEngine.js `cell.onLines`): a letter takes half of its 1 cm letter-cell (two thirds when wide), so a word's
// letters stand one letter-cell apart, and a word starts a blank 1 cm (two cells) after the ink of the word before.
//   print_cell    — the 5 mm school cell, a row two cells tall with a blank cell above it (every edge of a letter on a line);
//   print_bigcell — the 1 cm cell of the workbook: one letter in one cell, writing rows every other row of cells;
//   print_line    — ruled rows 1 cm tall: the solid baseline, a dashed line at the letter's height, a blank 5 mm between rows.
// Row geometry from the page's top edge (the grid starts there, as the ordinary squared paper's): `firstMm` the first baseline, `pitchMm`
// baseline to baseline, `footMm` kept under the last row.
export const PRINT_PAPERS = {
  print_cell: { label: "Клетка", gridMm: 5, snapMm: 5, letterMm: 10, pitchMm: 15, firstMm: 15, footMm: 5 },
  print_bigcell: { label: "Крупная клетка", gridMm: 10, snapMm: 10, letterMm: 10, pitchMm: 20, firstMm: 20, footMm: 10 },
  print_line: { label: "Линейка", gridMm: 0, snapMm: 5, letterMm: 10, pitchMm: 15, firstMm: 15, footMm: 5, heightLine: true },
};
export const PRINT_PAPER_IDS = Object.keys(PRINT_PAPERS);
export const isPrintPaper = (id) => Object.hasOwn(PRINT_PAPERS, id ?? "");
export const printPaper = (id) => (isPrintPaper(id) ? PRINT_PAPERS[id] : null);
