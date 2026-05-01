import { useAppStore } from "@/core/store";
import { formatDate, getTopicTitle } from "@/shared/utils/format";

export default function StudentHistoryScreen() {
  const setScreen       = useAppStore((s) => s.setScreen);
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const students        = useAppStore((s) => s.students);
  const sessions        = useAppStore((s) => s.sessions);
  const topicRecords    = useAppStore((s) => s.topicRecords);

  const student = students.find((s) => s.id === activeStudentId);
  const mySessions = sessions
    .filter((s) => s.studentId === activeStudentId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("students")}>←</button>
        <h1 className="screen-title">{student?.name ?? "История"}</h1>
      </div>

      {mySessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__text">Сессий пока нет</div>
        </div>
      ) : (
        <ul className="history-list">
          {mySessions.map((s) => {
            const topic = topicRecords.find((r) => r.meta.id === s.topicId);
            return (
              <li key={s.id} className="history-item">
                <div className="history-item__main">
                  <div className="history-item__topic">{getTopicTitle(topic?.meta.title) || s.topicId}</div>
                  <div className="history-item__mode">{s.modeId}</div>
                </div>
                <div className="history-item__right">
                  <div className="history-item__score">
                    {s.percentCorrect !== null ? `${s.percentCorrect}%` : "—"}
                  </div>
                  <div className="history-item__date">{formatDate(s.completedAt)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
