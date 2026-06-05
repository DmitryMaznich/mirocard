export function computeStreakProgress({ streakCount, available }) {
  const litStars = Math.min(5, Math.max(0, streakCount ?? 0));
  return { litStars, available: Boolean(available) };
}

// Used by SessionSummary for display-only stars (percentage-based, not for reward logic)
export function computeDisplayStars({ correctCount, incorrectCount = 0, total }) {
  const netScore = Math.max(0, (correctCount ?? 0) - (incorrectCount ?? 0));
  return Math.min(5, Math.floor(netScore / Math.max(1, total) * 5));
}

export function useStarProgress(props) {
  return computeStreakProgress(props);
}
