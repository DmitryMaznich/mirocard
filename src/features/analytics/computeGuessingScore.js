const RT_FAST = 1500;
const RT_SLOW = 8000;

/**
 * Returns 0.0 (mastered) … 1.0 (guessing) based on attempt count and reaction time.
 * k=1, t=800ms → 0.00   k=1, t=3000ms → 0.08
 * k=2, t=5000ms → 0.51  k=3, t=8000ms → 0.78
 */
export function computeGuessingScore(attemptCount, firstCorrectMs) {
  const k = Math.max(1, attemptCount);
  const t = Math.max(0, firstCorrectMs);
  const attemptSignal = 1 - 1 / k;
  const timeSignal = Math.max(0, Math.min(1, (t - RT_FAST) / (RT_SLOW - RT_FAST)));
  return Math.round((0.65 * attemptSignal + 0.35 * timeSignal) * 100) / 100;
}

/** Maps question_answer quality value to a guessing_score equivalent. */
export function qualityToGuessingScore(quality) {
  return { easy: 0.0, correct: 0.15, prompted: 0.65, fail: 0.90 }[quality] ?? 0.5;
}
