import { CATEGORY_STYLE, getTopicCategory, OTHER_CATEGORY } from "./topicCategories";
import TopicCover from "@/shared/components/TopicCover";
import { getTopicTitle } from "@/shared/utils/format";

// Compact "quick resume" banner for the active topic — keeps the one-tap
// path back into a session that a big hero card used to provide, without
// costing a whole screen zone now that the catalog and library are one list.
export default function ContinueStrip({ record, onContinue }) {
  if (!record) return null;
  const style = CATEGORY_STYLE[getTopicCategory(record.meta.id)] ?? CATEGORY_STYLE[OTHER_CATEGORY];

  return (
    <button className="continue-strip" onClick={onContinue}>
      <span className={`continue-strip__cover ${style.cls}`}>
        <TopicCover topicId={record.meta.id} avatarPath={record.meta.avatar} title={record.meta.title} size="small" />
      </span>
      <span className="continue-strip__text">
        <span className="continue-strip__eyebrow">Сейчас активна</span>
        <span className="continue-strip__title">{getTopicTitle(record.meta.title)}</span>
      </span>
      <span className="continue-strip__cta">Продолжить</span>
    </button>
  );
}
