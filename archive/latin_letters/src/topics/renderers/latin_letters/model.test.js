import { describe, expect, it } from "vitest";
import { CELL_MM, alphabetNotebook, cleanWord, copyKinds, layout, newLetterBlock, newNotebook, newWordBlock, shapeText } from "./model";
import { styleOf } from "./styles";
import { LANGUAGES } from "./languages";

const style = styleOf("print");
const onGrid = (mm) => Math.abs(mm / CELL_MM - Math.round(mm / CELL_MM)) < 1e-6;

describe("latin_letters glyphs", () => {
  it("every letter of every language has a capital and a small glyph in its styles", () => {
    for (const lang of Object.values(LANGUAGES)) {
      for (const ch of lang.alphabet) {
        expect(style.glyphs[ch], ch).toBeTruthy();
        expect(style.glyphs[ch.toLowerCase()], ch.toLowerCase()).toBeTruthy();
      }
    }
  });
  it("paths use only M, L and C", () => {
    for (const g of Object.values(style.glyphs)) for (const s of g.strokes) expect(s.d).toMatch(/^[MLC0-9.,\s-]+$/);
  });
  it("starter words are drawable", () => {
    for (const w of LANGUAGES.en.words) expect(cleanWord(w, style)).toBe(w);
  });
});

describe("latin_letters layout", () => {
  it("on «Клетка» every row, plate edge and copy starts on a grid line", () => {
    const L = layout(newNotebook({ paper: "cell", blocks: [newLetterBlock("B"), newWordBlock("cat")] }));
    for (const page of L.pages) for (const row of page.rows) {
      expect(onGrid(row.y)).toBe(true);
      expect(onGrid(row.x0)).toBe(true);
      for (const c of row.copies) expect(onGrid(c.x)).toBe(true);
    }
  });
  it("copies stay inside the sheet", () => {
    const L = layout(alphabetNotebook("en"));
    const right = L.w - 5;
    for (const page of L.pages) for (const row of page.rows) for (const c of row.copies) {
      expect(c.x + shapeText(c.text, style).width * L.k).toBeLessThanOrEqual(right + 1e-6);
    }
  });
  it("the alphabet flows onto several pages, and every page's rows fit", () => {
    const L = layout(alphabetNotebook("en"));
    expect(L.pages.length).toBeGreaterThan(3);
    for (const page of L.pages) for (const row of page.rows) expect(row.y + L.rowH).toBeLessThanOrEqual(L.h - 5 + 1e-6);
    expect(L.pages.flatMap((p) => p.rows).length).toBe(26 * 5);
  });
  it("a bigger size gives fewer copies per row", () => {
    const n = (size) => layout(newNotebook({ size, blocks: [newLetterBlock("A")] })).pages[0].rows[1].copies.length;
    expect(n(8)).toBeLessThan(n(5));
  });
});

describe("latin_letters supports", () => {
  it("the first copy is the sample, «Пустая» has none", () => {
    expect(copyKinds("trace", 4).map((c) => c.kind)).toEqual(["sample", "trace", "trace", "trace"]);
    expect(copyKinds("sample", 3).map((c) => c.kind)).toEqual(["sample", "blank", "blank"]);
    expect(copyKinds("empty", 2).map((c) => c.kind)).toEqual(["blank", "blank"]);
  });
  it("«Бледнеет» gets lighter, then leaves room for the child", () => {
    const k = copyKinds("fade", 10);
    const fades = k.filter((c) => c.kind === "fade").map((c) => c.opacity);
    for (let i = 1; i < fades.length; i++) expect(fades[i]).toBeLessThan(fades[i - 1]);
    expect(k[k.length - 1].kind).toBe("blank");
  });
});
