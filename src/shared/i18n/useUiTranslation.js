import { useSyncExternalStore } from "react";
import { getUiLanguageSnapshot, subscribeUiLanguage, setUiLanguage, translateUiMessage } from "./uiLanguage.js";

export function useUiTranslation() {
  const { language, saved } = useSyncExternalStore(subscribeUiLanguage, getUiLanguageSnapshot, getUiLanguageSnapshot);
  return { language, saved, setLanguage: setUiLanguage, t: (key, values) => translateUiMessage(language, key, values) };
}
