import { UI_MESSAGES } from "./messages.js";

// Device preference only in LOC-01. Account sync is a separate LOC-02 change.
export const UI_LANGUAGE_STORAGE_KEY = "mironium.uiLanguage";
export const UI_LANGUAGES = Object.freeze([
  Object.freeze({ code: "ru", label: "Русский" }),
  Object.freeze({ code: "sl", label: "Slovenščina" }),
]);

export function isUiLanguage(value) {
  return UI_LANGUAGES.some(({ code }) => code === value);
}

export function translateUiMessage(language, key, values = {}) {
  const message = UI_MESSAGES[language]?.[key] ?? UI_MESSAGES.ru[key] ?? key;
  // React renders this as text; never interpret translations as HTML.
  return message.replace(/\{\{(\w+)\}\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}

export function createUiLanguageController({ storage, root } = {}) {
  let stored = null;
  try { stored = storage?.getItem(UI_LANGUAGE_STORAGE_KEY); } catch { /* blocked storage */ }
  let explicitChoice = isUiLanguage(stored);
  let snapshot = Object.freeze({ language: explicitChoice ? stored : "ru", saved: true });
  const listeners = new Set();

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
    setLanguage: (language) => change(language, true),
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
export const getUiLanguage = () => controller.getSnapshot().language;
export const translateUi = (key, values) => translateUiMessage(getUiLanguage(), key, values);
