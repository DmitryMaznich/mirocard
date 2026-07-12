import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import { formatDate, getTopicTitle } from "@/shared/utils/format";
import { computeProgressAfterSession } from "./useConceptProgress";
import ConceptDot from "@/shared/components/ConceptDot";
import Button from "@/shared/components/Button";
import { useTimer } from "@/features/timer/TimerContext";

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

function getPraiseText(isReading) {
  return isReading ? "Молодец, ты прочитал!" : "Молодец, ты справился!";
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ru-RU";
  utter.rate = 0.85;
  utter.pitch = 1.1;
  window.speechSynthesis.speak(utter);
}

export default function SessionSummary() {
  const setScreen         = useAppStore((s) => s.setScreen);
  const sessions          = useAppStore((s) => s.sessions);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const setActiveTopicId  = useAppStore((s) => s.setActiveTopicId);
  const setActiveTextId   = useAppStore((s) => s.setActiveTextId);
  const setActiveModeId   = useAppStore((s) => s.setActiveModeId);
  const { markSessionStart } = useTimer();

  const session = sessions[sessions.length - 1];

  const topicRecord = topicRecords.find((r) => r.meta.id === session?.topicId);
  const sessionText = topicRecord?.texts?.find((text) => text.id === session?.textId);
  const sessionMode = topicRecord?.modes?.find((mode) => mode.id === session?.modeId);
  const isReading   = topicRecord?.meta.renderer === "reading";
  const isEvaluated = session?.percentCorrect !== null && session?.percentCorrect !== undefined;
  const praiseText  = getPraiseText(isReading);

  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => speak(praiseText), 600);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis?.cancel();
    };
  }, [praiseText, session]);

  if (!session) {
    return (
      <div className="screen">
        <div className="screen-center">Нет данных о сессии</div>
      </div>
    );
  }

  const progressAfter = computeProgressAfterSession(sessions, session);

  function handleRepeat() {
    setActiveTopicId(session.topicId);
    if (session.textId) setActiveTextId(session.textId);
    setActiveModeId(session.modeId);
    markSessionStart();
    setScreen("session");
  }

  return (
    <div className="screen summary-screen">

      {/* Celebration block */}
      <div className="summary-celebration">
        <div className="summary-topic-label">
          {getTopicTitle(topicRecord?.meta.title) || session.topicId}
          {sessionText ? ` · ${getTopicTitle(sessionText.title)}` : ""}
        </div>

        <div className="summary-check">✓</div>

        <div className="summary-praise">{praiseText}</div>
      </div>

      {/* Actions */}
      <div className="summary-actions">
        <Button variant="secondary" onClick={handleRepeat}>Ещё раз</Button>
        <button
          className="summary-finish-btn"
          onClick={() => setScreen("home")}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="summary-finish-btn__label">Завершить</span>
        </button>
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

    </div>
  );
}
