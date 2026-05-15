import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import {
  formatDate, getTopicTitle,
  extractYoutubeId, computeRewardSeconds, formatRewardTime, getVideoUrl,
} from "@/shared/utils/format";
import { computeProgressAfterSession } from "./useConceptProgress";
import ConceptDot from "@/shared/components/ConceptDot";
import Button from "@/shared/components/Button";

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

const STAR_THRESHOLD = 90;

function getStarCount(percentCorrect, rewardThreshold) {
  if (percentCorrect === null || percentCorrect === undefined) return null;
  if (percentCorrect >= rewardThreshold)      return 3;
  if (percentCorrect >= rewardThreshold - 20) return 2;
  return 1;
}

function getPraiseText(starCount, isReading) {
  if (starCount === null) return isReading ? "Молодец, ты прочитал!" : "Молодец, ты справился!";
  if (starCount === 3) return "Молодец! Три звезды!";
  if (starCount === 2) return "Хорошо! Две звезды!";
  return "Старался! Одна звезда!";
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
  const students          = useAppStore((s) => s.students);
  const studentTopicLinks = useAppStore((s) => s.studentTopicLinks);

  const session = sessions[sessions.length - 1];

  const topicRecord        = topicRecords.find((r) => r.meta.id === session?.topicId);
  const sessionText        = topicRecord?.texts?.find((text) => text.id === session?.textId);
  const sessionMode        = topicRecord?.modes?.find((mode) => mode.id === session?.modeId);
  const isReading          = topicRecord?.meta.renderer === "reading";
  const student            = students.find((s) => s.id === session?.studentId);
  const link               = session ? (studentTopicLinks[`${session.studentId}_${session.topicId}`] ?? {}) : {};
  const rewardVideos       = student?.rewardVideos ?? [];
  const sessionReward      = session?.reward ?? null;
  const videoRewardEnabled = sessionReward?.videoEnabled ?? link.videoRewardEnabled ?? true;
  const rewardThreshold    = sessionReward?.threshold ?? link.rewardThreshold ?? 90;
  const rewardEarned       = sessionReward
    ? Boolean(sessionReward.earned)
    : (session?.percentCorrect ?? -1) >= rewardThreshold;
  const rewardSeconds      = rewardEarned && videoRewardEnabled
    ? computeRewardSeconds(session.modeId, sessionReward?.total ?? topicRecord?.cards?.length ?? 10)
    : 0;

  const isEvaluated  = session?.percentCorrect !== null && session?.percentCorrect !== undefined;
  const starCount    = isEvaluated ? getStarCount(session.percentCorrect, STAR_THRESHOLD) : null;
  const praiseText   = getPraiseText(starCount, isReading);

  const [videoOpen,       setVideoOpen]       = useState(false);
  const [rewardConsumed,  setRewardConsumed]  = useState(false);
  const [rewardRemaining, setRewardRemaining] = useState(0);
  const [detailsOpen,     setDetailsOpen]     = useState(false);
  const [rewardVideoUrl,  setRewardVideoUrl]  = useState(null);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => speak(praiseText), 600);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!videoOpen) return undefined;
    const intervalId = window.setInterval(() => {
      setRewardRemaining((prev) => {
        if (prev <= 1) { window.clearInterval(intervalId); setVideoOpen(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [videoOpen, rewardSeconds]);

  if (!session) {
    return (
      <div className="screen">
        <div className="screen-center">Нет данных о сессии</div>
      </div>
    );
  }

  const progressAfter    = computeProgressAfterSession(sessions, session);
  const showRewardButton = !rewardConsumed && rewardSeconds > 0 && rewardVideos.length > 0;

  function handleOpenVideo() {
    const index = Math.floor(Math.random() * rewardVideos.length);
    const videoId = extractYoutubeId(getVideoUrl(rewardVideos[index]));
    if (!videoId) return;
    window.speechSynthesis?.cancel();
    setRewardVideoUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&controls=0&rel=0&fs=0&disablekb=1&iv_load_policy=3&modestbranding=1`);
    setRewardRemaining(rewardSeconds);
    setRewardConsumed(true);
    setVideoOpen(true);
  }

  return (
    <div className="screen summary-screen">

      {/* Celebration block */}
      <div className="summary-celebration">
        <div className="summary-topic-label">
          {getTopicTitle(topicRecord?.meta.title) || session.topicId}
          {sessionText ? ` · ${getTopicTitle(sessionText.title)}` : ""}
        </div>

        {starCount !== null ? (
          <div className="summary-stars">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`summary-star summary-star--${i} ${i <= starCount ? "summary-star--lit" : "summary-star--dim"}`}
              >
                ⭐
              </span>
            ))}
          </div>
        ) : (
          <div className="summary-check">✓</div>
        )}

        <div className="summary-praise">{praiseText}</div>
      </div>

      {/* Video bonus button */}
      {showRewardButton && (
        <button className="reward-video-btn" onClick={handleOpenVideo}>
          🎬 Смотреть мультик
        </button>
      )}

      {/* Actions */}
      <div className="summary-actions">
        <Button variant="secondary" onClick={() => setScreen("modes")}>Ещё раз</Button>
        <Button variant="primary"   onClick={() => setScreen("home")}>Завершить</Button>
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

      {/* Video overlay */}
      {videoOpen && (
        <div className="video-reward-overlay">
          <button className="video-reward-close" onClick={() => setVideoOpen(false)} aria-label="Закрыть">✕</button>
          <div className="video-reward-frame">
            <iframe
              src={rewardVideoUrl}
              allow="accelerometer; autoplay; encrypted-media"
              frameBorder="0"
              className="video-reward-iframe"
              title="Reward video"
            />
            <div className="video-reward-blocker" aria-hidden="true" />
          </div>
          <div className="video-reward-progress">
            <div
              className="video-reward-progress__bar"
              style={{ width: `${rewardSeconds > 0 ? (rewardRemaining / rewardSeconds) * 100 : 0}%` }}
            />
            <span className="video-reward-progress__label">{formatRewardTime(rewardRemaining)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
