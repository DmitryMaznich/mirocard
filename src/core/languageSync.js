import { createApiClient } from "./api.js";
import { createAccountLanguages } from "../shared/i18n/accountLanguages.js";
import { applyAccountUiLanguage, subscribeUiLanguageChoice } from "../shared/i18n/uiLanguage.js";

let storage;
try { storage = globalThis.localStorage; } catch { /* unavailable storage is shown in the picker */ }
export const accountLanguages = createAccountLanguages({
  storage, applyLanguage: applyAccountUiLanguage,
  request: (token, body) => createApiClient({ token }).patch("/account/languages", body),
});
subscribeUiLanguageChoice(accountLanguages.chooseUiLanguage);
if (typeof window !== "undefined") {
  window.addEventListener("online", () => { void accountLanguages.flush(); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void accountLanguages.flush();
  });
}
