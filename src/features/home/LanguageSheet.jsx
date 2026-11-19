import { CheckmarkIcon } from "@/shared/components/ArrowIcons";
import { menuUiLanguages } from "@/shared/i18n/uiLanguage.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";

// The interface language straight from the menu (new interface): someone who
// landed in a language they do not read finds it in two taps, labelled in
// each language's own name.
export default function LanguageSheet({ onClose }) {
  const { t, language, setLanguage, saved } = useUiTranslation();
  return (
    <div className="action-sheet-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="action-sheet" role="dialog" aria-modal="true" aria-label={t("common.language")}>
        <div className="action-sheet__title">{t("common.language")}</div>
        {menuUiLanguages(language).map(({ code, label }) => (
          <button key={code} type="button" lang={code} aria-current={code === language ? "true" : undefined}
            className={`action-sheet__item action-sheet__item--value${code === language ? " action-sheet__item--current" : ""}`}
            onClick={() => { setLanguage(code); onClose(); }}>
            <span>{label}</span>{code === language && <CheckmarkIcon size={18} />}
          </button>
        ))}
        <p className="action-sheet__note">{t("common.scope")}</p>
        {!saved && <p className="action-sheet__note" role="status">{t("common.notSaved")}</p>}
        <button type="button" className="action-sheet__item action-sheet__item--cancel" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
