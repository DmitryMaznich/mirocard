import { useId } from "react";
import { LANGUAGES } from "../../../shared/languages.mjs";
import { useUiTranslation } from "../i18n/useUiTranslation.js";
import "./UiLanguagePicker.css";

export default function LessonLanguagePicker({ value, onChange, inherit = false }) {
  const id = useId();
  const { t } = useUiTranslation();
  return (
    <div className="ui-language-picker">
      <label className="ui-language-picker__label" htmlFor={id}>{t("languages.lesson")}</label>
      <select id={id} value={value ?? ""} onChange={event => onChange(event.target.value || null)}>
        {inherit && <option value="">{t("languages.inherit")}</option>}
        {LANGUAGES.map(({ code, label }) => <option key={code} value={code} lang={code}>{label}</option>)}
      </select>
      <p className="ui-language-picker__help">{t("languages.preferenceOnly")}</p>
    </div>
  );
}
