import { useState } from "react";
import { useAppStore } from "@/core/store";
import { formatDate, getTopicTitle } from "@/shared/utils/format";
import { computeProgressAfterSession } from "./useConceptProgress";
import ConceptDot from "@/shared/components/ConceptDot";
import Button from "@/shared/components/Button";
import HoldButton from "@/shared/components/HoldButton";
import RewardVideoModal from "@/shared/components/RewardVideoModal";

const ASSESSMENT_LABELS = {
  independent: "Сам",
  after_text: "После текста",
  none: "Нет ответа",
  prompted: "С подсказкой",
  read: "Прочитал",
  expressive: "Выразительно",
  fail: "Не ответил",
  correct: "Правильно",
  easy: "Легко",
};

export default function SessionSummary() {
  const setScreen         = useAppStore((s) => s.setScreen);
  const isStudentPortal   = useAppStore((s) => s.isStudentPortal);
  const sessions          = useAppStore((s) => s.sessions);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const students          = useAppStore((s) => s.students);
  const activeStudentId   = useAppStore((s) => s.activeStudentId);
  const session = sessions[sessions.length - 1];

  const topicRecord  = topicRecords.find((r) => r.meta.id === session?.topicId);
  const sessionMode  = topicRecord?.modes?.find((mode) => mode.id === session?.modeId);
  const isReading    = topicRecord?.meta.renderer === "reading";
  const isEvaluated  = session?.percentCorrect !== null && session?.percentCorrect !== undefined;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showReward,  setShowReward]  = useState(false);

  const activeStudent  = students.find((s) => s.id === activeStudentId);
  const canShowReward  = Boolean(session?.reward?.videoAvailable);

  if (!session) {
    return (
      <div className="screen">
        <div className="screen-center">Нет данных о сессии</div>
      </div>
    );
  }

  const progressAfter = computeProgressAfterSession(sessions, session);

  return (
    <div className="screen summary-screen">

      {/* Actions */}
      <div className="summary-actions">
        <Button variant="secondary" onClick={() => setScreen("session")}>Ещё раз</Button>
        {canShowReward && (
          <Button variant="secondary" onClick={() => setShowReward(true)}>🎬 Награда</Button>
        )}
        {isStudentPortal ? (
          <Button onClick={() => setScreen("home")}>Завершить</Button>
        ) : (
          <HoldButton className="summary-finish-btn" onAction={() => setScreen("home")} skipTaps>
            <span className="summary-finish-btn__label">Завершить</span>
          </HoldButton>
        )}
      </div>

      {/* Collapsible teacher stats */}
      <div className="summary-details">
        <button
          className="summary-details__toggle"
          onClick={() => setDetailsOpen((v) => !v)}
        >
          {detailsOpen ? "▲" : "▼"} Результаты
        </button>

        {detailsOpen && (
          <div className="summary-details__body">
            <div className="summary-date">{formatDate(session.completedAt)}</div>

            {isEvaluated ? (
              <div className="summary-score-compact">
                {session.percentCorrect}% · ✓ {session.correctCount} · ✗ {session.incorrectCount}
              </div>
            ) : (
              <div className="summary-score-compact">
                {isReading
                  ? getTopicTitle(sessionMode?.ui?.title) || session.modeId
                  : `${session.conceptIds?.length ?? 0} карточек`}
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

            {session.assessments?.length > 0 && (
              <div className="summary-section">
                <div className="summary-section-title">Оценки</div>
                <ul className="summary-progress-list">
                  {session.assessments.map((assessment, i) => (
                    <li key={i} className="summary-progress-item">
                      <ConceptDot level={assessment.quality === "none" || assessment.quality === "fail" ? 1 : 2} />
                      {ASSESSMENT_LABELS[assessment.quality] ?? assessment.quality}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isReading && session.conceptIds?.length > 0 && (
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
          </div>
        )}
      </div>

      {showReward && activeStudent && (
        <RewardVideoModal
          rewardVideos={activeStudent.rewardVideos ?? []}
          studentId={activeStudent.id}
          onDismiss={() => setShowReward(false)}
        />
      )}
    </div>
  );
}
