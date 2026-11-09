import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { buildGlyphMap } from "./pageTask.js";
import { deckPapers } from "./model.js";
import { languageView } from "./languages.js";
import { topicAlphabet, cardLetters } from "./alphabet.js";
import { layoutWideLinesIntoRows } from "../../../handwriting/wordEngine.js";
import { snapXFor } from "../../../handwriting/PrintPageView.jsx";
import { samplePath } from "../../../handwriting/pathGeometry.js";

// The Mazina steps (m1 / m2) for the Kazakh alphabet (owner, 2026-11-05): offered by the Kazakh view, and no Kazakh letter reaches
// further above or below the baseline than the Russian ones do (the free strip between the bands is sized for those)
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
const entry = catalog.decks.find((d) => d.id === "propis2");
const db = await openDb(`test-mzkk-${Date.now()}`);
await importTopic(db, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
const rec = await getTopicRecord(db, "propis2");
const BASELINE = 64; // row-local y of the baseline (NATIVE_L3 - TEXT_ROW_THIN_OFFSET)
const reach = (lang, kind) => {
  const view = languageView(rec, lang);
  const map = buildGlyphMap(view);
  const snap = snapXFor({ narrowRows: true, simpleGrid: kind, margin: "off", format: "a5", narrow17: true });
  const out = new Map();
  for (const ch of cardLetters(topicAlphabet(view, map))) {
    const seg = layoutWideLinesIntoRows([`${ch}#1`], map, snap, false, 0.5).placed[0].segments[0];
    let up = 0, down = 0;
    for (const s of seg.strokes) for (const [, y] of samplePath(s.d, 30)) { up = Math.max(up, (BASELINE - y) / 6); down = Math.max(down, (y - BASELINE) / 6); }
    out.set(ch, { up, down });
  }
  return out;
};

describe("Mazina steps for the Kazakh alphabet", () => {
  it("the Kazakh view offers both steps", () => {
    expect(deckPapers(languageView(rec, "kk")).map((g) => g.id)).toEqual(["propis", "m1", "m2", "square", "ruled"]);
  });
  for (const kind of ["m1", "m2"]) {
    it(`${kind}: every Kazakh letter (Ә Ғ Қ Ң Ө Ұ Ү Һ І and the rest) stays inside what the Russian ones reach`, () => {
      const ru = [...reach("ru", kind).values()];
      const maxUp = Math.max(...ru.map((r) => r.up));
      const maxDown = Math.max(...ru.map((r) => r.down));
      const kk = reach("kk", kind);
      for (const ch of "ӘәҒғҚқҢңӨөҰұҮүҺһІі") {
        expect(kk.has(ch), ch).toBe(true);
        expect(kk.get(ch).up, ch).toBeLessThanOrEqual(maxUp + 0.1);
        expect(kk.get(ch).down, ch).toBeLessThanOrEqual(maxDown + 0.1);
      }
    });
  }
});
