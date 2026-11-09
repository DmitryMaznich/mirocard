import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { kitToLibraryItems, newPage, rowsPerPage } from "./model.js";

// The ready notebooks of «Прописи: латиница» (tools/propis2/latin-kits.json, scripts/lib/propis2-latin-kits.mjs, docs/latin-letters.md):
// the Nelson joins, a page per pair, 16 pages a notebook, words from the CIS second-year English textbooks.
const tc = JSON.parse(await readFile("tools/propis2/latin.json", "utf-8"));
const db = await openDb(`test-latin-kits-${Date.now()}`);
await importTopic(db, await readFile(`public/decks/propis2_lang_v${tc.version}.zip`), "999.0.0");
const deck = await getTopicRecord(db, "propis2_lang");
const kits = deck.languages.find((l) => l.id === "en").kits;
const rules = deck.languages.find((l) => l.id === "en").styles.find((s) => s.id === "british_joined").script.joinRules;

describe("Latin ready notebooks: the Nelson joins", () => {
  it("four notebooks, one per join, 16 pages each, in the joined style on the British paper", () => {
    expect(kits.map((k) => k.id)).toEqual(["en-join-1", "en-join-2", "en-join-3", "en-join-4"]);
    for (const k of kits) {
      expect(k.pages, k.id).toHaveLength(16);
      expect(k.style).toBe("british_joined");
      expect(k.page.gridKind).toBe("en_gb");
      for (const p of k.pages) expect(p.rows, `${k.id} ${p.title}`).toHaveLength(rowsPerPage(newPage("x", k.page)));
      expect(k.pages.at(-1).title).toBe("Повторение");
    }
  });

  it("every pair is the notebook's own join, and every word of its page has it", () => {
    const groupTo = (b) => (rules.oval.includes(b) || "egijmnpruvwxy".includes(b) ? 2 : 3); // Nelson: starts at the top of the x-height / of the ascender
    const want = { "en-join-1": ["diagonalFrom", 2], "en-join-2": ["diagonalFrom", 3], "en-join-3": ["levelFrom", 2], "en-join-4": ["levelFrom", 3] };
    for (const k of kits) {
      const [from, to] = want[k.id];
      for (const p of k.pages.slice(0, -1)) {
        const [a, b] = [p.title[0], p.title[1]]; // («oth»: the join o–t, in mother, brother)
        expect(rules[from].includes(a) && groupTo(b) === to, `${k.id} ${p.title}`).toBe(true);
        const words = p.rows.slice(4).map((r) => r.text);
        for (const w of words) expect(w.includes(p.title), `${p.title}: ${w}`).toBe(true);
      }
    }
  });

  it("a copy of a ready notebook keeps the kit's pages", () => {
    const { set, pages } = kitToLibraryItems(kits[0]);
    expect(set.pageIds).toHaveLength(16);
    expect(pages[0].gridKind).toBe("en_gb");
  });
});
