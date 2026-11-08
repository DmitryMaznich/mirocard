import printGlyphs from "./glyphs/print.json";

// Writing styles of «Латиница» (docs/latin-letters.md). A style = its glyphs + its ruling + the
// languages its glyphs cover. The engine, the constructor and the PDF are the same for every style;
// a new style is new data here, never a fork of the code.
//
// Glyph units: one band of the ruling = 50 units (`BAND_UNITS`). The ruling's `levels` are the
// heights of its lines in those units, measured down from the top line; `lines` says which of them
// are drawn and how. `slant` (degrees) is for the slanted styles still to come — 0 = upright.

export const BAND_UNITS = 50;

export const STYLES = {
  print: {
    id: "print",
    title: "Печатные",
    hint: "простые прямые печатные буквы — с них начинают везде",
    languages: ["en"],
    glyphs: printGlyphs.glyphs,
    ruling: {
      levels: { top: 0, x: 50, base: 100, bottom: 150 },
      lines: [
        { at: "top" },
        { at: "x", dashed: true },
        { at: "base", bold: true },
        { at: "bottom" },
      ],
      slant: 0,
    },
  },
};

export const DEFAULT_STYLE = "print";

export function styleOf(id) {
  return STYLES[id] ?? STYLES[DEFAULT_STYLE];
}

// The styles that cover a language — the constructor offers only these for a notebook.
export function stylesFor(langId) {
  return Object.values(STYLES).filter((s) => s.languages.includes(langId));
}

// Total height of a writing row in glyph units (top line → descender line).
export function rowUnits(style) {
  const lv = style.ruling.levels;
  return lv.bottom - lv.top;
}
