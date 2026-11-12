import { describe, it, expect } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import PrintPageView from "@/handwriting/PrintPageView";
import { FOUR_LINE_PAPERS } from "@/handwriting/fourLinePapers";
import { layoutWideLinesIntoRows } from "@/handwriting/wordEngine";
import { buildPageTask, glyphMapOf } from "./pageTask.js";
import { languageView } from "./languages.js";
import { deckPapers } from "./model.js";

// The Slovenian language of «Прописи: латиница» (docs/propis2-sl.md, step 2), a draft: not in the published deck. Here it is laid over
// the published Latin deck the way scripts/build-propis2-deck.mjs does it (a style's letters from its `glyphsFile`).
const tc = JSON.parse(await readFile("tools/propis2/latin.json", "utf-8"));
const db = await openDb(`test-latin-sl-${Date.now()}`);
await importTopic(db, await readFile(`public/decks/propis2_lang_v${tc.version}.zip`), "999.0.0");
const published = await getTopicRecord(db, "propis2_lang");
const spec = JSON.parse(await readFile("tools/propis2/languages.json", "utf-8")).languages.find((l) => l.id === "sl");
const { deck: _deck, ...sl } = spec;
sl.styles = await Promise.all(sl.styles.map(async ({ glyphsFile, ...st }) => ({ ...st, glyphs: JSON.parse(await readFile(glyphsFile, "utf-8")).glyphs })));
const deck = { ...published, languages: [...published.languages, sl] };
const view = (style) => languageView(deck, "sl", style);
const page = (rec, lines, grid) => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines, grid })} bare />);
const inkOf = (rec, text) => layoutWideLinesIntoRows([text], glyphMapOf(rec), undefined, false).placed[0];

describe("Slovenian (draft)", () => {
  it("is a draft of the Latin deck and is not in the published one", () => {
    expect(spec.status).toBe("draft");
    expect(spec.deck).toBe("latin");
    expect(published.languages.map((l) => l.id)).not.toContain("sl");
  });

  it("25 letters, no q w x y, every one with a small and a capital form in both styles", () => {
    expect([...sl.alphabet.lower]).toHaveLength(25);
    for (const st of ["sl_caps", "sl_print"]) {
      const labels = new Set(view(st).wide.map((g) => g.label));
      for (const ch of sl.alphabet.lower) {
        expect(labels.has(ch), `${st} ${ch}`).toBe(true);
        expect(labels.has(ch.toUpperCase()), `${st} ${ch.toUpperCase()}`).toBe(true);
      }
      for (const ch of "qwxy") expect(sl.styles.find((s) => s.id === st).glyphs.some((g) => g.label === ch)).toBe(false);
    }
  });

  it("the caron is the letter's last stroke, above the x-height (small) or the top line (capital)", () => {
    const glyphs = sl.styles[1].glyphs;
    for (const ch of "čšžČŠŽ") {
      const g = glyphs.find((x) => x.label === ch);
      expect(g.strokes.at(-1).name, ch).toBe("гачек");
      const base = glyphs.find((x) => x.label === ch.normalize("NFD")[0]);
      expect(g.strokes.slice(0, -1).map((s) => s.d)).toEqual(base.strokes.map((s) => s.d));
    }
  });

  it("small print letters the pen writes without lifting are one stroke (a b d g h m n p r u); A M N as the Slovene chart", async () => {
    const glyphs = sl.styles[1].glyphs;
    const strokes = (ch) => glyphs.find((g) => g.label === ch).strokes.length;
    for (const ch of "abdghmnpru") expect(strokes(ch), ch).toBe(1);
    expect([strokes("M"), strokes("N"), strokes("A")]).toEqual([1, 1, 3]);
    // the English print keeps its own strokes
    const en = JSON.parse(await readFile("tools/handwriting/latin/print_gb.json", "utf-8")).glyphs;
    expect(en.find((g) => g.label === "n").strokes).toHaveLength(2);
  });

  it("«Velike tiskane»: whatever is typed is written in capitals", () => {
    const caps = view("sl_caps");
    expect(caps.meta.script.caps).toBe(true);
    const typed = inkOf(caps, "mačka");
    const upper = inkOf(caps, "MAČKA");
    expect(JSON.stringify(typed)).toBe(JSON.stringify(upper));
    expect(JSON.stringify(inkOf(view("sl_print"), "mačka"))).not.toBe(JSON.stringify(upper));
  });

  it("the Slovene paper: three lines, three equal bands, no bottom line; offered in five sizes", async () => {
    for (const id of ["sl", "sl_10", "sl_8", "sl_6", "sl_45"]) {
      const p = FOUR_LINE_PAPERS[id];
      expect(p.upMm, id).toBeCloseTo(p.xMm, 9);
      expect(p.downMm, id).toBeCloseTo(p.xMm, 9);
      expect(p.lines.bottom).toBe("none");
      expect(p.gapMm).toBe(0);
    }
    expect(deckPapers(view("sl_print")).map((p) => p.id)).toEqual(["sl_10", "sl_8", "sl_6", "sl", "sl_45", "square", "ruled"]);
    const html = page(view("sl_print"), ["mama", "Čaša in šivanka"], "sl_8");
    const ruling = html.match(/<g data-simple-grid="sl_8">([\s\S]*)/)[1];
    expect(ruling).toMatch(/data-bg-row="0"/);
    if (process.env.SL_SHOTS) {
      const out = process.env.SL_SHOTS;
      for (const [name, style, lines, grid] of [
        ["caps", "sl_caps", ["A", "M#r", "N", "mama ata", "Čaša žaba šola"], "sl_10"],
        ["print", "sl_print", ["a", "n#r", "abcčdefghijklmnoprsštuvzž", "Čaša in šivanka", "Žaba skače v vodo."], "sl_8"],
      ]) await writeFile(`${out}/${name}.html`, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">${page(view(style), lines, grid)}</body>`);
    }
  });
});
