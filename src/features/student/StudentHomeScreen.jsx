import { useAppStore } from "@/core/store";
import { getTopicTitle } from "@/shared/utils/format";
import "./StudentHomeScreen.css";

const RENDERER_EMOJI = {
  shopping:       "🛒",
  comparison:     "⚖️",
  streak_tracker: "⭐",
  reading:        "📖",
  phrase_match:   "🔤",
};

export default function StudentHomeScreen({ student, activeTask, onStartSession }) {
  const topicRecords = useAppStore((s) => s.topicRecords);

  let topicName = null;
  let modeName  = null;
  let topicIcon = "📚";

  if (activeTask) {
    const topicRecord = topicRecords.find((r) => r.meta.id === activeTask.topicId);
    const mode        = topicRecord?.modes?.find((m) => m.id === activeTask.modeId);

    topicName = topicRecord
      ? (getTopicTitle(topicRecord.meta.title) || topicRecord.meta.id)
      : activeTask.topicId;

    modeName = mode
      ? (getTopicTitle(mode.ui?.title) || mode.id)
      : activeTask.modeId ?? null;

    topicIcon = RENDERER_EMOJI[topicRecord?.meta?.renderer] ?? "📚";
  }

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
            <span className="shs-task-icon">{topicIcon}</span>
            <div className="shs-task-name">{topicName}</div>
            {modeName && <div className="shs-task-mode">{modeName}</div>}
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
      </div>
    </div>
  );
}
