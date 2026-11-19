// The one list of interface languages (app and server). Adding a language:
// add a row here as "draft", add its dictionaries (src/shared/i18n/*Messages.js),
// then switch it to "published" once uiLanguages.test.js finds every key —
// see docs/localization/adding-a-language.md. Nothing else in the code should
// name a language: no `language === "sl"` branches.
//
//   status  published — offered in the language menu, its dictionaries must be
//                       complete; draft — accepted (account, server, tests) but
//                       not offered, missing strings fall back.
//   locale  for dates, numbers and plural forms (Intl).
//   dir     "ltr" / "rtl" — written to <html dir>.
//   legal   the terms and privacy policy exist in this language
//           (backend/legal/<code>/, the root folder is Russian). Legal text
//           never falls back to another language's wording on its own.
export const UI_LANGUAGE_REGISTRY = Object.freeze([
  Object.freeze({ code: "ru", nativeName: "Русский", locale: "ru-RU", dir: "ltr", status: "published", legal: true }),
  Object.freeze({ code: "sl", nativeName: "Slovenščina", locale: "sl-SI", dir: "ltr", status: "published", legal: true }),
  Object.freeze({ code: "en", nativeName: "English", locale: "en-GB", dir: "ltr", status: "draft", legal: false }),
]);

// A string missing in the chosen language: English first (owner, 2026-11-19),
// then Russian, the language every string is written in first.
export const UI_FALLBACK_LANGUAGES = Object.freeze(["en", "ru"]);
export const SOURCE_UI_LANGUAGE = "ru";

const byCode = new Map(UI_LANGUAGE_REGISTRY.map((entry) => [entry.code, entry]));

export const isKnownUiLanguage = (code) => byCode.has(code);
export const uiLanguageEntry = (code) => byCode.get(code) ?? byCode.get(SOURCE_UI_LANGUAGE);
export const publishedUiLanguages = () => UI_LANGUAGE_REGISTRY.filter((entry) => entry.status === "published");
export const legalUiLanguages = () => UI_LANGUAGE_REGISTRY.filter((entry) => entry.legal);
export const localeFor = (code) => uiLanguageEntry(code).locale;

// [chosen, en, ru] without repeats — the order to look a string up in.
export function uiFallbackChain(code) {
  return [...new Set([isKnownUiLanguage(code) ? code : SOURCE_UI_LANGUAGE, ...UI_FALLBACK_LANGUAGES])];
}

// The language legal text is shown in: the chosen one if the documents exist
// in it, else the first of the fallback chain that has them.
export function legalLanguageFor(code) {
  return uiFallbackChain(code).find((candidate) => uiLanguageEntry(candidate).legal && isKnownUiLanguage(candidate)) ?? SOURCE_UI_LANGUAGE;
}

// A localized value ({ ru, sl, en, … } or a plain string) in the chosen
// interface language, with the same fallback. Interface text only — lesson
// material keeps its own language and never goes through this.
export function pickUiText(value, code) {
  if (value == null) return "";
  if (typeof value !== "object" || Array.isArray(value)) return value;
  for (const candidate of uiFallbackChain(code)) {
    if (value[candidate] != null && value[candidate] !== "") return value[candidate];
  }
  const first = Object.values(value).find((item) => item != null && item !== "");
  return first ?? "";
}
