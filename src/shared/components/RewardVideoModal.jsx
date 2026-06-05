import { useState, useEffect } from "react";
import { pickStoredRewardVideoId } from "@/shared/utils/rewardVideoPicker";
import { formatRewardTime } from "@/shared/utils/format";

const REWARD_SECONDS = 120;

function blockInteraction(event) {
  if (event.target instanceof Element && event.target.closest(".video-reward-close")) return;
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
}

export default function RewardVideoModal({ rewardVideos = [], studentId, onDismiss }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!videoUrl || secondsLeft <= 0) return undefined;
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(t); onDismiss(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [videoUrl, onDismiss]);

  function handleWatch() {
    const videoId = pickStoredRewardVideoId(rewardVideos, `student:${studentId ?? "unknown"}`);
    if (!videoId) { onDismiss(); return; }
    setVideoUrl(
      `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&controls=0&rel=0&fs=0&disablekb=1&iv_load_policy=3&modestbranding=1`
    );
    setSecondsLeft(REWARD_SECONDS);
  }

  if (videoUrl) {
    return (
      <div
        className="video-reward-overlay"
        onClickCapture={blockInteraction}
        onContextMenu={blockInteraction}
        onPointerDown={blockInteraction}
        onPointerMove={blockInteraction}
        onPointerUp={blockInteraction}
        onTouchStart={blockInteraction}
        onTouchMove={blockInteraction}
        onTouchEnd={blockInteraction}
        onWheel={blockInteraction}
      >
        <button className="video-reward-close" onClick={onDismiss} aria-label="Закрыть">✕</button>
        <div className="video-reward-frame">
          <iframe
            src={videoUrl}
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
            style={{ width: `${(secondsLeft / REWARD_SECONDS) * 100}%` }}
          />
          <span className="video-reward-progress__label">{formatRewardTime(secondsLeft)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="reward-modal-overlay" onClick={onDismiss}>
      <div className="reward-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reward-modal__stars">⭐⭐⭐⭐⭐</div>
        <div className="reward-modal__title">Молодец! Пять правильных подряд!</div>
        <div className="reward-modal__actions">
          <button className="reward-modal__btn reward-modal__btn--watch" onClick={handleWatch}>
            🎬 Смотреть мультик
          </button>
          <button className="reward-modal__btn reward-modal__btn--continue" onClick={onDismiss}>
            Продолжать занятие
          </button>
        </div>
      </div>
    </div>
  );
}
