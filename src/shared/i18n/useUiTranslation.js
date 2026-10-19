import { useCallback, useSyncExternalStore } from "react";
import { getUiLanguageSnapshot, subscribeUiLanguage, setUiLanguage, translateUiMessage } from "./uiLanguage.js";

export function useUiTranslation() {
  const { language, saved } = useSyncExternalStore(subscribeUiLanguage, getUiLanguageSnapshot, getUiLanguageSnapshot);
  const t = useCallback((key, values) => translateUiMessage(language, key, values), [language]);
  return { language, saved, setLanguage: setUiLanguage, t };
}
