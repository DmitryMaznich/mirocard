// Glyph label -> glyph (aliases included) for a deck record, as the wide-row engine wants it.
import { withGlyphOverrides } from "./glyphOverrides.js";

export function buildGlyphMap(topicRecord) {
  const map = new Map();
  // elements.json entries ride along by id; wide.json glyphs win (same rule as PrintPageView).
  for (const el of topicRecord?.elements ?? []) map.set(el.id, { label: el.id, kind: "element", strokes: el.strokes, stretch: 1.806, repeatCells: topicRecord?.wideElementRepeat?.[el.id] });
  const wide = withGlyphOverrides(topicRecord?.wide);
  for (const g of wide) map.set(g.label, g);
  for (const g of wide) for (const a of g.aliases ?? []) map.set(a, g);
  return map;
}

// Elements the picker offers: [{ id, label }] from elements.json plus the wide-zone element glyphs.
export function listElementChoices(topicRecord) {
  const out = (topicRecord?.elements ?? []).map((el) => ({ id: el.id, label: el.labelRu ?? el.id }));
  for (const g of topicRecord?.wide ?? []) if (g.kind === "element") out.push({ id: g.label, label: `Элемент «${g.label}»` });
  return out;
}

// The task object PrintPageView renders (same shape propis/engine.js builds for "read_lines").
// Wide-row layout only needs the wide glyph bank from the installed deck, no captured-letter cards.
export function buildPageTask({ topicRecord, lines, narrowRows = true, useElements = false, grid = "regular", midDash = true, margin = "off", format = "a5" }) {
  // Empty strings are blank writing rows and must stay (the engine draws them as empty ruled rows).
  const clean = (lines ?? []).map((l) => String(l).trim());
  while (clean.length && clean[clean.length - 1] === "") clean.pop();
  return {
    type: "print_page",
    letters: [],
    connectors: [],
    punctuation: [],
    lines: clean,
    useElements,
    elements: topicRecord?.elements ?? [],
    wideRows: true,
    exactPages: true,
    simpleGrid: ["dense", "square", "ruled"].includes(grid) ? grid : "regular",
    midDash: midDash !== false,
    format: format === "a4" ? "a4" : "a5",
    margin: margin === "left" || margin === "right" ? margin : "off",
    narrowRows,
    narrow17: Boolean(narrowRows), // the narrow ruling uses all 17 rows of the printed notebook (see PrintPageView)
    wideGlyphs: withGlyphOverrides(topicRecord?.wide),
    wideElementRepeat: topicRecord?.wideElementRepeat ?? {},
  };
}
