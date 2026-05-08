import { useState, useEffect } from "react";
import { useAppStore } from "@/core/store";
import {
  formatDate, getTopicTitle,
  extractYoutubeId, makeYoutubeEmbedUrl, computeRewardSeconds, formatRewardTime,
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

export default function SessionSummary() {
  const setScreen         = useAppStore((s) => s.setScreen);
  const sessions          = useAppStore((s) => s.sessions);
  const topicRecords      = useAppStore((s) => s.topicRecords);
  const students          = useAppStore((s) => s.students);
  const studentTopicLinks = useAppStore((s) => s.studentTopicLinks);

  const session = sessions[sessions.length - 1];

  // Compute reward data before hooks (must not be after early return)
  const topicRecord        = topicRecords.find((r) => r.meta.id === session?.topicId);
  const sessionText        = topicRecord?.texts?.find((text) => text.id === session?.textId);
  const sessionMode        = topicRecord?.modes?.find((mode) => mode.id === session?.modeId);
  const isReading          = topicRecord?.meta.renderer === "reading";
  const student            = students.find((s) => s.id === session?.studentId);
  const link               = session ? (studentTopicLinks[`${session.studentId}_${session.topicId}`] ?? {}) : {};
  const rewardVideos       = student?.rewardVideos ?? [];
  const videoRewardEnabled = link.videoRewardEnabled ?? true;
  const rewardSeconds      = (session?.percentCorrect ?? -1) >= 90 && videoRewardEnabled
    ? computeRewardSeconds(session.modeId, topicRecord?.cards?.length ?? 10)
    : 0;

  const [videoOpen,      setVideoOpen]      = useState(false);
  const [rewardConsumed, setRewardConsumed] = useState(false);
  const [remaining,      setRemaining]      = useState(0);
  const [embedUrl,       setEmbedUrl]       = useState(null);

  useEffect(() => {
    if (!videoOpen) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(id); setVideoOpen(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [videoOpen, rewardSeconds]);

  if (!session) {
    return (
      <div className="screen">
        <div className="screen-center">Нет данных о сессии</div>
      </div>
    );
  }

  const progressAfter    = computeProgressAfterSession(sessions, session);
  const isEvaluated      = session.percentCorrect !== null;
  const showRewardButton = !rewardConsumed && rewardSeconds > 0 && rewardVideos.length > 0;

  function handleOpenVideo() {
    const url = rewardVideos[Math.floor(Math.random() * rewardVideos.length)];
    const id  = extractYoutubeId(url);
    const finalUrl = id ? makeYoutubeEmbedUrl(id) : null;
    setEmbedUrl(finalUrl);
    setRemaining(rewardSeconds);
    setRewardConsumed(true);
    setVideoOpen(true);
  }

  return (
    <div className="screen summary-screen">
      <div style={{ background:"red", color:"#fff", fontSize:14, fontWeight:"bold", padding:"8px 12px", textAlign:"center" }}>
        DBG v4 · видео:{rewardVideos.length} · %:{session.percentCorrect ?? "?"} · сек:{rewardSeconds}
      </div>
      <div className="summary-header">
        <div className="summary-topic">
          {getTopicTitle(topicRecord?.meta.title) || session.topicId}
          {sessionText ? ` · ${getTopicTitle(sessionText.title)}` : ""}
        </div>
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
          <div className="summary-pct">{isReading ? "Чтение" : "Просмотр"}</div>
          <div className="summary-counts">
            {isReading ? sessionMode?.ui?.title ?? session.modeId : `${session.conceptIds?.length ?? 0} карточек`}
          </div>
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

      {showRewardButton && (
        <button className="reward-video-btn" onClick={handleOpenVideo}>
          🎬 Смотреть мультик ({formatRewardTime(rewardSeconds)})
        </button>
      )}


      <div className="summary-actions">
        <Button variant="secondary" onClick={() => setScreen("modes")}>Ещё раз</Button>
        <Button variant="primary"   onClick={() => setScreen("home")}>Завершить</Button>
      </div>

      {videoOpen && (
        <div className="video-reward-overlay">
          <div className="video-reward-frame">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                frameBorder="0"
                className="video-reward-iframe"
                title="Reward video"
              />
            ) : (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:16, color:"#fff" }}>
                <div>Не удалось загрузить видео</div>
                <div style={{ fontSize:11, color:"#aaa", wordBreak:"break-all", padding:"0 16px", textAlign:"center" }}>{rewardVideos[0]}</div>
              </div>
            )}
            <div className="video-reward-blocker" aria-hidden="true" />
          </div>
          <div className="video-reward-footer">
            <div style={{ fontSize:11, color:"#888", textAlign:"center", padding:"4px 0" }}>
              src: {embedUrl ?? "null"}
            </div>
            <div className="video-reward-progress">
              <div
                className="video-reward-progress__bar"
                style={{ width: `${rewardSeconds > 0 ? (remaining / rewardSeconds) * 100 : 0}%` }}
              />
            </div>
            <div className="video-reward-bottom">
              <span className="video-reward-progress__label">{formatRewardTime(remaining)}</span>
              <button
                className="video-reward-close-btn"
                onClick={() => setVideoOpen(false)}
              >
                ✕ Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
