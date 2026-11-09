import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import PrintPageView from "@/handwriting/PrintPageView";
import { buildPageTask } from "./pageTask.js";
import { generateTasks } from "./engine.js";
import { languageView, langStyles, pickStyle, styleOf } from "./languages.js";

// Writing styles of a language (docs/latin-letters.md, step 3.1). A language without `styles` must give the very view it gave before
// (the Russian, Bulgarian and Kazakh of the real deck); a language with styles lays the style's letters, script and papers over its own.
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
const entry = catalog.decks.find((d) => d.id === "propis2");
const db = await openDb(`test-p2style-${Date.now()}`);
await importTopic(db, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
const deck = await getTopicRecord(db, "propis2");
const page = (rec, lines, grid) => renderToStaticMarkup(<PrintPageView task={buildPageTask({ topicRecord: rec, lines, grid })} bare />);

// the deck with one more language: the Russian alphabet in two styles, the second with its own «а», upright and on squared paper
const ru = deck.languages.find((l) => l.id === "ru");
const ownA = { ...deck.wide.find((g) => g.label === "а"), sourceLabel: "test-style-а" };
const twoStyles = {
  ...deck,
  languages: [...deck.languages, {
    ...ru, id: "xx", title: "Test", status: "draft",
    styles: [
      { id: "plain", title: "Как русский" },
      { id: "upright", title: "Прямой", script: { slantDeg: 90 }, papers: ["square"], glyphs: [ownA] },
    ],
  }],
};

describe("propis2 writing styles", () => {
  it("a language without styles gives the view it always gave", () => {
    for (const l of deck.languages) {
      expect(langStyles(l)).toBeNull();
      expect(pickStyle(deck, l.id, "anything")).toBeNull();
      const view = languageView(deck, l.id, "anything");
      expect(view).toBe(languageView(deck, l.id)); // the same cached view, whatever style is asked for
      expect(view.meta.writingStyle).toBeUndefined();
    }
    expect(page(languageView(deck, "ru", "x"), ["мама мыла раму"], "propis")).toBe(page(languageView(deck, "ru"), ["мама мыла раму"], "propis"));
  });

  it("picks the wanted style, else the language's first", () => {
    expect(pickStyle(twoStyles, "xx", "upright")).toBe("upright");
    expect(pickStyle(twoStyles, "xx", "nope")).toBe("plain");
    expect(pickStyle(twoStyles, "xx", null)).toBe("plain");
    expect(styleOf({ lang: "xx", style: "upright" })).toBe("upright");
    expect(styleOf({ lang: "xx" })).toBeNull();
  });

  it("a style without fields of its own is the language itself", () => {
    const plain = languageView(twoStyles, "xx", "plain");
    const lang = languageView(deck, "ru");
    expect(plain.meta.writingStyle).toBe("plain");
    expect(plain.meta.script).toEqual(lang.meta.script);
    expect(plain.meta.papers).toEqual(lang.meta.papers);
    expect(plain.wide).toEqual(lang.wide);
  });

  it("a style lays its letters, script and papers over the language's", () => {
    const up = languageView(twoStyles, "xx", "upright");
    expect(up.meta.writingStyle).toBe("upright");
    expect(up.meta.script).toEqual({ slantDeg: 90 });
    expect(up.meta.papers).toEqual(["square"]);
    expect(up.wide.find((g) => g.label === "а").sourceLabel).toBe("test-style-а");
    expect(up.wide.length).toBe(languageView(deck, "ru").wide.length);
    // and the two styles are two views, each cached
    expect(up).toBe(languageView(twoStyles, "xx", "upright"));
    expect(up).not.toBe(languageView(twoStyles, "xx", "plain"));
  });

  it("the letter cards are made in the asked style and say which", () => {
    const mode = deck.modes.find((m) => m.type === "letters_case");
    const [task] = generateTasks(mode, twoStyles, 10, { writingLang: "xx", writingStyle: "upright" });
    expect(task.writingLang).toBe("xx");
    expect(task.writingStyle).toBe("upright");
    const [ruTask] = generateTasks(mode, twoStyles, 10, { writingLang: "ru" });
    expect(ruTask.writingStyle).toBeUndefined();
  });
});
