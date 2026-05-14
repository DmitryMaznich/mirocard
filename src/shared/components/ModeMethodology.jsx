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
  const description = (
    getLocalizedText(mode?.methodology?.text)
    || getLocalizedText(mode?.methodology?.description)
    || getLocalizedText(mode?.ui?.instruction)
  );
  const settings = buildModeSettings(mode);
  const goal = getModeGoal(mode);
  const tips = toTextList(mode?.methodology?.tips);
  const duration = getLocalizedText(mode?.methodology?.duration);

  return (
    <div className="methodology-panel">
      {description && (
        <section className="methodology-section">
          <div className="methodology-section__label">Общее описание</div>
          <p className="methodology-section__text">{description}</p>
        </section>
      )}

      <section className="methodology-section">
        <div className="methodology-section__label">Настройки</div>
        <ul className="methodology-list">
          {settings.map((setting, index) => (
            <li key={index}>{setting}</li>
          ))}
        </ul>
      </section>

      {goal && (
        <section className="methodology-section methodology-section--goal">
          <div className="methodology-section__label">Конечная цель</div>
          <p className="methodology-section__text">{goal}</p>
        </section>
      )}

      {tips.length > 0 && (
        <section className="methodology-section">
          <div className="methodology-section__label">Как проводить</div>
          <ul className="methodology-list">
            {tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      {duration && (
        <div className="methodology-duration">Время: {duration}</div>
      )}
    </div>
  );
}
