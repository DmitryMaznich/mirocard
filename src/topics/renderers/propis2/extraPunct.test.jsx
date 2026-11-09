import { describe, it, expect } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { buildGlyphMap } from "./pageTask.js";
import { topicAlphabet } from "./alphabet.js";
import { findUnsupported } from "./model.js";
import { digitsOut } from "./fieldText.js";
import { deckLanguages, langStyles, languageView } from "./languages.js";
import { bboxOf, narrowStrokes } from "./glyphReach.js";

// : ; – (2026-11-09, glyphOverrides.js extraPunctGlyphs): made for every writing language and style of the deck from its own . and ,
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
async function install(id) {
  const entry = catalog.decks.find((d) => d.id === id);
  const db = await openDb(`test-p2punct-${id}-${Date.now()}-${Math.random()}`);
  await importTopic(db, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
  return getTopicRecord(db, id);
}
const decks = await Promise.all(["propis2", "propis2_lang"].map(install));
const hands = decks.flatMap((rec) => (deckLanguages(rec) ?? []).flatMap((l) => (langStyles(l) ?? [null]).map((st) => ({ name: `${rec.meta.id}/${l.id}${st ? `/${st.id}` : ""}`, view: languageView(rec, l.id, st?.id) }))));

describe("colon, semicolon and dash in every alphabet", () => {
  it("there are several hands to check", () => {
    expect(hands.map((h) => h.name)).toEqual(expect.arrayContaining(["propis2/ru", "propis2/bg", "propis2/kk"]));
  });

  it.each(hands.map((h) => [h.name, h]))("%s: : ; – — are written, : ; stand on the baseline with the upper dot inside the lowercase height, – on the middle", (_n, { view }) => {
    const map = buildGlyphMap(view);
    const { lower } = topicAlphabet(view, map);
    const [a, b, c, d] = lower;
    expect(findUnsupported(`${a}: ${b}; ${c} – ${d} — ${a}`, map)).toEqual([]);
    const box = (l) => bboxOf(narrowStrokes(map, l));
    const dot = box("."), colon = box(":"), semi = box(";"), dash = box("–"), x = box(a);
    for (const m of [colon, semi]) {
      expect(m.maxY).toBeGreaterThanOrEqual(dot.maxY - 0.5);
      expect(m.minY).toBeLessThan(dot.minY - 8);
      expect(m.minY).toBeGreaterThan(x.minY - 2);
    }
    expect(dash.maxY - dash.minY).toBeLessThan(1);
    expect(dash.minY).toBeGreaterThan(x.minY + 2);
    expect(dash.minY).toBeLessThan(dot.minY - 4);
    expect(map.get("—")).toBe(map.get("–"));
  });
});

describe("a lone dash in the field", () => {
  it("between words it is the dash, next to a number the minus", () => {
    expect(digitsOut("мама - папа")).toBe("мама – папа");
    expect(digitsOut("мама – папа — дом")).toBe("мама – папа — дом");
    expect(digitsOut("- Привет!")).toBe("– Привет!");
    expect(digitsOut("5 - 3 = 2")).toBe("№5 №- №3 №= №2");
    expect(digitsOut("5 – 3")).toBe("№5 №- №3");
    expect(digitsOut("кое-что 5-3")).toBe("кое-что №5№-№3");
  });
});
