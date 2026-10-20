import { UI_MESSAGES } from "./messages.js";

// Synchronous boot copy; account preferences are reconciled separately.
export const UI_LANGUAGE_STORAGE_KEY = "mironium.uiLanguage";
export const UI_LANGUAGES = Object.freeze([
  Object.freeze({ code: "ru", label: "Русский" }),
  Object.freeze({ code: "sl", label: "Slovenščina" }),
]);

export function isUiLanguage(value) {
  return UI_LANGUAGES.some(({ code }) => code === value);
}

export function translateUiMessage(language, key, values = {}) {
  const dictionary = UI_MESSAGES[language] ?? UI_MESSAGES.ru;
  const pluralKey = typeof values.count === "number"
    ? `${key}_${new Intl.PluralRules(language === "sl" ? "sl-SI" : "ru-RU").select(values.count)}`
    : key;
  const message = dictionary[pluralKey] ?? dictionary[key] ?? UI_MESSAGES.ru[pluralKey] ?? UI_MESSAGES.ru[key] ?? key;
  // React renders this as text; never interpret translations as HTML.
  return message.replace(/\{\{(\w+)\}\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}

export function createUiLanguageController({ storage, root } = {}) {
  let stored = null;
  try { stored = storage?.getItem(UI_LANGUAGE_STORAGE_KEY); } catch { /* blocked storage */ }
  let explicitChoice = isUiLanguage(stored);
  let snapshot = Object.freeze({ language: explicitChoice ? stored : "ru", saved: true });
  const listeners = new Set();
  const choiceListeners = new Set();

  function applyDocumentLanguage() {
    if (root) root.lang = snapshot.language;
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
