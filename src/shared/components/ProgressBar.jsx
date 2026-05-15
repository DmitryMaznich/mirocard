export default function ProgressBar({ value, max, className = "", reward = null }) {
  const safeMax = Math.max(0, Number(max) || 0);
  const safeValue = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const pct = safeMax > 0 ? Math.round((safeValue / safeMax) * 100) : 0;
  const showReward = Boolean(reward?.available && reward?.target && safeMax > 0);
  const rewardPct = showReward
    ? Math.max(0, Math.min(100, (reward.target / safeMax) * 100))
    : 0;
  const classes = [
    "progress-bar",
    className,
    showReward ? "progress-bar--reward" : "",
    showReward && reward.earned ? "progress-bar--reward-earned" : "",
  ].filter(Boolean).join(" ");
  const title = showReward
    ? reward.earned
      ? `Мультик заработан · ${pct}%`
      : `Мультик после ${reward.threshold}% занятия · ${pct}%`
    : `${pct}%`;

  return (
    <div className={classes} title={title} aria-label={title}>
      <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      {showReward && (
        <div
          className="progress-bar__reward-marker"
          style={{ left: `${rewardPct}%` }}
          aria-hidden="true"
        >
          <span className="progress-bar__reward-icon" />
        </div>
      )}
    </div>
  );
}
