import StarBar from "@/shared/components/StarBar";

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
  soundEnabled,
  onToggleSound,
  isStudentPortal,
  adultConfirmAdvance,
  lockHoldProgress,
  lockFlash,
  onLockPointerDown,
  onLockPointerUp,
  onClose,
}) {
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
      <button
        className={`session-audio-icon-button${soundEnabled ? " session-audio-icon-button--active" : ""}`}
        onClick={onToggleSound}
        aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
      >
        <span className="session-audio-speaker-icon">
          {soundEnabled ? "🔊" : "🔇"}
        </span>
      </button>
      {!isStudentPortal && (
        <button
          className="session-lock-btn"
          style={{ "--lock-p": lockHoldProgress }}
          onPointerDown={onLockPointerDown}
          onPointerUp={onLockPointerUp}
          onPointerLeave={onLockPointerUp}
          onPointerCancel={onLockPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={adultConfirmAdvance ? "Снять блокировку (удержать)" : "Включить блокировку (удержать)"}
        >
          <span className="session-lock-btn__icon">
            {adultConfirmAdvance ? "🔒" : "🔓"}
          </span>
          {lockFlash && (
            <span className={`session-lock-flash session-lock-flash--${lockFlash}`}>
              {lockFlash === "locked" ? "Блок." : "Снято"}
            </span>
          )}
        </button>
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
    </div>
  );
}
