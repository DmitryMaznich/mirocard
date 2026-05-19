export function thresholdToStars(threshold) {
  if (threshold <= 70) return 3;
  if (threshold <= 80) return 4;
  return 5;
}

export function computeStarProgress({ correctCount, incorrectCount = 0, total, rewardThreshold, available }) {
  const thresholdStars = thresholdToStars(rewardThreshold ?? 90);
  const netScore = Math.max(0, correctCount - incorrectCount);
  const litStars = Math.min(5, Math.floor(netScore / Math.max(1, total) * 5));
  const videoUnlocked = available && litStars >= thresholdStars;
  return { litStars, thresholdStars, videoUnlocked, available };
}

export function useStarProgress(props) {
  return computeStarProgress(props);
}
