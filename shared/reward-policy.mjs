export const DEFAULT_REWARD_SETTINGS = Object.freeze({
  algorithm: "legacy", duration: "120", animation: "normal", sound: false,
});

// This module is shared by storage and the app. Unknown/old records keep the
// original behavior; opting out retains the saved experimental choices.
export function normalizeRewardSettings(raw) {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    algorithm: value.algorithm === "flexible" ? "flexible" : "legacy",
    duration: ["60", "120", "180", "end"].includes(String(value.duration)) ? String(value.duration) : "120",
    animation: value.animation === "soft" ? "soft" : "normal",
    sound: value.sound === true,
  };
}

export function effectiveRewardSettings(raw) {
  const settings = normalizeRewardSettings(raw);
  return settings.algorithm === "flexible" ? settings : { ...DEFAULT_REWARD_SETTINGS };
}

export function rewardVideoSeconds(settings) {
  return settings.duration === "end" ? 180 : Number(settings.duration);
}

export function rewardPolicy(settings, lossMode) {
  return { version: settings.algorithm === "flexible" ? 2 : 1, lossMode: lossMode === "all" ? "all" : "one" };
}

export function applyRewardMistake(state, intermediate = false) {
  if (state.rewardPolicy?.version !== 2) return { ...state, streakCount: state.strictStars ? 0 : (state.streakCount ?? 0) };
  state = { ...state, learningStreakCount: 0, rewardHadAnyError: true };
  if (intermediate && !state.strictStars) return state;
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
