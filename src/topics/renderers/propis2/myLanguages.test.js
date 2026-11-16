import { describe, it, expect } from "vitest";
import { resolveMyLanguages, offeredLanguages, sampleLetters, scriptOf, newerRemotePrefs, withMyLanguages, DRAFT_FLAG } from "./myLanguages.js";

// «Мои языки» (docs/mockups/propis2-languages-journey.html): the logic without the screen
const deck = {
  meta: { myLanguages: true },
  languages: [
    { id: "ru", title: "Русский", status: "ready" },
    { id: "kk", title: "Қазақша", status: "ready", alphabet: { lower: "аәбвгғ" } },
    { id: "en", title: "English", status: "ready", alphabet: { lower: "abcdefghijklmnopqrstuvwxyz" } },
    { id: "sl", title: "Slovenščina", status: "draft", alphabet: { lower: "abcčdš" } },
    { id: "hr", title: "Hrvatski", status: "draft", publishDraft: true, alphabet: { lower: "abcčćd" } },
  ],
  modes: [
    { id: "cards", type: "letters_recognize", params: { writingLang: { type: "enum", values: ["ru", "kk", "en", "sl"], default: "ru" } } },
    { id: "dict", type: "dictation", requiresLanguages: ["ru"] },
  ],
};

describe("«Мои языки»", () => {
  it("a draft language is offered only to an account with the flag, unless published on purpose (publishDraft)", () => {
    expect(offeredLanguages(deck).map((l) => l.id)).toEqual(["ru", "kk", "en", "hr"]); // a draft published on purpose: to everyone
    expect(offeredLanguages(deck, [DRAFT_FLAG]).map((l) => l.id)).toEqual(["ru", "kk", "en", "sl", "hr"]);
  });
  it("first list: the interface language and the languages of the notebooks made; a saved list wins, in the deck's order", () => {
    expect(resolveMyLanguages(deck, null, { uiLanguage: "ru" })).toEqual(["ru"]);
    expect(resolveMyLanguages(deck, null, { uiLanguage: "ru", notebookLangs: ["en"] })).toEqual(["ru", "en"]);
    expect(resolveMyLanguages(deck, null, { uiLanguage: "sl" })).toEqual(["ru"]); // Slovenian is a draft: not offered, the deck's first
    expect(resolveMyLanguages(deck, null, { uiLanguage: "sl", flags: [DRAFT_FLAG] })).toEqual(["sl"]);
    expect(resolveMyLanguages(deck, ["en", "kk"], { uiLanguage: "ru" })).toEqual(["kk", "en"]);
    expect(resolveMyLanguages(deck, ["sl"], { uiLanguage: "ru" })).toEqual(["ru"]); // nothing offered left: the first list again
  });
  it("script groups and letter samples: a language's own letters when it has some", () => {
    expect(deck.languages.map(scriptOf)).toEqual(["cyrillic", "cyrillic", "latin", "latin", "latin"]);
    expect(sampleLetters(deck.languages[0])).toBe("Аа Бб");
    expect(sampleLetters(deck.languages[1])).toBe("Әә Ғғ");
    expect(sampleLetters(deck.languages[3])).toBe("Čč Šš");
  });
  it("the account's copy is taken only when newer", () => {
    const items = [{ key: "propis2:prefs", value: { langs: ["en"], updatedAt: 5 } }];
    expect(newerRemotePrefs(items, { langs: ["ru"], updatedAt: 9 })).toBeNull();
    expect(newerRemotePrefs(items, { langs: ["ru"], updatedAt: 1 }).langs).toEqual(["en"]);
    expect(newerRemotePrefs(items, null).langs).toEqual(["en"]);
  });
  it("the modes: the dictation only with Russian among mine; the cards' language from mine, hidden when one is left", () => {
    const en = withMyLanguages(deck, ["en"]);
    expect(en.modes.map((m) => m.id)).toEqual(["cards"]);
    expect(en.modes[0].params.writingLang).toMatchObject({ values: ["en"], default: "en", hidden: true });
    const both = withMyLanguages(en, ["ru", "en"]); // made from the deck's own modes, not from the shown copy
    expect(both.modes.map((m) => m.id)).toEqual(["cards", "dict"]);
    expect(both.modes[0].params.writingLang.values).toEqual(["ru", "en"]);
    expect(both.modes[0].params.writingLang.hidden).toBeUndefined();
    expect(withMyLanguages({ ...deck, meta: {} }, ["en"]).modes).toBe(deck.modes); // a deck without the flag is left as it is
  });
});
