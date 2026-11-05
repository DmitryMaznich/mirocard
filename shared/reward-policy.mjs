export const DEFAULT_REWARD_SETTINGS = Object.freeze({
  algorithm: "flexible", duration: "120", animation: "normal", sound: false, strictStars: true, lossMode: "one",
});

// Shared by storage and the app. Keep the algorithm field for older clients,
// but always use the current policy, including for saved legacy records.
export function normalizeRewardSettings(raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    algorithm: "flexible",
    duration: value.duration === "end" ? "180" : ["60", "120", "180"].includes(String(value.duration)) ? String(value.duration) : "120",
    animation: value.animation === "soft" ? "soft" : "normal",
    sound: value.sound === true,
    strictStars: value.strictStars !== false,
    lossMode: value.lossMode === "all" ? "all" : "one",
  };
}

export function effectiveRewardSettings(raw) {
  return normalizeRewardSettings(raw);
}

export function rewardVideoSeconds(settings) {
  return settings.duration === "end" ? 180 : Number(settings.duration);
}

export function rewardPolicy(settings, lossMode) {
  return { version: 2, lossMode: lossMode === "all" ? "all" : "one" };
}

// «Строгий подсчёт» (owner, 2026-11-04): set per topic before the lesson (state.strictStars). On — a
// mistake, a final answer or a step inside the task, burns stars by the student's rule (one / all).
// Off — stars do not burn. Either way the attempt is spent: a right answer after a mistake on the
// same card earns no star (no guessing your way to the prize).
export function applyRewardMistake(state) {
  if (state.rewardPolicy?.version !== 2) return { ...state, streakCount: state.strictStars ? 0 : (state.streakCount ?? 0) };
  state = { ...state, learningStreakCount: 0, rewardHadAnyError: true };
  if (!state.strictStars) return { ...state, rewardAttemptBlocked: true };
  if (state.rewardAttemptPenalized) return { ...state, rewardAttemptBlocked: true };
  const before = state.streakCount ?? 0;
  const after = state.rewardPolicy.lossMode === "all" ? 0 : Math.max(0, before - (state.answersPerStar ?? 1));
  return { ...state, streakCount: after, rewardAttemptBlocked: true, rewardAttemptPenalized: true,
    rewardChangeReason: "loss" };
}

export function rewardAttemptComplete(state) {
  return state.rewardPolicy?.version === 2
    ? { ...state, rewardAttemptBlocked: false, rewardAttemptPenalized: false, rewardAttemptCredited: false, rewardHadAnyError: false }
    : state;
}
