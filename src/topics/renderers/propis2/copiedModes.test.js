import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { cardGlyphs, CARD_LETTERS } from "./letterCards.js";
import { generateTasks } from "./engine.js";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
const rec = { ...topic, wide: wide.glyphs, elements: JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements };
const map = buildGlyphMap(rec);
const mode = (type) => topic.modes.find((m) => m.type === type);

describe("modes copied from «Прописи» (2026-10-10)", () => {
  it("capitals Ё and Й exist (Е / И with the marks of ё / й above them) and lay out", () => {
    for (const [cap, base] of [["Ё", "Е"], ["Й", "И"]]) {
      const g = map.get(cap);
      expect(g.strokes.length).toBeGreaterThan(map.get(base).strokes.length);
      expect(g.strokes.every((s) => !/NaN/.test(s.d))).toBe(true);
      const nums = g.strokes.slice(map.get(base).strokes.length).flatMap((s) => s.d.match(/-?\d*\.?\d+/g).map(Number).filter((_, i) => i % 2 === 1));
      const capTop = Math.min(...map.get(base).strokes.flatMap((s) => s.d.match(/-?\d*\.?\d+/g).map(Number).filter((_, i) => i % 2 === 1)));
      expect(Math.max(...nums)).toBeLessThan(capTop); // the marks stand above the capital
      expect(layoutWideLinesIntoRows([`${cap}#1`], map, undefined, false, 0.5).placed).toHaveLength(1);
    }
  });
  it("every letter of the cards has this topic's ink, in the card's space (baseline 88, x-height 26)", () => {
    const cards = cardGlyphs(map);
    expect(CARD_LETTERS.filter((l) => !cards[l])).toEqual([]);
    const a = cards["а"].strokes.flatMap((d) => d.match(/-?\d*\.?\d+/g).map(Number).filter((_, i) => i % 2 === 1));
    expect(Math.max(...a)).toBeGreaterThan(84);
    expect(Math.min(...a)).toBeGreaterThan(55);
    expect(cards["а"].width).toBeGreaterThan(5);
  });
  it("«Узнай букву», «Строчная и заглавная», «Диктант» give the tasks of «Прописи»", () => {
    expect(generateTasks(mode("letters_recognize"), rec, 500, {}).length).toBeGreaterThan(5);
    expect(generateTasks(mode("letters_case"), rec, 500, { variant: "sort" })[0].type).toBe("sort_case");
    const [letters] = generateTasks(mode("dictation"), rec, 500, { level: "letters", itemCount: 12 });
    expect(letters.type).toBe("dictation");
    expect(letters.items).toHaveLength(12);
    expect(letters.items.every((it) => /^(up|lo)_/.test(it.key))).toBe(true);
    const [words] = generateTasks(mode("dictation"), rec, 500, { level: "words", itemCount: 5 });
    expect(words.items.every((it) => it.key && it.display)).toBe(true);
    const [texts] = generateTasks(mode("dictation"), rec, 500, { level: "texts", itemCount: 2 });
    expect(texts.items[0].sentences.length).toBeGreaterThan(0);
    expect(generateTasks(mode("builder"), rec, 500, { lines: ["а"] })[0].type).toBe("page");
  });
});
