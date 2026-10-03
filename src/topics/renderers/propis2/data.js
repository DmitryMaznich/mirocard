// Single source of glyph data for «Прописи 2»: the same files tools/propis builds into the
// v1 deck. They are small (~100 KB), so v2 bundles them instead of depending on an installed
// deck -- one source of truth, no second 8 MB zip (see docs/propis2.md).
import wide from "../../../../tools/propis/wide.json";
import elementsFile from "../../../../tools/propis/elements.json";

export const PROPIS2_WIDE_GLYPHS = wide.glyphs;
export const PROPIS2_SHEETS = wide.sheets;
export const PROPIS2_ELEMENT_REPEAT = wide.elementRepeat ?? {};
export const PROPIS2_ELEMENTS = elementsFile.elements ?? [];

// Ready sheets (methodology pages) usable as templates, in page order.
export const PROPIS2_SHEET_TITLES = {
  part1: "Лист 1",
  part2: "Лист 2 (узкая строка)",
  page15: "Заглавные Г П Т Р Л А",
  page16: "Заглавные М Я О Ф Б Д",
  page17: "Заглавные З В Е С Э Х Ж",
  page18: "Заглавные Н Ю К",
};
