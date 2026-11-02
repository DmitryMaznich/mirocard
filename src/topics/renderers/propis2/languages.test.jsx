import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "./pageTask.js";
import { topicAlphabet } from "./alphabet.js";
import { analyzePage, deckPapers, kitToLibraryItems, rowsPerPage } from "./model.js";
import { generateTasks } from "./engine.js";
import { deckLanguages, languageView, pickLanguage, offeredLanguages, fixLegacyNotebookLangs, mostUsedLang, LEGACY_LANG_CUTOFF } from "./languages.js";
import { applyVariant } from "../../../../scripts/lib/propis2-variant.mjs";

// «Прописи» (`propis2`) with its writing languages (since v0.6.0, scripts/build-propis2-deck.mjs, docs/propis2-languages.md), installed
// from its built ZIP through the real importer, against the decks it stands for: its Russian must be `propis2` v0.5.11 (the last one
// without languages, kept in test-fixtures/decks) exactly — pages, letter cards, dictation; its Bulgarian `propis2_bg`; its Kazakh the
// Kazakh variant.
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
async function install(id, file) {
  const entry = catalog.decks.find((d) => d.id === id);
  const db = await openDb(`test-p2lang-${id}-${Date.now()}-${Math.random()}`);
  await importTopic(db, await readFile(file ?? `public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
  return getTopicRecord(db, id);
}
const [multi, ru, bg] = await Promise.all([install("propis2"), install("propis2", "test-fixtures/decks/propis2_v0.5.11.zip"), install("propis2_bg")]);
const page = (rec, lines, grid) => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines, grid })} bare />);

describe("propis2 Kazakh word notebooks (variant.json kits, 2026-11-02)", () => {
  it("two notebooks of words, a page per letter, every word a model and its fading copies; every symbol drawn, every row fits", () => {
    const kk = languageView(multi, "kk");
    expect(kk.kits.map((k) => [k.id, k.pages.length])).toEqual([["kk-words-1", 18], ["kk-words-2", 18]]);
    expect(kk.kits[0].pages[0].title).toBe("А а");
    expect(kk.kits[1].pages.at(-1).title).toBe("Я я");
    const glyphMap = buildGlyphMap(kk);
    for (const kit of kk.kits) {
      const { pages } = kitToLibraryItems(kit);
      for (const p of pages) {
        expect(p.rows.length).toBeLessThanOrEqual(rowsPerPage(p));
        expect(p.rows.every((r) => r.repeat === "fade" && r.dots === "all" && r.kind === "text")).toBe(true);
        expect([p.title, analyzePage(p, glyphMap).problems]).toEqual([p.title, 0]);
      }
    }
    // the other languages keep theirs: Russian the bundled ones, Bulgarian its «Цифры»
    expect(languageView(multi, "bg").kits.map((k) => k.id)).toEqual(["digits"]);
  });
});

describe("propis2 writing languages", () => {
  it("a deck without languages is left as it is", () => {
    expect(deckLanguages(ru)).toBeNull();
    expect(languageView(ru, "bg")).toBe(ru);
    expect(pickLanguage(ru, "bg")).toBeNull();
  });

  it("«Прописи» carry Russian, Bulgarian and Kazakh, for everyone, the dictation kept; the test copy is archived", () => {
    expect(catalog.decks.find((d) => d.id === "propis2").status).toBe("release");
    expect(catalog.decks.find((d) => d.id === "propis2_lang").status).toBe("archived");
    expect(deckLanguages(multi).map((l) => [l.id, l.status])).toEqual([["ru", "ready"], ["bg", "ready"], ["kk", "ready"]]);
    expect(multi.modes.map((m) => m.type)).toEqual(ru.modes.map((m) => m.type));
    expect(multi.modes.map((m) => m.type)).toContain("dictation");
    expect(offeredLanguages(multi).map((l) => l.id)).toEqual(["ru", "bg", "kk"]);
    expect(offeredLanguages(multi, true).map((l) => l.id)).toEqual(["ru", "bg", "kk"]);
    expect(pickLanguage(multi, undefined)).toBe("ru");
    expect(pickLanguage(multi, "xx")).toBe("ru");
  });

  it("its Russian is `propis2` v0.5.11 exactly: pages on every paper, alphabet, dictation banks", () => {
    const lines = ["мама мыла раму", "у Шуры шары", "Ёжик и Юля", "", "щука, ёлка, съел"];
    for (const grid of ["regular", "dense", "square", "ruled"]) expect(page(languageView(multi, "ru"), lines, grid)).toBe(page(ru, lines, grid));
    expect(topicAlphabet(languageView(multi, "ru")).lower.join("")).toBe(topicAlphabet(ru).lower.join(""));
    expect(multi.words).toEqual(ru.words);
    expect(multi.texts).toEqual(ru.texts);
    const dict = (rec) => rec.modes.find((m) => m.type === "dictation");
    expect(dict(multi).params).toEqual(dict(ru).params); // the dictation's settings: no language (Russian only)
    const lettersDict = (rec) => JSON.stringify(generateTasks(dict(rec), rec, 10, { level: "letters", itemCount: 999 })[0].items.map((i) => i.display).sort());
    expect(lettersDict(multi)).toBe(lettersDict(ru));
  });

  it("its Bulgarian is `propis2_bg`: alphabet, slant, papers and the same page", () => {
    const view = languageView(multi, "bg");
    const map = buildGlyphMap(view);
    expect(topicAlphabet(view, map).lower.join("")).toBe(topicAlphabet(bg, buildGlyphMap(bg)).lower.join(""));
    expect(view.meta.script).toEqual(bg.meta.script);
    expect(deckPapers(view).map((p) => p.id)).toEqual(deckPapers(bg).map((p) => p.id));
    const lines = ["мама мие", "щъркел цвете лъжица", "Ана Боян Ъгъл"];
    for (const grid of ["bg", "square", "ruled"]) expect(page(view, lines, grid)).toBe(page(bg, lines, grid));
    expect(view.kits?.map((k) => k.id)).toEqual(bg.kits?.map((k) => k.id));
  });

  it("its Kazakh is the Kazakh variant (tools/propis2/variants/kk/variant.json) exactly: 42 letters, its writing, the same pages", async () => {
    // the variant deck as build-propis2-deck.mjs --variant kk makes it, over the installed `propis2` (the same base)
    const v = JSON.parse(await readFile("tools/propis2/variants/kk/variant.json", "utf-8"));
    const kk = structuredClone({ ...ru, meta: { ...ru.meta }, modes: ru.modes });
    applyVariant(kk, v);
    const view = languageView(multi, "kk");
    const lower = topicAlphabet(view, buildGlyphMap(view)).lower.join("");
    expect(lower).toBe("аәбвгғдеёжзийкқлмнңоөпрстуұүфхһцчшщъыіьэюя");
    expect(topicAlphabet(view, buildGlyphMap(view)).noCapital).toEqual(new Set(["ь"])); // Ы has its capital (Ыстық)
    expect(view.meta.script).toEqual(v.meta.script);
    expect(view.meta.methodology).toBe(false);
    const lines = ["қала үй әке өнер", "Ғалым Ұлт Үй Һәм Ізет", "Ыстық шырын, ъ, ь", "ғ ө ұ ү қ ң ә һ і"];
    for (const grid of ["regular", "dense", "square", "ruled"]) expect(page(view, lines, grid)).toBe(page(kk, lines, grid));
  });

  it("the letter cards take the language from the mode's own settings, Russian by default", () => {
    for (const m of multi.modes.filter((x) => ["letters_recognize", "letters_case"].includes(x.type))) {
      expect(m.params.writingLang).toMatchObject({ type: "enum", values: ["ru", "bg", "kk"], default: "ru" });
      expect(m.params.writingLang.labels.ru.kk).toBe("Қазақша");
    }
    // Kazakh words start with Ы (Ыстық): its capital is expected, it shows up once it is drawn
    expect(deckLanguages(multi).find((l) => l.id === "kk").alphabet.noCapital).toEqual(["ь"]);
  });

  it("the letter cards are made in the chosen language and say which", () => {
    const mode = multi.modes.find((m) => m.type === "letters_recognize");
    const tasks = generateTasks(mode, multi, 10, { writingLang: "bg" });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.writingLang === "bg")).toBe(true);
    const shown = JSON.stringify(tasks);
    expect(shown).not.toMatch(/"ы"|"э"|"ё"/);
    const ruTasks = generateTasks(ru.modes.find((m) => m.type === "letters_recognize"), ru, 10, {});
    expect(ruTasks.some((t) => "writingLang" in t)).toBe(false);
  });

  it("old notebooks on the Bulgarian paper become Bulgarian; the owner's Russian ones wrongly tagged by v1.0.2758 are Russian again", () => {
    const before = LEGACY_LANG_CUTOFF - 60_000, after = LEGACY_LANG_CUTOFF + 60_000;
    const lib = {
      pages: [{ id: "p1", gridKind: "bg", rows: [] }, { id: "p2", gridKind: "square", rows: [] }, { id: "p3", rows: [] }, { id: "p4", rows: [] }, { id: "p5", rows: [] }],
      sets: [
        { id: "old-bg", pageIds: ["p1", "p2"], createdAt: before, updatedAt: 1 }, // made in propis2_bg: a page on the Bulgarian paper
        { id: "old-ru", pageIds: ["p3"], createdAt: before, updatedAt: 1 }, // a Russian notebook, never tagged: stays as it is
        { id: "wrong", lang: "bg", pageIds: ["p4"], createdAt: before, updatedAt: 2 }, // the owner's Russian notebook v1.0.2758 tagged Bulgarian
        { id: "new-bg", lang: "bg", pageIds: ["p5"], createdAt: after, updatedAt: 3 }, // made Bulgarian on purpose after the fix: kept
        { id: "kk", lang: "kk", pageIds: ["p3"], createdAt: before, updatedAt: 4 },
      ],
    };
    const out = fixLegacyNotebookLangs(lib, multi, 9);
    expect(out.sets.map((st) => [st.id, st.lang, st.updatedAt])).toEqual([["old-bg", "bg", 9], ["old-ru", undefined, 1], ["wrong", "ru", 9], ["new-bg", "bg", 3], ["kk", "kk", 4]]);
    expect(fixLegacyNotebookLangs(out, multi, 10)).toBe(out); // nothing left to fix: nothing to save or sync
    expect(fixLegacyNotebookLangs(lib, ru, 9)).toBe(lib); // a deck without languages
    expect(mostUsedLang(out)).toBe("bg");
    expect(mostUsedLang({ sets: [{ id: "a" }, { id: "b" }, { id: "c", lang: "bg" }] })).toBe("ru");
  });
});
