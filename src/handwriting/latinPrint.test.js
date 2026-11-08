import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { buildGlyphMap } from "@/topics/renderers/propis2/pageTask.js";
import { layoutWideLinesIntoRows } from "./wordEngine.js";
import { snapXFor } from "./PrintPageView.jsx";

// The English print letters (tools/handwriting/latin/print.json, docs/latin-letters.md step 3.4) in the engine, as the page lays them
// out: upright, apart, and not bent towards the next copy of the word.
const glyphs = JSON.parse(readFileSync("tools/handwriting/latin/print.json", "utf-8")).glyphs;
const style = JSON.parse(readFileSync("tools/propis2/languages.json", "utf-8")).languages.find((l) => l.id === "en").styles.find((s) => s.id === "print");
const map = buildGlyphMap({ wide: glyphs, meta: { script: style.script } });
const snap = snapXFor({ narrowRows: true, simpleGrid: "en_us", format: "a5" });
const layout = (text) => layoutWideLinesIntoRows([text], map, snap, true, 0.625).placed[0].segments.flatMap((sg) => sg.strokes);
const lastPoints = (d) => d.match(/-?\d*\.?\d+/g).map(Number).slice(-4);

describe("English print letters in the propis2 engine", () => {
  it("has all 52 letters", () => {
    const labels = new Set(glyphs.map((g) => g.label));
    for (const ch of "abcdefghijklmnopqrstuvwxyz") {
      expect(labels.has(ch)).toBe(true);
      expect(labels.has(ch.toUpperCase())).toBe(true);
    }
  });

  it("the style writes apart, upright, on the American four-line paper", () => {
    expect(style.script.joins).toBe(false);
    expect(style.script.slantDeg).toBeUndefined();
    expect(style.papers[0]).toBe("en_us");
  });

  it("the legs of n h m end straight down on the baseline, in every copy of the row", () => {
    for (const ch of ["n", "h", "m"]) {
      const strokes = layout(`${ch}${ch.toUpperCase()}`); // a row of copies: «nN nN nN …»
      const legs = strokes.filter((s) => s.d.includes("C") && lastPoints(s.d)[3] === 64);
      expect(legs.length).toBeGreaterThan(2);
      for (const s of legs) {
        const [x0, , x1] = lastPoints(s.d);
        expect(Math.abs(x1 - x0), `${ch}: ${s.d}`).toBeLessThan(0.01);
      }
    }
  });

  it("the draft English is in the test copy only, never in the deck everyone gets", async () => {
    const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
    const deck = async (id) => {
      const e = catalog.decks.find((d) => d.id === id);
      const zip = await JSZip.loadAsync(readFileSync(`public/decks/${e.url.replace("./decks/", "")}`));
      return { entry: e, topic: JSON.parse(await zip.file("topic.json").async("string")) };
    };
    const prod = await deck("propis2");
    expect(prod.entry.status).toBe("release");
    expect(prod.topic.languages.map((l) => l.id)).not.toContain("en");
    const test = await deck("propis2_lang");
    expect(test.entry.status).toBe("individual");
    const en = test.topic.languages.find((l) => l.id === "en");
    expect(en.status).toBe("draft");
    // 52 letters + 0–9 and + − = < > (as «№…») + the hyphen + . , ? ! — all upright, none borrowed from the Russian cursive
    for (const id of ["print", "british"]) {
      const g = en.styles.find((s) => s.id === id).glyphs;
      expect(g).toHaveLength(72);
      for (const label of ["№0", "№9", "№+", "№=", "-", ".", "?", "!"]) expect(g.find((x) => x.label === label)?.upright, `${id} ${label}`).toBe(true);
    }
  });
  it("British letters: the Nelson proportions — ascenders 0.74, descenders 0.72 of the x-height, capitals as tall as the ascenders", () => {
    const gb = JSON.parse(readFileSync("tools/handwriting/latin/british.json", "utf-8")).glyphs;
    const ys = (ch) => gb.find((g) => g.label === ch).strokes.flatMap((st) => st.d.match(/-?\d*\.?\d+/g).map(Number).filter((_, i) => i % 2 === 1));
    const top = (ch) => Math.min(...ys(ch)), bottom = (ch) => Math.max(...ys(ch));
    const X = 52, BASE = 62; // the capture frame: x-height, baseline
    expect((BASE - X - top("l")) / X).toBeCloseTo(0.74, 2); // the ascender above the x-line
    expect((bottom("p") - BASE) / X).toBeCloseTo(0.72, 2);  // the descender below the baseline
    expect(top("H")).toBeCloseTo(top("l"), 1);              // a capital as tall as an ascender
    // the exit flick: l ends to the right of its stem, rising
    const l = gb.find((g) => g.label === "l").strokes[0].d.match(/-?\d*\.?\d+/g).map(Number);
    expect(l[l.length - 2]).toBeGreaterThan(l[0] + 10);
    expect(l[l.length - 1]).toBeLessThan(BASE);
  });
  it("the style's own digits win over the bank's cursive ones; Russian keeps the cursive", () => {
    expect(map.get("№5").sourceLabel).toBe("print-5");
    expect(map.get("№+").upright).toBe(true);
    const ru = buildGlyphMap({ wide: JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8")).glyphs, meta: {} });
    expect(ru.get("№5").upright).toBeUndefined();
    expect(ru.get("№5").sourceLabel).toMatch(/захват/);
  });
});
