import { useId, useSyncExternalStore } from "react";
import { accountLanguages } from "@/core/languageSync.js";
import { UI_LANGUAGES } from "../i18n/uiLanguage.js";
import { useUiTranslation } from "../i18n/useUiTranslation.js";
import "./UiLanguagePicker.css";

export default function UiLanguagePicker() {
  const id = useId();
  const { language, saved, setLanguage, t } = useUiTranslation();
  const sync = useSyncExternalStore(accountLanguages.subscribe, accountLanguages.getSnapshot, accountLanguages.getSnapshot);
  return (
    <div className="ui-language-picker">
      <label className="ui-language-picker__label" htmlFor={id}>{t("common.language")}</label>
      <div className="ui-language-picker__control">
        <svg className="ui-language-picker__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1m14 20-5-10-5 10m2-4h6" />
        </svg>
        <select id={id} value={language} onChange={(event) => setLanguage(event.target.value)}>
          {UI_LANGUAGES.map(({ code, label }) => <option key={code} value={code} lang={code}>{label}</option>)}
        </select>
      </div>
      <p className="ui-language-picker__help">{t("common.scope")}</p>
      {!saved && <p className="ui-language-picker__warning" role="status">{t("common.notSaved")}</p>}
      {sync.accountId && sync.status === "pending" && <p className="ui-language-picker__help" role="status">{t("languages.pending")}</p>}
      {sync.accountId && !sync.durable && <p className="ui-language-picker__warning" role="status">{t("languages.notDurable")}</p>}
    </div>
  );
}
