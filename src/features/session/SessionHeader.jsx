import { useRef, useState } from "react";
import StarBar from "@/shared/components/StarBar";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";
import { getTonguePillState } from "./tonguePillState";

const PULL_THRESHOLD = 14; // px of vertical drag before it commits to opening/closing
const PULL_MAX = 26;       // px of drag travel used for the live stretch, then it's clamped

// A classic dot+arcs wifi glyph, not an emoji — renders identically across
// platforms/fonts, which matters since this is the one status cue still
// visible when iOS's own status bar is hidden (Guided Access / pinned app).
function NetworkStatusIcon({ online }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="15.5" r="1.4" fill="currentColor" />
      <path d="M6.8 12.3a4.6 4.6 0 016.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3.8 9a8.8 8.8 0 0112.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {!online && <path d="M2.5 2.5l15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

function useTonguePull(isDrawerOpen, onSetDrawerOpen) {
  const [pullProgress, setPullProgress] = useState(0);
  const dragRef = useRef(null); // { startY, pointerId }
  const suppressClickRef = useRef(false);

  function directionalDelta(clientY, startY) {
    const deltaY = clientY - startY;
    // Closed: dragging DOWN reveals the panel. Open: dragging UP retracts it.
    return isDrawerOpen ? -deltaY : deltaY;
  }

  function handlePointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { startY: e.clientY, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const directional = directionalDelta(e.clientY, drag.startY);
    if (!isDrawerOpen) {
      setPullProgress(Math.max(0, Math.min(PULL_MAX, directional)) / PULL_MAX);
    }
  }

  function endDrag(e) {
    const drag = dragRef.current;
    dragRef.current = null;
    setPullProgress(0);
    if (!drag) return;
    const directional = directionalDelta(e.clientY, drag.startY);
    if (directional > PULL_THRESHOLD) {
      suppressClickRef.current = true; // the drag already decided it — the trailing click is a no-op
      onSetDrawerOpen(!isDrawerOpen);
    }
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSetDrawerOpen(!isDrawerOpen);
  }

  return {
    pullProgress,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onClick: handleClick,
  };
}

export default function SessionHeader({
  topicTitle,
  modeTitle,
  showProgress,
  showStreak,
  streakCount,
  rewardAvailable,
  answersPerStar,
  taskIndex,
  total,
  correctCount,
  incorrectCount,
  evaluation,
  onClose,
  tongueLabel,
  isDrawerOpen,
  onSetDrawerOpen,
  hasUndonePlanItems,
  answerStatus,
}) {
  const tonguePull = useTonguePull(isDrawerOpen, onSetDrawerOpen);
  const isOnline = useOnlineStatus();

  const pillState = getTonguePillState({ isDrawerOpen, answerStatus, hasUndonePlanItems });
  const pillAriaLabel =
    pillState.mode === "correct" ? "Правильно, открыть меню"
    : pillState.mode === "incorrect" ? "Неправильно, открыть меню"
    : tongueLabel;

  const rightCluster = (
    <div className="session-topbar-right">
      {showProgress && evaluation !== "instant" && total > 1 && (
        <div className="session-counter">
          {taskIndex + 1} / {total}
          {evaluation !== "none" && (
            <span className="session-score">  ✓{correctCount}  ✗{incorrectCount}</span>
          )}
        </div>
      )}
      <span
        className={`session-network-status${isOnline ? "" : " session-network-status--offline"}`}
        role="status"
        aria-label={isOnline ? "Есть подключение к интернету" : "Нет подключения к интернету"}
      >
        <NetworkStatusIcon online={isOnline} />
      </span>
      <button className="session-finish-btn" onClick={onClose}>✕</button>
    </div>
  );

  return (
    <div className="session-topbar">
      {showProgress ? (
        <>
          <div className="session-topbar-controls">
            {showStreak && (
              <StarBar
                className="session-progress"
                streakCount={streakCount}
                available={rewardAvailable}
                answersPerStar={answersPerStar}
              />
            )}
            {rightCluster}
          </div>
          <div className="session-subtitle">{topicTitle} · {modeTitle}</div>
        </>
      ) : (
        <div className="session-topbar-controls">
          <div className="session-subtitle session-subtitle--inline">{topicTitle} · {modeTitle}</div>
          {rightCluster}
        </div>
      )}
      <button
        type="button"
        className={`session-plan-tongue${pillState.mode === "open" ? " session-plan-tongue--open" : ""}${pillState.mode === "correct" ? " session-plan-tongue--correct" : ""}${pillState.mode === "incorrect" ? " session-plan-tongue--incorrect" : ""}${pillState.pulse ? " session-plan-tongue--pulse" : ""}`}
        style={{ "--tongue-pull": tonguePull.pullProgress }}
        onPointerDown={tonguePull.onPointerDown}
        onPointerMove={tonguePull.onPointerMove}
        onPointerUp={tonguePull.onPointerUp}
        onPointerCancel={tonguePull.onPointerCancel}
        onClick={tonguePull.onClick}
        aria-label={pillAriaLabel}
        aria-expanded={isDrawerOpen}
      >
        {pillState.mode === "correct" || pillState.mode === "incorrect" ? (
          <span className="session-plan-tongue__emoji" aria-hidden="true">
            {pillState.mode === "correct" ? "😊" : "😢"}
          </span>
        ) : (
          <>
            <span className="session-plan-tongue__bar" aria-hidden="true" />
            <span className="session-plan-tongue__bar" aria-hidden="true" />
            <span className="session-plan-tongue__bar" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}
