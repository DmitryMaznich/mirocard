import StarBar from "@/shared/components/StarBar";
import { useOnlineStatus } from "@/shared/hooks/useOnlineStatus";
import { getTonguePillState } from "./tonguePillState";

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
  onOpenModeSettings,
  answerStatus,
}) {
  const isOnline = useOnlineStatus();

  const pillState = getTonguePillState({ answerStatus });
  const pillAriaLabel =
    pillState.mode === "correct" ? "Правильно, открыть настройки режима"
    : pillState.mode === "incorrect" ? "Неправильно, открыть настройки режима"
    : "Открыть настройки режима";

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

  const streakBar = showStreak ? (
    <StarBar
      className="session-progress"
      streakCount={streakCount}
      available={rewardAvailable}
      answersPerStar={answersPerStar}
    />
  ) : null;

  return (
    <div className="session-topbar">
      {showProgress ? (
        <>
          <div className="session-topbar-controls">
            {streakBar}
            {rightCluster}
          </div>
          <div className="session-subtitle">{topicTitle} · {modeTitle}</div>
        </>
      ) : (
        <div className="session-topbar-controls">
          {streakBar}
          <div className="session-subtitle session-subtitle--inline">{topicTitle} · {modeTitle}</div>
          {rightCluster}
        </div>
      )}
      <button
        type="button"
        className={`session-plan-tongue${pillState.mode === "correct" ? " session-plan-tongue--correct" : ""}${pillState.mode === "incorrect" ? " session-plan-tongue--incorrect" : ""}`}
        onClick={onOpenModeSettings}
        aria-label={pillAriaLabel}
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
