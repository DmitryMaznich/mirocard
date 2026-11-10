// Glyph label -> glyph (aliases included) for a deck record, as the wide-row engine wants it.
import { FOUR_LINE_IDS, isFourLinePaper } from "../../../handwriting/fourLinePapers.js";
import { withGlyphOverrides } from "./glyphOverrides.js";
import { styleViews } from "./languages.js";

export function buildGlyphMap(topicRecord) {
  const map = new Map();
  // elements.json entries ride along by id; wide.json glyphs win (same rule as PrintPageView).
  for (const el of topicRecord?.elements ?? []) map.set(el.id, { label: el.id, kind: "element", strokes: el.strokes, stretch: 1.806, repeatCells: topicRecord?.wideElementRepeat?.[el.id] });
  const wide = withGlyphOverrides(topicRecord?.wide);
  for (const g of wide) map.set(g.label, g);
  for (const g of wide) for (const a of g.aliases ?? []) map.set(a, g);
  // the deck's own writing geometry (a variant's meta.script: slant, heights; wordEngine lays every row out with it)
  if (topicRecord?.meta?.script) map.script = topicRecord.meta.script;
  attachStyles(map, topicRecord);
  return map;
}

// A language with several writing styles: a row may write in another style than its page (`row.style`). The map of the page's style then
// knows the maps of all the styles of its language (`map.styles`, Map(id -> map), built when first asked) and its own (`map.styleId`).
function attachStyles(map, topicRecord) {
  const siblings = styleViews(topicRecord);
  if (!siblings) return;
  map.styleId = topicRecord.meta.writingStyle;
  let styles = null;
  Object.defineProperty(map, "styles", { get() { return (styles ??= new Map([...siblings].map(([id, v]) => [id, v === topicRecord ? map : glyphMapOf(v)]))); } });
}


// buildGlyphMap once per record: a notebook whose pages write in different styles (languageView gives one record per style, cached)
// asks for the map of each style again and again
const GLYPH_MAPS = new WeakMap();
export function glyphMapOf(topicRecord) {
  if (!topicRecord) return buildGlyphMap(topicRecord);
  if (!GLYPH_MAPS.has(topicRecord)) GLYPH_MAPS.set(topicRecord, buildGlyphMap(topicRecord));
  return GLYPH_MAPS.get(topicRecord);
}

// Elements the picker offers: [{ id, label }] from elements.json plus the wide-zone element glyphs.
export function listElementChoices(topicRecord) {
  const out = (topicRecord?.elements ?? []).map((el) => ({ id: el.id, label: el.labelRu ?? el.id }));
  for (const g of topicRecord?.wide ?? []) if (g.kind === "element") out.push({ id: g.label, label: `Элемент «${g.label}»` });
  return out;
}

// The task object PrintPageView renders (same shape propis/engine.js builds for "read_lines").
// Wide-row layout only needs the wide glyph bank from the installed deck, no captured-letter cards.
// `minPages`: how many pages the task has at least (a notebook's pages, blank ones included: trailing blank rows are dropped below).
const OWN_ROW_GRIDS = new Set(["square", "ruled", ...FOUR_LINE_IDS, "m1", "m2"]);

export function buildPageTask({ topicRecord, lines, narrowRows = true, useElements = false, grid = "regular", midDash = true, margin = "off", format = "a5", minPages = 0, firstPage = 0, noSlant = false, bandFill = null }) {
  // Empty strings are blank writing rows and must stay (the engine draws them as empty ruled rows).
  const clean = (lines ?? []).map((l) => String(l).trim());
  if (OWN_ROW_GRIDS.has(grid)) narrowRows = true; // squared / ruled / Bulgarian paper: its own rows (PrintPageView), letters and digits at the narrow size
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
    minPages,
    // the page of the whole notebook this run starts on: a page's paper is drawn by its place in the notebook (the side of the margin, the
    // slant grid shifted on the right half of a sheet), so the letters snap by it too (layoutTaskPages)
    firstPage,
    simpleGrid: ["dense", "square", "ruled", ...FOUR_LINE_IDS, "m1", "m2", "none"].includes(grid) ? grid : "regular",
    // the paper without slant lines (owner, 2026-10-25): «none» on the copybook paper is its own simpleGrid; on the Bulgarian paper its
    // slants are left out (`noSlant`), the rest of that ruling stays
    noSlant: grid === "none" || Boolean(noSlant),
    midDash: midDash !== false,
    // «Подсветка» of the narrow rows: the tint's colour (model.js pageBandFill), or null
    bandFill: typeof bandFill === "string" && (isFourLinePaper(grid) || grid === "m1" || grid === "m2" || (narrowRows && !OWN_ROW_GRIDS.has(grid))) ? bandFill : null,
    format: format === "a4" ? "a4" : "a5",
    margin: margin === "left" || margin === "right" ? margin : "off",
    narrowRows,
    narrow17: Boolean(narrowRows), // the narrow ruling uses all 17 rows of the printed notebook (see PrintPageView)
    wideGlyphs: withGlyphOverrides(topicRecord?.wide),
    script: topicRecord?.meta?.script ?? null,
    wideElementRepeat: topicRecord?.wideElementRepeat ?? {},
    // rows in another style of the language (`#y<style>` on their line): the letters and geometry of every style
    ...styleGlyphsOf(topicRecord),
  };
}

const STYLE_GLYPHS = new WeakMap();
function styleGlyphsOf(topicRecord) {
  const siblings = styleViews(topicRecord);
  if (!siblings) return {};
  if (!STYLE_GLYPHS.has(topicRecord)) {
    STYLE_GLYPHS.set(topicRecord, { writingStyle: topicRecord.meta.writingStyle, styleGlyphs: Object.fromEntries([...siblings].map(([id, v]) => [id, { wideGlyphs: withGlyphOverrides(v.wide), script: v.meta?.script ?? null }])) });
  }
  return STYLE_GLYPHS.get(topicRecord);
}
