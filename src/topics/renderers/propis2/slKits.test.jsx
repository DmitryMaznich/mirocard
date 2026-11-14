import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { analyzePage, newPage, rowsPerPage } from "./model.js";
import { languageView } from "./languages.js";
import { glyphMapOf } from "./pageTask.js";

// The Slovenian ready notebooks (tools/propis2/build-sl-kits.mjs → sl-kits.json, docs/propis2-sl.md step 5): «Abeceda» in the three
// school styles, «Števila», «Dnevi in meseci», «Moji podatki» — words from «Za začetek», on the Slovene paper 5 mm, A5.
const tc = JSON.parse(await readFile("tools/propis2/latin.json", "utf-8"));
const db = await openDb(`test-sl-kits-${Date.now()}`);
await importTopic(db, await readFile(`public/decks/propis2_lang_v${tc.version}.zip`), "999.0.0");
const deck = await getTopicRecord(db, "propis2_lang");
const kits = deck.languages.find((l) => l.id === "sl").kits;

describe("Slovenian ready notebooks", () => {
  it("six notebooks; Abeceda in the three styles, a page per letter of the 25", () => {
    expect(kits.map((k) => k.id)).toEqual(["sl-abc-caps", "sl-abc-print", "sl-abc-cursive", "sl-stevila", "sl-dnevi", "sl-podatki"]);
    expect(kits.slice(0, 3).map((k) => k.style)).toEqual(["sl_caps", "sl_print", "sl_cursive"]);
    const letters = [..."abcčdefghijklmnoprsštuvzž"];
    for (const k of kits.slice(0, 3)) expect(k.pages.map((p) => p.title)).toEqual(letters.map((l) => `${l.toUpperCase()} ${l}`));
  });

  it("every page fills the Slovene A5 page, every row fits its line and is written in letters the style has", () => {
    for (const k of kits) {
      expect(k.page).toEqual({ gridKind: "sl", format: "a5" });
      const map = glyphMapOf(languageView(deck, "sl", k.style));
      for (const p of k.pages) {
        const page = { ...newPage(p.title, k.page), rows: p.rows };
        expect(p.rows, `${k.id} ${p.title}`).toHaveLength(rowsPerPage(page));
        analyzePage(page, map).rows.forEach((r, i) => {
          const where = `${k.id} «${p.title}» row ${i + 1}: ${p.rows[i].text ?? ""}`;
          expect(r.unsupported, where).toEqual([]);
          expect(r.overflow, where).toBe(false);
        });
      }
    }
  });
});
