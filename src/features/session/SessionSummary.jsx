import { useAppStore } from "@/core/store";
import { formatDate, getTopicTitle } from "@/shared/utils/format";
import { computeProgressAfterSession } from "./useConceptProgress";
import ConceptDot from "@/shared/components/ConceptDot";
import Button from "@/shared/components/Button";

export default function SessionSummary() {
  const setScreen    = useAppStore((s) => s.setScreen);
  const sessions     = useAppStore((s) => s.sessions);
  const topicRecords = useAppStore((s) => s.topicRecords);

  const session = sessions[sessions.length - 1];

  if (!session) {
    return (
      <div className="screen">
        <div className="screen-center">Нет данных о сессии</div>
      </div>
    );
  }

  const topicRecord = topicRecords.find((r) => r.meta.id === session.topicId);
  const progressAfter = computeProgressAfterSession(sessions, session);
  const isEvaluated = session.percentCorrect !== null;

  return (
    <div className="screen summary-screen">
      <div className="summary-header">
        <div className="summary-topic">{getTopicTitle(topicRecord?.meta.title) || session.topicId}</div>
        <div className="summary-date">{formatDate(session.completedAt)}</div>
      </div>

      {isEvaluated ? (
        <div className="summary-score">
          <div className="summary-pct">{session.percentCorrect}%</div>
          <div className="summary-counts">
            ✓ {session.correctCount}  ·  ✗ {session.incorrectCount}
          </div>
        </div>
      ) : (
        <div className="summary-score">
          <div className="summary-pct">Просмотр</div>
          <div className="summary-counts">{session.conceptIds?.length ?? 0} карточек</div>
        </div>
      )}

      {session.mistakes?.length > 0 && (
        <div className="summary-section">
          <div className="summary-section-title">Ошибки</div>
          <ul className="summary-mistakes">
            {session.mistakes.map((m, i) => {
              const card = topicRecord?.cards.find((c) => c.id === m.cardId);
              return (
                <li key={i} className="summary-mistake-item">
                  <ConceptDot level={progressAfter[m.conceptId] ?? 0} />
                  {card?.label ?? m.conceptId}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {session.conceptIds?.length > 0 && (
        <div className="summary-section">
          <div className="summary-section-title">Прогресс</div>
          <ul className="summary-progress-list">
            {session.conceptIds.map((cid) => {
              const card = topicRecord?.cards.find((c) => c.conceptId === cid && c.primary);
              return (
                <li key={cid} className="summary-progress-item">
                  <ConceptDot level={progressAfter[cid] ?? 0} />
                  {card?.label ?? cid}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="summary-actions">
        <Button variant="secondary" onClick={() => setScreen("modes")}>Ещё раз</Button>
        <Button variant="primary"   onClick={() => setScreen("home")}>Завершить</Button>
      </div>
    </div>
  );
}
