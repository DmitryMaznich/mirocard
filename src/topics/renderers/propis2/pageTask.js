import { PROPIS2_ELEMENTS, PROPIS2_ELEMENT_REPEAT, PROPIS2_WIDE_GLYPHS } from "./data.js";

// The task object PrintPageView renders (same shape propis/engine.js builds for "read_lines").
// Wide-row layout only needs the wide glyph bank, no captured-letter cards.
export function buildPageTask({ lines, narrowRows = true, useElements = false }) {
  const clean = (lines ?? []).map((l) => String(l).trim()).filter(Boolean);
  return {
    type: "print_page",
    letters: [],
    connectors: [],
    punctuation: [],
    lines: clean,
    useElements,
    elements: PROPIS2_ELEMENTS,
    wideRows: true,
    narrowRows,
    wideGlyphs: PROPIS2_WIDE_GLYPHS,
    wideElementRepeat: PROPIS2_ELEMENT_REPEAT,
  };
}
