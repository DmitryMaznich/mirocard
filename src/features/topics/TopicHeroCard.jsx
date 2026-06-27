import TopicCover from "@/shared/components/TopicCover";
import { getTopicTitle } from "@/shared/utils/format";

function SelectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2"/>
      <path d="M7 10h6M10.5 7L13 10l-2.5 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function TopicHeroCard({ record, onInfo, onSelect }) {
  const isBuiltin = Boolean(record.meta.builtin);
  const meta = isBuiltin ? "встроенная" : `v${record.meta.version}`;

  return (
    <div className="topic-hero-card">
      <div className="topic-hero-card__top">
        <TopicCover
          topicId={record.meta.id}
          avatarPath={record.meta.avatar}
          title={record.meta.title}
          size="medium"
        />
        <div className="topic-hero-card__body">
          <div className="topic-hero-card__title-row">
            <div className="topic-hero-card__title">{getTopicTitle(record.meta.title)}</div>
            <button
              className="icon-btn icon-btn--info"
              onClick={() => onInfo(record)}
              aria-label="О теме"
            >
              i
            </button>
          </div>
          <div className="topic-hero-card__meta">{meta}</div>
          <span className="topic-hero-card__badge">✓ Активна</span>
        </div>
      </div>
      <button
        className="topic-hero-card__select-btn"
        onClick={onSelect}
        aria-label="Выбрать тему"
      >
        <SelectIcon />
        <span>Выбрать</span>
      </button>
    </div>
  );
}
