export function thresholdToStars(threshold) {
  if (threshold <= 70) return 3;
  if (threshold <= 80) return 4;
  return 5;
}

export function computeStarProgress({ correctCount, total, rewardThreshold, available }) {
  const thresholdStars = thresholdToStars(rewardThreshold ?? 90);
  const litStars = Math.min(5, Math.floor(correctCount / Math.max(1, total) * 5));
  const videoUnlocked = available && litStars >= thresholdStars;
  return { litStars, thresholdStars, videoUnlocked, available };
}

export function useStarProgress(props) {
  return computeStarProgress(props);
}
