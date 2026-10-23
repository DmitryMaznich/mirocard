import { useState, useEffect, useRef } from "react";
import { pickStoredRewardVideoId } from "@/shared/utils/rewardVideoPicker";
import { formatRewardTime } from "@/shared/utils/format";
import { recordRewardVideoView } from "@/core/rewardVideoViews";

const REWARD_SECONDS = 120;

function blockInteraction(event) {
  if (event.target instanceof Element && event.target.closest(".video-reward-close")) return;
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
}

export default function RewardVideoModal({
  rewardVideos = [],
  studentId,
  onDismiss,
  title = "Молодец! 🎉",
}) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);
  const iframeRef = useRef(null);
  const expiredRef = useRef(false);
  const viewRecordedRef = useRef(false);

  useEffect(() => {
    if (!videoUrl || !hasStarted || viewRecordedRef.current) return;
    viewRecordedRef.current = true;
    const videoId = videoUrl.split("/embed/")[1].split("?")[0];
    recordRewardVideoView(studentId, videoId).catch((error) => console.error("Не удалось сохранить показ видео", error));
  }, [videoUrl, hasStarted, studentId]);

  // Some callers (e.g. column_addition's "Контрольная работа") pass an
  // inline onDismiss that's a new function on every one of their renders.
  // Keeping onDismiss out of the interval effect's deps — reading it via a
  // ref instead — means a caller re-rendering faster than once a second
  // can't keep tearing down and restarting this interval before it ever
  // gets a full 1000ms tick in, which used to leave the countdown frozen
  // and the video playing with no time limit.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (!videoUrl) return undefined;
    let disposed = false;
    let player;
    let started = false;
    let poll;
    let timeout;
    const fail = () => {
      if (disposed) return;
      clearInterval(poll);
      clearTimeout(timeout);
      setIsPlaying(false);
      if (!window.YT?.Player) document.getElementById("reward-youtube-api")?.remove();
      setPlaybackError("Не удалось загрузить видео. Закройте его и попробуйте ещё раз.");
    };
    function handlePlayerState(event) {
      if (disposed) return;
      const playing = event.data === 1;
      setIsPlaying(playing);
      if (playing) {
        clearTimeout(timeout);
        started = true;
        setHasStarted(true);
        setPlaybackError(null);
      }
      if (event.data === 0 && started && !expiredRef.current) {
        expiredRef.current = true;
        onDismissRef.current?.();
      }
    }
    function connect() {
      if (disposed || !window.YT?.Player) return;
      clearInterval(poll);
      player = new window.YT.Player(iframeRef.current, {
        events: {
          onReady: (event) => {
            if (disposed) return;
            clearTimeout(timeout);
            // Safari may reject this attempt. Leave native Play tappable until
            // YouTube confirms PLAYING instead of consuming the reward time.
            event.target.playVideo();
            // Autoplay can start before the API attaches its state listener.
            if (event.target.getPlayerState?.() === 1) handlePlayerState({ data: 1 });
          },
          onStateChange: handlePlayerState,
          onError: fail,
        },
      });
    }
    poll = setInterval(connect, 100);
    timeout = setTimeout(fail, 15000);
    if (!window.YT?.Player && !document.getElementById("reward-youtube-api")) {
      const script = document.createElement("script");
      script.id = "reward-youtube-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
    connect();
    return () => {
      disposed = true;
      clearInterval(poll);
      clearTimeout(timeout);
      player?.destroy();
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const t = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [isPlaying]);

  useEffect(() => {
    if (!hasStarted || secondsLeft > 0 || expiredRef.current) return;
    expiredRef.current = true;
    onDismissRef.current?.();
  }, [hasStarted, secondsLeft]);

  function handleWatch() {
    const videoId = pickStoredRewardVideoId(rewardVideos, `student:${studentId ?? "unknown"}`);
    if (!videoId) { onDismiss(); return; }
    setVideoUrl(
      `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&autoplay=1&playsinline=1&controls=0&rel=0&fs=0&disablekb=1&iv_load_policy=3&modestbranding=1`
    );
    setSecondsLeft(REWARD_SECONDS);
  }

  if (videoUrl) {
    return (
      <div
        className="video-reward-overlay"
        onClickCapture={isPlaying ? blockInteraction : undefined}
        onContextMenu={blockInteraction}
        onPointerDown={isPlaying ? blockInteraction : undefined}
        onPointerMove={isPlaying ? blockInteraction : undefined}
        onPointerUp={isPlaying ? blockInteraction : undefined}
        onTouchStart={isPlaying ? blockInteraction : undefined}
        onTouchMove={isPlaying ? blockInteraction : undefined}
        onTouchEnd={isPlaying ? blockInteraction : undefined}
        onWheel={blockInteraction}
      >
        <button className="video-reward-close" onClick={onDismiss} aria-label="Закрыть">✕</button>
        <div className="video-reward-frame">
          <iframe
            ref={iframeRef}
            src={videoUrl}
            style={{ pointerEvents: isPlaying ? "none" : "auto" }}
            allow="accelerometer; autoplay; encrypted-media"
            frameBorder="0"
            className="video-reward-iframe"
            title="Reward video"
          />
          {isPlaying && <div className="video-reward-blocker" aria-hidden="true" />}
        </div>
        {playbackError && <div role="alert" style={{ color: "#fff", padding: 12 }}>{playbackError}</div>}
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
        <div className="reward-modal__title">{title}</div>
        <div className="reward-modal__actions">
          <button className="reward-modal__btn reward-modal__btn--watch" onClick={handleWatch}>
            🎬 Смотреть видео
          </button>
          <button className="reward-modal__btn reward-modal__btn--continue" onClick={onDismiss}>
            Продолжать занятие
          </button>
        </div>
      </div>
    </div>
  );
}
