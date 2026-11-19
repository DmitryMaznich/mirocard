import { UI_MESSAGES } from "./messages.js";
import { isKnownUiLanguage, localeFor, publishedUiLanguages, SOURCE_UI_LANGUAGE, uiFallbackChain, uiLanguageEntry } from "../../../shared/ui-languages.mjs";

// Synchronous boot copy; account preferences are reconciled separately.
export const UI_LANGUAGE_STORAGE_KEY = "mironium.uiLanguage";
// The languages offered in the menus — the published ones of the registry
// (shared/ui-languages.mjs). `label` is the language's own name.
export const UI_LANGUAGES = Object.freeze(publishedUiLanguages()
  .map(({ code, nativeName }) => Object.freeze({ code, label: nativeName })));

// Any language of the registry, drafts too: a draft can be chosen by an
// account or a test device without being offered to everyone.
export function isUiLanguage(value) {
  return isKnownUiLanguage(value);
}

export { localeFor };

// What a language menu lists: the published languages, plus the current one
// when it is a draft chosen on this device (so the menu shows where it is).
export function menuUiLanguages(current) {
  if (UI_LANGUAGES.some(({ code }) => code === current) || !isKnownUiLanguage(current)) return UI_LANGUAGES;
  return [...UI_LANGUAGES, { code: current, label: uiLanguageEntry(current).nativeName }];
}

const pluralRules = new Map();
function pluralCategory(language, count) {
  const locale = localeFor(language);
  if (!pluralRules.has(locale)) pluralRules.set(locale, new Intl.PluralRules(locale));
  return pluralRules.get(locale).select(count);
}

// A key missing in the chosen language falls back along the registry's chain
// (the language → English → Russian), plural forms by each language's own rules.
export function translateUiMessage(language, key, values = {}) {
  let message = null;
  for (const candidate of uiFallbackChain(language)) {
    const dictionary = UI_MESSAGES[candidate];
    if (!dictionary) continue;
    const pluralKey = typeof values.count === "number" ? `${key}_${pluralCategory(candidate, values.count)}` : null;
    message = (pluralKey && dictionary[pluralKey]) ?? dictionary[key] ?? null;
    if (message != null) break;
  }
  message ??= key;
  // React renders this as text; never interpret translations as HTML.
  return message.replace(/\{\{(\w+)\}\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}

export function createUiLanguageController({ storage, root } = {}) {
  let stored = null;
  try { stored = storage?.getItem(UI_LANGUAGE_STORAGE_KEY); } catch { /* blocked storage */ }
  let explicitChoice = isUiLanguage(stored);
  let snapshot = Object.freeze({ language: explicitChoice ? stored : SOURCE_UI_LANGUAGE, saved: true });
  const listeners = new Set();
  const choiceListeners = new Set();

  function applyDocumentLanguage() {
    if (!root) return;
    root.lang = snapshot.language;
    root.dir = uiLanguageEntry(snapshot.language).dir;
  }
  applyDocumentLanguage();

  function change(language, explicit) {
    if (!isUiLanguage(language)) return false;
    if (explicit) explicitChoice = true;
    let saved = false;
    try {
      if (storage) {
        storage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
        saved = true;
      }
    } catch { /* Selection still works in memory; the picker explains the limit. */ }
    if (snapshot.language !== language || snapshot.saved !== saved) {
      snapshot = Object.freeze({ language, saved });
      applyDocumentLanguage();
      listeners.forEach((listener) => listener());
    }
    return true;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setLanguage: (language) => {
      if (!change(language, true)) return false;
      choiceListeners.forEach((listener) => listener(language));
      return true;
    },
    subscribeChoice: (listener) => {
      choiceListeners.add(listener);
      return () => choiceListeners.delete(listener);
    },
    applyAccountLanguage: (language) => change(language, false),
    // A manual device choice always wins over late IDB/server hydration.
    hydrate: (language) => !explicitChoice && isUiLanguage(language) ? change(language, false) : false,
  };
}

let storage;
try { storage = globalThis.localStorage; } catch { /* unavailable in private/embedded contexts */ }
const controller = createUiLanguageController({ storage, root: globalThis.document?.documentElement });
export const getUiLanguageSnapshot = controller.getSnapshot;
export const subscribeUiLanguage = controller.subscribe;
export const setUiLanguage = controller.setLanguage;
export const hydrateUiLanguage = controller.hydrate;
export const subscribeUiLanguageChoice = controller.subscribeChoice;
export const applyAccountUiLanguage = controller.applyAccountLanguage;
export const getUiLanguage = () => controller.getSnapshot().language;
export const translateUi = (key, values) => translateUiMessage(getUiLanguage(), key, values);
