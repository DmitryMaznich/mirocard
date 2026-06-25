import TopicCover from "@/shared/components/TopicCover";
import { getTopicTitle } from "@/shared/utils/format";

export default function TopicHeroCard({ record, onInfo }) {
  const isBuiltin = Boolean(record.meta.builtin);
  const meta = isBuiltin
    ? "встроенная"
    : `v${record.meta.version} · ${record.meta.conceptCount ?? record.cards.length} понятий`;

  return (
    <div className="topic-hero-card">
      <TopicCover
        topicId={record.meta.id}
        avatarPath={record.meta.avatar}
        title={record.meta.title}
        size="large"
      />
      <div className="topic-hero-card__body">
        <div className="topic-hero-card__title">{getTopicTitle(record.meta.title)}</div>
        <div className="topic-hero-card__meta">{meta}</div>
        <span className="topic-hero-card__badge">✓ Активна</span>
      </div>
      <button
        className="icon-btn icon-btn--info topic-hero-card__info-btn"
        onClick={() => onInfo(record)}
        aria-label="О теме"
      >
        i
      </button>
    </div>
  );
}
