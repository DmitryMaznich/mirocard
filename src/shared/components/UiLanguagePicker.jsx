import { useId } from "react";
import { UI_LANGUAGES } from "../i18n/uiLanguage.js";
import { useUiTranslation } from "../i18n/useUiTranslation.js";
import "./UiLanguagePicker.css";

export default function UiLanguagePicker() {
  const id = useId();
  const { language, saved, setLanguage, t } = useUiTranslation();
  return (
    <div className="ui-language-picker">
      <label className="ui-language-picker__label" htmlFor={id}>{t("common.language")}</label>
      <select id={id} value={language} onChange={(event) => setLanguage(event.target.value)}>
        {UI_LANGUAGES.map(({ code, label }) => <option key={code} value={code} lang={code}>{label}</option>)}
      </select>
      <p className="ui-language-picker__help">{t("common.scope")}</p>
      {!saved && <p className="ui-language-picker__warning" role="status">{t("common.notSaved")}</p>}
    </div>
  );
}
