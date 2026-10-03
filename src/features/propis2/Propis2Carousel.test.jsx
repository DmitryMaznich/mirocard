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
});
