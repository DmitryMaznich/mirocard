import { useRef, useState } from "react";
import StarBar from "@/shared/components/StarBar";

const PULL_THRESHOLD = 14; // px of vertical drag before it commits to opening/closing
const PULL_MAX = 26;       // px of drag travel used for the live stretch, then it's clamped

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
}) {
  const tonguePull = useTonguePull(isDrawerOpen, onSetDrawerOpen);

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
        className={`session-plan-tongue${isDrawerOpen ? " session-plan-tongue--open" : ""}${!isDrawerOpen && hasUndonePlanItems ? " session-plan-tongue--pulse" : ""}`}
        style={{ "--tongue-pull": tonguePull.pullProgress }}
        onPointerDown={tonguePull.onPointerDown}
        onPointerMove={tonguePull.onPointerMove}
        onPointerUp={tonguePull.onPointerUp}
        onPointerCancel={tonguePull.onPointerCancel}
        onClick={tonguePull.onClick}
        aria-label={tongueLabel}
        aria-expanded={isDrawerOpen}
      >
        <span className="session-plan-tongue__bar" aria-hidden="true" />
        <span className="session-plan-tongue__bar" aria-hidden="true" />
        <span className="session-plan-tongue__bar" aria-hidden="true" />
      </button>
    </div>
  );
}
