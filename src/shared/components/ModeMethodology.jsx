import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { getTopicTitle } from "@/shared/utils/format";
import { buildModeSettings, getModeGoal } from "@/shared/utils/methodology";

function getLocalizedText(value) {
  return getTopicTitle(value);
}

function toTextList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(getLocalizedText).filter(Boolean);
  }
  const text = getLocalizedText(value);
  return text ? [text] : [];
}

export default function ModeMethodology({ mode }) {
  const { t, language } = useUiTranslation();
  const localize = (value) => getTopicTitle(value, mode?.methodology?.uiLocalized ? language : "ru");
  const description = (
    localize(mode?.methodology?.text)
    || localize(mode?.methodology?.description)
    || localize(mode?.ui?.instruction)
  );
  const settings = mode?.methodology?.uiLocalized
    ? (mode.methodology.settings ?? []).map(localize)
    : buildModeSettings(mode);
  const goal = getModeGoal(mode);
  const tips = toTextList(mode?.methodology?.tips);
  const duration = getLocalizedText(mode?.methodology?.duration);

  return (
    <div className="methodology-panel">
      {description && (
        <section className="methodology-section">
          <div className="methodology-section__label">{t("methodology.description")}</div>
          <p className="methodology-section__text">{description}</p>
        </section>
      )}

      <section className="methodology-section">
        <div className="methodology-section__label">{t("nav.settings")}</div>
        <ul className="methodology-list">
          {settings.map((setting, index) => (
            <li key={index}>{setting}</li>
          ))}
        </ul>
      </section>

      {goal && (
        <section className="methodology-section methodology-section--goal">
          <div className="methodology-section__label">{t("methodology.goal")}</div>
          <p className="methodology-section__text">{goal}</p>
        </section>
      )}

      {tips.length > 0 && (
        <section className="methodology-section">
          <div className="methodology-section__label">{t("methodology.how")}</div>
          <ul className="methodology-list">
            {tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      {duration && (
        <div className="methodology-duration">{t("info.duration", { duration })}</div>
      )}
    </div>
  );
}
