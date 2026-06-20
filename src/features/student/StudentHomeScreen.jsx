import "./StudentHomeScreen.css";

// Display metadata for known topics — extend as new topics are added.
// Topics not in this map get a generic fallback.
const TOPIC_META = {
  shopping_list:  { name: "Список покупок",     emoji: "🛒", sub: "Поход в магазин" },
  opposites:      { name: "Противоположности",   emoji: "↔️",  sub: "Карточки" },
  comparison:     { name: "Сравнение",            emoji: "⚖️",  sub: "Карточки" },
  streak_tracker: { name: "5 из 5",               emoji: "⭐",  sub: "Серия ответов" },
};

function getTopicMeta(topicId) {
  return TOPIC_META[topicId] ?? { name: topicId, emoji: "📚", sub: "Задание" };
}

export default function StudentHomeScreen({ student, activeTask, assignedTopics, onStartSession }) {
  const otherTopics = assignedTopics.filter(
    (t) => !activeTask || t.topicId !== activeTask.topicId
  );
  const activeMeta = activeTask ? getTopicMeta(activeTask.topicId) : null;

  return (
    <div className="shs-root">
      <div className="shs-header">
        <div className="shs-greeting">Привет,</div>
        <div className="shs-name">{student.name} 👋</div>
      </div>

      <div className="shs-body">
        {activeTask ? (
          <div className="shs-active-card">
            <div className="shs-now-badge">
              <span className="shs-pulse" />
              Задание сейчас
            </div>
            <span className="shs-task-icon">{activeMeta.emoji}</span>
            <div className="shs-task-name">{activeMeta.name}</div>
            <button
              className="shs-start-btn"
              onClick={() => onStartSession({ topicId: activeTask.topicId, modeId: activeTask.modeId })}
            >
              Начать →
            </button>
          </div>
        ) : (
          <div className="shs-empty-card">
            <div className="shs-empty-icon">⏳</div>
            <div className="shs-empty-text">Логопед ещё не назначил задание</div>
          </div>
        )}

        {otherTopics.length > 0 && (
          <>
            <div className="shs-section-label">Ещё доступно</div>
            <div className="shs-topic-list">
              {otherTopics.map((t) => {
                const meta = getTopicMeta(t.topicId);
                return (
                  <button
                    key={t.topicId}
                    className="shs-topic-item"
                    onClick={() => onStartSession({ topicId: t.topicId, modeId: null })}
                  >
                    <div className="shs-topic-emoji">{meta.emoji}</div>
                    <div className="shs-topic-info">
                      <div className="shs-topic-name">{meta.name}</div>
                      <div className="shs-topic-sub">{meta.sub}</div>
                    </div>
                    <div className="shs-topic-arrow">›</div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
