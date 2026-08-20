import TopicCover from "@/shared/components/TopicCover";

// Wide "for you" card used in the Мои темы carousel — reuses the app's own
// active-theme treatment (the mint/teal hero gradient) rather than a new
// accent color, so a personal deck reads as "special" the same way an
// already-selected theme does elsewhere in the app.
export default function TopicSpotlightCard({ title, topicId, avatarPath, caption, isActive, onSelect, onMenu }) {
  return (
    <article className="topic-spotlight" onClick={onSelect}>
      <div className="topic-spotlight__top">
        <span className="topic-spotlight__ribbon">Для вас</span>
        {onMenu && (
          <button
            className="topic-spotlight__menu"
            onClick={(e) => { e.stopPropagation(); onMenu(); }}
            aria-label="Действия"
          >
            ⋯
          </button>
        )}
      </div>
      <div className="topic-spotlight__cover">
        <TopicCover topicId={topicId} avatarPath={avatarPath} title={title} size="medium" />
      </div>
      <div className="topic-spotlight__title">{title}</div>
      {caption && <div className="topic-spotlight__caption">{caption}</div>}
      <button
        className="topic-spotlight__cta"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {isActive ? "Активна" : "Открыть"}
      </button>
    </article>
  );
}
