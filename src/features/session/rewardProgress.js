export function normalizeRewardThreshold(value, fallback = 90) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(1, Math.round(number)));
}

export function getRewardTargetCount(total, threshold) {
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
  if (safeTotal <= 0) return null;

  const safeThreshold = normalizeRewardThreshold(threshold);
  return Math.max(1, Math.min(safeTotal, Math.ceil((safeTotal * safeThreshold) / 100)));
}

export function getCompletedTaskCount(sessionState) {
  if (!sessionState) return 0;

  const total = sessionState.tasks?.length ?? 0;
  if (sessionState.status === "completed") return sessionState.correctCount ?? total;

  const taskIndex = Math.max(0, Math.floor(Number(sessionState.taskIndex) || 0));
  const currentTaskCompleted = sessionState.status === "answer_correct" ? 1 : 0;
  return Math.max(0, Math.min(total, taskIndex + currentTaskCompleted));
}

export function buildRewardProgress({
  sessionState,
  mode,
  videoRewardEnabled,
  hasRewardVideos,
  rewardThreshold,
}) {
  const threshold = normalizeRewardThreshold(rewardThreshold);
  const total = sessionState?.tasks?.length ?? 0;
  const completed = getCompletedTaskCount(sessionState);
  const available = Boolean(
    total > 0 &&
    hasRewardVideos &&
    videoRewardEnabled &&
    mode?.evaluation !== "none"
  );
  const target = available ? getRewardTargetCount(total, threshold) : null;

  return {
    available,
    earned: Boolean(available && target != null && completed >= target),
    threshold,
    target,
    completed,
    total,
    remaining: target == null ? null : Math.max(0, target - completed),
  };
}
