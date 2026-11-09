// Four-line copybook papers (docs/latin-letters.md, step 3.2): a writing row = top line (capitals, ascenders), x-line (top of the
// lowercase band), baseline, bottom line (descenders). One table, read by the page view (PrintPageView: rows, ruling, letter size,
// snap) and by the notebook model (propis2 model.js: which papers have rows of their own, which take the slant / band fill / dash).
// A paper is offered only by a deck (a language or style) that lists its id in `papers`.
//
// Per paper, all in mm on the printed page:
//   upMm / xMm / downMm — the three bands: top line → x-line → baseline → bottom line. The letter's lowercase height is xMm; the deck's
//                         `script` (upper / lower, scriptGeometry.js) stretches its ascenders and descenders to the other two lines.
//   gapMm               — blank space between one row's bottom line and the next row's top line; 0 = the bottom line IS the next top line.
//   firstMm / footMm    — the space above the first row's top line / below the last row's bottom line kept free on the page.
//   lines               — how each line is drawn: "bold" | "thin" | "dash" | "none".
//   guides              — slant guides over the ruled part of the page: { stepMm, tan (horizontal run per unit of height), startMm }; none = upright.
//   midDash             — the page may switch on a dash in the middle of the x band (the page's own option, `bgDash` on the Bulgarian paper).
//   edgeToEdge          — the ruling goes on above the first and below the last row, to the edges of the sheet.
export const FOUR_LINE_PAPERS = {
  // `propis2_bg` / Bulgarian language: bold top line 6.08 mm above a thin x-line, the 4.94 mm lowercase band down to a thin baseline, 5.98 mm
  // down to the next row's bold line (rows every 17 mm, 11 on an A5 page); no dashes; sparse 76deg slant guides every 35 mm. Bands as on a
  // Bulgarian teacher's writing video (owner, 2026-10-19: 1.23 : 1 : 1.21).
  bg: {
    label: "Болгарская строка",
    upMm: 6.08, xMm: 4.94, downMm: 5.98, gapMm: 0, firstMm: 10, footMm: 5,
    lines: { top: "bold", x: "thin", base: "thin", bottom: "bold" },
    guides: { stepMm: 35, tan: 1 / 4, startMm: 10 },
    midDash: true,
    edgeToEdge: true,
  },
  // English, British (Nelson Handwriting, measured 2026-11-08, docs/research/handwriting/rulings.md): the x band larger than the other two
  // (0.74 : 1 : 0.72 in every year, Year 2 = 3.77 / 5.09 / 3.67 mm, 6 mm between rows); solid outer lines, dashed x-line and baseline.
  en_gb: {
    label: "Английская строка (британская)",
    upMm: 3.7, xMm: 5, downMm: 3.6, gapMm: 6, firstMm: 10, footMm: 5,
    lines: { top: "thin", x: "dash", base: "dash", bottom: "thin" },
    guides: null,
    midDash: false,
    edgeToEdge: false,
  },
  // English, American (Zaner-Bloser 2025 grade 2 and the KSM ZB-style sheets, measured 2026-11-08): three equal bands (grade 2: ¼ inch each);
  // solid top line, dashed midline, solid baseline; the descender band ends on the next row's top line.
  en_us: {
    label: "Английская строка (американская)",
    upMm: 5, xMm: 5, downMm: 5, gapMm: 0, firstMm: 10, footMm: 5,
    lines: { top: "thin", x: "dash", base: "bold", bottom: "thin" },
    guides: null,
    midDash: false,
    edgeToEdge: true,
  },
};

// The English papers in more sizes (Nelson's x-height by year: Starter 8 mm, Book 1 6 mm, Book 2 5 mm, Books 3–4 4 mm; Zaner-Bloser
// grade 2 is ¼ inch = 6.35 mm): the same paper scaled — every band and the gap between rows — as separate papers, the way the schemes
// themselves give each year its own ruling. The 5 mm ones keep their old ids (en_gb, en_us).
// `gapMm`: as measured where the source has it (Nelson Year 1 and 2: 6 mm between rows, Year 3: 3.8 mm), else scaled
const sized = (id, xMm, label, gapMm = null) => {
  const p = FOUR_LINE_PAPERS[id];
  const k = xMm / p.xMm;
  return { ...p, label, upMm: p.upMm * k, xMm, downMm: p.downMm * k, gapMm: gapMm ?? p.gapMm * k };
};
Object.assign(FOUR_LINE_PAPERS, {
  en_gb_8: sized("en_gb", 8, "Британская строка · 8 мм"),
  en_gb_6: sized("en_gb", 6, "Британская строка · 6 мм", 6),
  en_gb_4: sized("en_gb", 4, "Британская строка · 4 мм", 3.8),
  en_us_8: sized("en_us", 8, "Американская строка · 8 мм"),
  en_us_6: sized("en_us", 6.35, "Американская строка · 6,35 мм (¼ дюйма)"),
});
FOUR_LINE_PAPERS.en_gb.label = "Британская строка · 5 мм";
FOUR_LINE_PAPERS.en_us.label = "Американская строка · 5 мм";

export const fourLinePaper = (kind) => (Object.hasOwn(FOUR_LINE_PAPERS, kind) ? FOUR_LINE_PAPERS[kind] : null);
export const isFourLinePaper = (kind) => fourLinePaper(kind) !== null;
export const FOUR_LINE_IDS = Object.keys(FOUR_LINE_PAPERS);
// the row pitch: top line of one row to the top line of the next
export const fourLinePitchMm = (p) => p.upMm + p.xMm + p.downMm + p.gapMm;
