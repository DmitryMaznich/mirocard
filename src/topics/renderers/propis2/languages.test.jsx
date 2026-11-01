import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "./pageTask.js";
import { topicAlphabet } from "./alphabet.js";
import { deckPapers } from "./model.js";
import { generateTasks } from "./engine.js";
import { deckLanguages, languageView, pickLanguage, offeredLanguages } from "./languages.js";
import { applyVariant } from "../../../../scripts/lib/propis2-variant.mjs";

// The deck with several writing languages (scripts/build-propis2-deck.mjs --languages, docs/propis2-languages.md), installed from its
// built ZIP through the real importer, against the decks it stands for: its Russian must be `propis2` exactly, its Bulgarian `propis2_bg`.
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
async function install(id) {
  const entry = catalog.decks.find((d) => d.id === id);
  const db = await openDb(`test-p2lang-${id}-${Date.now()}`);
  await importTopic(db, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
  return getTopicRecord(db, id);
}
const [multi, ru, bg] = await Promise.all([install("propis2_lang"), install("propis2"), install("propis2_bg")]);
const page = (rec, lines, grid) => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines, grid })} bare />);

describe("propis2 writing languages", () => {
  it("a deck without languages is left as it is", () => {
    expect(deckLanguages(ru)).toBeNull();
    expect(languageView(ru, "bg")).toBe(ru);
    expect(pickLanguage(ru, "bg")).toBeNull();
  });

  it("the test deck carries Russian, Bulgarian and Kazakh, for one account, without the dictation", () => {
    expect(catalog.decks.find((d) => d.id === "propis2_lang").status).toBe("individual");
    expect(deckLanguages(multi).map((l) => [l.id, l.status])).toEqual([["ru", "ready"], ["bg", "ready"], ["kk", "ready"]]);
    expect(multi.modes.map((m) => m.type)).toEqual(["builder", "letters_recognize", "letters_case"]);
    expect(offeredLanguages(multi).map((l) => l.id)).toEqual(["ru", "bg", "kk"]);
    expect(offeredLanguages(multi, true).map((l) => l.id)).toEqual(["ru", "bg", "kk"]);
    expect(pickLanguage(multi, undefined)).toBe("ru");
    expect(pickLanguage(multi, "xx")).toBe("ru");
  });

  it("its Russian draws a page exactly as `propis2` does, on every paper", () => {
    const lines = ["мама мыла раму", "у Шуры шары", "Ёжик и Юля", "", "щука, ёлка, съел"];
    for (const grid of ["regular", "dense", "square", "ruled"]) expect(page(languageView(multi, "ru"), lines, grid)).toBe(page(ru, lines, grid));
    expect(topicAlphabet(languageView(multi, "ru")).lower.join("")).toBe(topicAlphabet(ru).lower.join(""));
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
    for (const m of multi.modes.filter((x) => x.type !== "builder")) {
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
});
