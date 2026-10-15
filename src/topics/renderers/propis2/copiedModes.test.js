import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { buildGlyphMap } from "./pageTask.js";
import { cardGlyphs, CARD_LETTERS } from "./letterCards.js";
import { generateTasks } from "./engine.js";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
const rec = { ...topic, wide: wide.glyphs, elements: JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements };
const map = buildGlyphMap(rec);
const mode = (type) => topic.modes.find((m) => m.type === type);

describe("modes copied from `propis` («Прописи старые») (2026-10-10)", () => {
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
  it("«Узнай букву», «Строчная и заглавная», «Диктант» give the tasks of `propis`", () => {
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

describe("«Диктовать знаки препинания» (2026-10-15)", () => {
  const dict = (params) => generateTasks(mode("dictation"), rec, 500, params)[0];
  it("is off by default: no signs, the old audio path", () => {
    const t = dict({ level: "words", itemCount: 5 });
    expect(t.signsVoiced).toBe(false);
    expect(t.items.every((it) => !it.punct && !it.audio)).toBe(true);
  });
  it("letters and words: a comma after each, a period after the last, the sign's clip follows the item's", () => {
    for (const level of ["letters", "words"]) {
      const t = dict({ level, itemCount: 6, punctuation: true });
      expect(t.items.map((it) => it.punct)).toEqual([",", ",", ",", ",", ",", "."]);
      t.items.forEach((it, i) => expect(it.audio.map((a) => a.key)).toEqual([it.key, i < 5 ? "punct_comma" : "punct_period"]));
    }
  });
  it("texts: signs as in the text — chunks up to a comma, the sign between, the closing sign after each sentence", () => {
    const comma = topic.texts.find((t) => t.id === "t25");
    const t = dict({ level: "texts", itemCount: 40, punctuation: true });
    const item = t.items.find((it) => it.key === "text_t25");
    expect(item.audio.map((a) => a.key).slice(0, 5)).toEqual(["text_t25_s1_c1", "punct_comma", "text_t25_s1_c2", "punct_period", "text_t25_s2_c1"]);
    expect(item.audio.map((a) => a.key)).toContain("punct_question");
    expect(item.audio.map((a) => a.key)).toContain("punct_excl");
    expect(comma.text).toContain("?");
    const plain = t.items.find((it) => it.key === "text_t01");
    expect(plain.audio.map((a) => a.key)).toEqual(["text_t01_s1", "punct_period", "text_t01_s2", "punct_period", "text_t01_s3", "punct_period", "text_t01_s4", "punct_period", "text_t01_s5", "punct_period"]);
  });
  it("every clip it can ask for exists, and every sign and letter of the texts has ink", () => {
    for (const level of ["letters", "words", "texts"]) {
      const t = dict({ level, itemCount: 40, punctuation: true });
      for (const it of t.items) for (const a of it.audio) expect(existsSync(`public/audio/propis-dictation/${a.key}.mp3`), a.key).toBe(true);
    }
    for (const x of topic.texts) for (const ch of x.text.replace(/\s/g, "")) expect(map.has(ch) || map.has(ch.toLowerCase()), `${x.id} ${ch}`).toBe(true);
  });
});
