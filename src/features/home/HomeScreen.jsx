import { useAppStore } from "@/core/store";
import Button from "@/shared/components/Button";
import ProgressBar from "@/shared/components/ProgressBar";
import { deriveConcepts } from "@/shared/utils/topicUtils";
import { computeConceptLevel } from "@/features/session/useConceptProgress";
import { formatDate } from "@/shared/utils/format";

function getLastSession(sessions, studentId, topicId, modeId) {
  return sessions
    .filter((s) => s.studentId === studentId && s.topicId === topicId && (!modeId || s.modeId === modeId))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] ?? null;
}

function conceptProgressSummary(sessions, studentId, topicId, topicRecord) {
  if (!topicRecord) return { total: 0, mastered: 0 };
  const concepts = deriveConcepts(topicRecord.cards);
  const total = concepts.length;
  const mastered = concepts.filter(
    (c) => computeConceptLevel(sessions, studentId, topicId, c.conceptId) === 3
  ).length;
  return { total, mastered };
}

export default function HomeScreen() {
  const setScreen          = useAppStore((s) => s.setScreen);
  const account            = useAppStore((s) => s.account);
  const students           = useAppStore((s) => s.students);
  const topicRecords       = useAppStore((s) => s.topicRecords);
  const sessions           = useAppStore((s) => s.sessions);
  const activeStudentId    = useAppStore((s) => s.activeStudentId);
  const activeTopicId      = useAppStore((s) => s.activeTopicId);
  const activeModeId       = useAppStore((s) => s.activeModeId);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const setActiveTopicId   = useAppStore((s) => s.setActiveTopicId);

  const student = students.find((s) => s.id === activeStudentId) ?? students[0];
  const topic   = topicRecords.find((r) => r.meta.id === activeTopicId) ?? topicRecords[0];
  const mode    = topic?.modes?.find((m) => m.id === activeModeId) ?? topic?.modes?.[0];

  const progress = conceptProgressSummary(sessions, student?.id, topic?.meta.id, topic);
  const lastSession = student && topic && mode
    ? getLastSession(sessions, student.id, topic.meta.id, mode?.id)
    : null;

  const canStart = !!student && !!topic && !!mode;

  const noStudents = students.length === 0;
  const noTopics   = topicRecords.length === 0;

  if (noStudents || noTopics) {
    return (
      <div className="screen">
        <div className="screen-header">
          <h1 className="screen-title">Mirocard</h1>
          <button className="header-action-btn" onClick={() => setScreen("settings")}>⚙</button>
        </div>
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-state__text">С чего начнём?</div>
          {noStudents && <Button onClick={() => setScreen("students")}>+ Добавить ученика</Button>}
          {noTopics   && <Button variant="secondary" onClick={() => setScreen("topics")}>↓ Скачать первую тему</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">Mirocard</h1>
        <button className="header-action-btn" onClick={() => setScreen("settings")}>⚙</button>
      </div>

      <div className="home-card">
        <button className="home-row" onClick={() => setScreen("students")}>
          <span className="home-row__icon">👤</span>
          <span className="home-row__label">{student?.name ?? "Выберите ученика"}</span>
          <span className="home-row__chevron">›</span>
        </button>

        <button className="home-row" onClick={() => setScreen("topics")}>
          <span className="home-row__icon">📚</span>
          <div className="home-row__center">
            <span className="home-row__label">{topic?.meta.title ?? "Выберите тему"}</span>
            {topic && (
              <ProgressBar value={progress.mastered} max={progress.total} className="home-topic-progress" />
            )}
          </div>
          <span className="home-row__meta">{progress.mastered}/{progress.total}</span>
          <span className="home-row__chevron">›</span>
        </button>

        <button className="home-row" onClick={() => setScreen("modes")}>
          <span className="home-row__icon">🎯</span>
          <span className="home-row__label">{mode?.ui?.title ?? "Выберите режим"}</span>
          <span className="home-row__chevron">›</span>
        </button>

        {lastSession && (
          <div className="home-last-session">
            Последний раз: {lastSession.percentCorrect !== null ? `${lastSession.percentCorrect}%` : "просмотр"} · {formatDate(lastSession.completedAt)}
          </div>
        )}
      </div>

      <div style={{ padding: "0 16px" }}>
        <Button fullWidth disabled={!canStart} onClick={() => setScreen("params")}>
          ▶ Начать занятие
        </Button>
      </div>

      <div className="home-actions">
        <button className="home-action-btn" onClick={() => setScreen("students")}>+ Ученик</button>
        <button className="home-action-btn" onClick={() => setScreen("topics")}>↓ Темы</button>
      </div>
    </div>
  );
}
