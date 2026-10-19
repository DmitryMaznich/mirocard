import { getInterfaceTopicTitle } from "@/shared/i18n/topicTitles.js";
import { useUiTranslation } from "@/shared/i18n/useUiTranslation.js";
import { CATEGORY_STYLE, getTopicCategory, OTHER_CATEGORY } from "./topicCategories";
import { CategoryGlyph } from "./CategoryIcons";

// Compact "quick resume" banner for the active topic — keeps the one-tap
// path back into a session that a big hero card used to provide, without
// costing a whole screen zone now that the catalog and library are one list.
export default function ContinueStrip({ record, onContinue }) {
  const { t } = useUiTranslation();
  if (!record) return null;
  const style = CATEGORY_STYLE[getTopicCategory(record.meta.id)] ?? CATEGORY_STYLE[OTHER_CATEGORY];

  return (
    <button className="continue-strip" onClick={onContinue}>
      <span className={`continue-strip__cover ${style.cls}`}>
        <CategoryGlyph name={style.icon} size={26} />
      </span>
      <span className="continue-strip__text">
        <span className="continue-strip__eyebrow">{t("topics.activeNow")}</span>
        <span className="continue-strip__title">{getInterfaceTopicTitle(record.meta.id, record.meta.title)}</span>
      </span>
      <span className="continue-strip__cta">{t("topics.continue")}</span>
    </button>
  );
}
