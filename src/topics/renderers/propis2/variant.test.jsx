import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { buildGlyphMap } from "./pageTask.js";
import { cardGlyphs } from "./letterCards.js";
import { cardLetters, topicAlphabet } from "./alphabet.js";
import { generateTasks } from "./engine.js";
import { buildTiles } from "@/features/propis2/Propis2Carousel.jsx";
import { backContent } from "@/features/propis2/cover/backContent.js";
import { renderToStaticMarkup } from "react-dom/server";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildPageTask } from "./pageTask.js";
import { deckPapers, newPage, rowsPerPage } from "./model.js";

// The Bulgarian variant deck (docs/propis2-variants.md), installed from its built ZIP through the real importer: the same renderer,
// its own alphabet (30 letters, no Ё Ы Э), its own modes, words on the cover in Bulgarian.
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
const entry = catalog.decks.find((d) => d.id === "propis2_bg");

async function installed() {
  const db = await openDb("test-p2bg-" + Date.now());
  await importTopic(db, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
  return getTopicRecord(db, "propis2_bg");
}

describe("propis2 variant: Bulgarian", () => {
  it("is in the catalog for one account at a time and installs with the propis2 renderer", async () => {
    expect(entry.status).toBe("individual");
    const rec = await installed();
    expect(rec.meta.renderer).toBe("propis2");
    expect(rec.meta.variantOf).toBe("propis2");
    expect(rec.modes.map((m) => m.type)).toEqual(["builder", "letters_recognize", "letters_case"]);
    expect(rec.wide.length).toBeGreaterThan(50);
    expect(rec.meta.alphabet.lower).toHaveLength(30);
  });

  it("the card modes ask only the Bulgarian letters, each drawn, Ъ lowercase only until its capital is captured", async () => {
    const rec = await installed();
    const map = buildGlyphMap(rec);
    const letters = cardLetters(topicAlphabet(rec, map));
    expect(letters.join("")).not.toMatch(/[ёЁыЫэЭ]/);
    expect(letters).toContain("ъ");
    expect(letters).not.toContain("Ъ");
    expect(letters).not.toContain("Ь");
    const cards = cardGlyphs(map, letters);
    expect(letters.filter((l) => !cards[l])).toEqual([]);
    const shown = (tasks) => tasks.flatMap((t) => [t.letter, t.stimulus?.printed, ...(t.options ?? []).map((o) => o.letter)]).filter(Boolean).join("");
    const recognize = generateTasks(rec.modes.find((m) => m.type === "letters_recognize"), rec, 10, { direction: "mix" });
    const sort = generateTasks(rec.modes.find((m) => m.type === "letters_case"), rec, 10, {});
    expect(shown(recognize)).not.toMatch(/[ёЁыЫэЭ]/);
    expect(shown(sort)).not.toMatch(/[ёЁыЫэЭ]/);
    expect(sort).toHaveLength(letters.length);
  });

  it("the constructor offers the Bulgarian letter tiles", async () => {
    const t = buildTiles(await installed());
    expect(t.lower.map((x) => x.text).join("")).toBe("абвгдежзийклмнопрстуфхцчшщъьюя");
    expect(t.upper.map((x) => x.text).join("")).not.toMatch(/[ЁЫЭ]/);
  });

  it("the back of the cover writes the Bulgarian alphabet and words, every letter of them in the deck", async () => {
    const rec = await installed();
    const map = buildGlyphMap(rec);
    const alphabet = backContent("alphabet", topicAlphabet(rec, map), rec.meta.coverWords);
    expect(alphabet.heading).toBe("Азбука");
    const text = alphabet.lines.join(" ");
    expect(text).toContain("Ю ю");
    expect(text).not.toMatch(/[ЁёЫыЭэ]/);
    for (const kind of ["alphabet", "digits", "signs", "digits-signs", "punctuation"]) {
      const c = backContent(kind, topicAlphabet(rec, map), rec.meta.coverWords);
      const letters = [...c.heading, ...c.lines.join("").replace(/#[a-z0-9]+|№.|_\d/g, "")].filter((ch) => /\p{L}/u.test(ch));
      expect(letters.filter((ch) => !map.get(ch)), kind).toEqual([]);
    }
    expect(backContent("signs", topicAlphabet(rec, map), rec.meta.coverWords).lines.join(" ")).toContain("равно");
  });

  it("writes on the Bulgarian ruling: its own paper first, no Russian slant paper; 11 rows of four lines on A5, guides at 76deg", async () => {
    const rec = await installed();
    expect(deckPapers(rec).map((g) => g.id)).toEqual(["bg", "square", "ruled"]);
    expect(deckPapers({ meta: {} }).map((g) => g.id)).toEqual(["propis", "square", "ruled"]);
    expect(rowsPerPage(newPage("т", { gridKind: "bg" }))).toBe(11);
    const html = renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines: ["Ана", "на мене е"], grid: "bg" })} bare />);
    expect(html).toContain('data-simple-grid="bg"');
    expect((html.match(/data-bg-row=/g) ?? []).length).toBe(11);
    const guide = /<g data-simple-grid="bg"><line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/.exec(html);
    const [x1, y1, x2, y2] = guide.slice(1).map(Number);
    expect((Math.atan2(y1 - y2, x2 - x1) * 180) / Math.PI).toBeCloseTo(76, 0);
  });
});
