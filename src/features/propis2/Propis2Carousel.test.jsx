import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildTiles } from "./Propis2Carousel.jsx";

function record() {
  const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
  const elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
  return { wide: wide.glyphs, elements, wideElementRepeat: wide.elementRepeat };
}

describe("carousel tiles", () => {
  it("every lowercase letter has a tile drawn with strokes, г and п included (stored as г1/п1 with aliases)", () => {
    const t = buildTiles(record());
    expect(t.lower.map((x) => x.text).join("")).toBe("абвгдеёжзийклмнопрстуфхцчшщъыьэюя");
    for (const tile of [...t.lower, ...t.upper, ...t.elements]) expect(tile.strokes.length, tile.text).toBeGreaterThan(0);
  });

  it("capitals: those the deck has (Ё Й Ъ Ы Ь are not traced yet)", () => {
    const t = buildTiles(record());
    expect(t.upper.map((x) => x.text).join("")).toBe("АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ");
  });

  it("punctuation tab: . , ! ? from the v1 captures, drawn with strokes", () => {
    const t = buildTiles(record());
    expect(t.marks.map((x) => x.text).join("")).toBe(".,!?");
    for (const m of t.marks) expect(m.strokes.length).toBeGreaterThan(0);
  });

  it("marks: ! and ? are as tall as a capital, . , sit on the baseline", () => {
    const t = buildTiles(record());
    const by = (c) => t.marks.find((m) => m.text === c).box;
    const cap = t.upper.find((x) => x.text === "Т").box;
    for (const c of ["!", "?"]) expect(by(c).minY).toBeLessThanOrEqual(cap.minY + 2);
    for (const c of [".", ","]) expect(by(c).minY).toBeGreaterThan(cap.minY + 30);
  });

  it("which tiles stay inside the row (the wide ruling offers only these)", () => {
    const t = buildTiles(record());
    const inRow = (list) => list.filter((x) => x.inRow).map((x) => x.text).join("");
    expect(inRow(t.lower)).toBe("агеёжийклмнопстхчшъыьэюя");
    expect(inRow(t.upper)).toBe("");
    expect(inRow(t.marks)).toBe(".,");
  });
});
