import { describe, expect, it } from "vitest";
import { UI_MESSAGES } from "./messages.js";
import { menuUiLanguages, translateUiMessage, UI_LANGUAGES } from "./uiLanguage.js";
import { legalLanguageFor, localeFor, pickUiText, publishedUiLanguages, UI_LANGUAGE_REGISTRY, uiFallbackChain } from "../../../shared/ui-languages.mjs";

// The rule that makes adding a language a matter of data (docs/localization/adding-a-language.md):
// a published language has every string the source language has, with the
// same placeholders and every plural form its own grammar needs.
const PLURAL = /_(zero|one|two|few|many|other)$/;
const placeholders = (text) => [...String(text).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(",");

function expectedKeys(source) {
  const plain = new Set();
  const plural = new Set();
  for (const key of Object.keys(source)) (PLURAL.test(key) ? plural.add(key.replace(PLURAL, "")) : plain.add(key));
  return { plain, plural };
}

describe("interface languages", () => {
  const source = UI_MESSAGES.ru;
  const { plain, plural } = expectedKeys(source);

  for (const { code, locale } of publishedUiLanguages()) {
    it(`${code}: every string, placeholders and plural forms`, () => {
      const dictionary = UI_MESSAGES[code] ?? {};
      const missing = [...plain].filter((key) => !(key in dictionary) && !plural.has(key));
      expect(missing, `missing in ${code}`).toEqual([]);
      const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
      const missingForms = [...plural].flatMap((base) => categories
        .filter((category) => !(`${base}_${category}` in dictionary) && !(base in dictionary))
        .map((category) => `${base}_${category}`));
      expect(missingForms, `plural forms missing in ${code}`).toEqual([]);
      const wrongPlaceholders = [...plain].filter((key) => key in dictionary && placeholders(dictionary[key]) !== placeholders(source[key]));
      expect(wrongPlaceholders, `placeholders differ in ${code}`).toEqual([]);
    });
  }

  it("lists only published languages in the menus, plus a draft already chosen", () => {
    expect(UI_LANGUAGES.map(({ code }) => code)).toEqual(publishedUiLanguages().map(({ code }) => code));
    const draft = UI_LANGUAGE_REGISTRY.find(({ status }) => status === "draft");
    if (draft) expect(menuUiLanguages(draft.code).map(({ code }) => code)).toContain(draft.code);
  });

  it("falls back to English, then Russian", () => {
    expect(uiFallbackChain("sl")).toEqual(["sl", "en", "ru"]);
    expect(uiFallbackChain("xx")).toEqual(["ru", "en"]);
    expect(pickUiText({ ru: "Глаголы", en: "Verbs" }, "sl")).toBe("Verbs");
    expect(pickUiText({ ru: "Глаголы" }, "sl")).toBe("Глаголы");
    expect(translateUiMessage("en", "common.cancel")).toBe(UI_MESSAGES.en?.["common.cancel"] ?? UI_MESSAGES.ru["common.cancel"]);
  });

  it("takes dates and plural rules from the registry", () => {
    expect(localeFor("sl")).toBe("sl-SI");
    expect(localeFor("unknown")).toBe("ru-RU");
  });

  it("never shows legal text in a language it does not exist in", () => {
    expect(legalLanguageFor("sl")).toBe("sl");
    expect(legalLanguageFor("en")).toBe("ru");
  });
});
