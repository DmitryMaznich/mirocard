// The task object PrintPageView renders (same shape propis/engine.js builds for "read_lines").
// Wide-row layout only needs the wide glyph bank from the installed deck, no captured-letter cards.
export function buildPageTask({ topicRecord, lines, narrowRows = true, useElements = false }) {
  const clean = (lines ?? []).map((l) => String(l).trim()).filter(Boolean);
  return {
    type: "print_page",
    letters: [],
    connectors: [],
    punctuation: [],
    lines: clean,
    useElements,
    elements: topicRecord?.elements ?? [],
    wideRows: true,
    narrowRows,
    wideGlyphs: topicRecord?.wide ?? [],
    wideElementRepeat: topicRecord?.wideElementRepeat ?? {},
  };
}
