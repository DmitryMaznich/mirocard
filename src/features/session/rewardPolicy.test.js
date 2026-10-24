import { describe, expect, it } from "vitest";
import { createSessionState, handleAnswer, handleAdvance, handleInstantCorrect, handleInstantIncorrect, handleInPlaceIncorrect, handleStreakReset } from "./sessionEngine.js";
import { normalizeRewardSettings, effectiveRewardSettings, rewardVideoSeconds } from "../../../shared/reward-policy.mjs";
import { createActiveSessionSnapshot, restoreActiveSessionState } from "./activeSession.js";

const tasks = Array.from({ length: 20 }, (_, i) => ({ type: "streak", cardId: String(i), conceptId: "c" }));
function start({ strict = true, loss = "one", perStar = 1, instant = false, legacy = false, progress = 3 } = {}) {
  return { ...createSessionState(tasks, { id: "m", type: "streak", evaluation: instant ? "instant" : "auto" }, "s", "t", "1", ["c"], null, false, perStar, strict,
    legacy ? undefined : { version: 2, lossMode: loss }), streakCount: progress };
}

describe("individual reward policy", () => {
  it("requires explicit opt-in and restores the entire legacy policy without forgetting new choices", () => {
    expect(effectiveRewardSettings()).toEqual({ algorithm: "legacy", duration: "120", animation: "normal", sound: false, strictStars: true, lossMode: "one" });
    const chosen = { algorithm: "legacy", duration: "180", animation: "soft", sound: true, strictStars: false, lossMode: "all" };
    expect(normalizeRewardSettings(chosen)).toEqual(chosen);
    expect(effectiveRewardSettings(chosen).duration).toBe("120");
    expect(effectiveRewardSettings({ ...chosen, algorithm: "flexible" }).duration).toBe("180");
    for (const duration of ["60", "120", "180", "end"]) expect(rewardVideoSeconds(effectiveRewardSettings({ algorithm: "flexible", duration }))).toBeLessThanOrEqual(180);
  });
  for (const perStar of [1, 2, 3]) for (const loss of ["one", "all"]) {
    it(`${loss}: one penalty per trial, grouped by ${perStar} answers per star`, () => {
      let state = start({ perStar, loss, progress: 3 * perStar + (perStar > 1 ? 1 : 0) });
      state = handleInPlaceIncorrect(state, "c", "0");
      const expected = loss === "all" ? 0 : 2 * perStar + (perStar > 1 ? 1 : 0);
      expect(state.streakCount).toBe(expected);
      state = handleInPlaceIncorrect(state, "c", "0");
      state = handleStreakReset(state, "c", "0");
      state = handleAnswer(state, false, "c", "0");
      expect(state.streakCount).toBe(expected);
      expect(state.incorrectCount).toBe(4);
      // Remount/retry of the same task must not re-enable the prize.
      expect(state.taskRetry).toBe(2);
      state = handleAnswer(state, true, "c", "0", { scoreCount: 3 });
      expect(state.streakCount).toBe(expected);
      expect(state.rewardEarnedCount).toBe(0);
      expect(state.correctCount).toBe(3);
      state = handleAdvance(state);
      state = handleAnswer(state, true, "c", "1");
      expect(state.streakCount).toBe(expected + 1);
    });
  }
  it("does not reward guessing even when the penalty hits the zero floor", () => {
    let state = start({ progress: 0 });
    state = handleAnswer(state, false);
    state = handleAnswer(state, true);
    expect(state.streakCount).toBe(0);
    state = handleAdvance(state);
    state = handleAnswer(state, true);
    expect(state.streakCount).toBe(1);
    expect(handleAnswer(state, true).streakCount).toBe(1);
  });
  it("soft mode records internal errors, while a final wrong answer always applies a penalty", () => {
    let state = handleInPlaceIncorrect(start({ strict: false }), "c", "0");
    expect(state.streakCount).toBe(3);
    expect(state.incorrectCount).toBe(1);
    expect(handleAnswer(state, true).streakCount).toBe(4);
    state = handleAnswer(start({ strict: false }), false);
    expect(state.streakCount).toBe(2);
    expect(handleAnswer(state, true).streakCount).toBe(2);
  });
  it("instant modes clear the trial only when moving to the next task", () => {
    let state = handleInPlaceIncorrect(start({ instant: true }));
    expect(state.streakCount).toBe(2);
    state = handleInstantCorrect(state);
    expect(state.streakCount).toBe(2);
    expect(state.taskIndex).toBe(1);
    expect(handleInstantCorrect(state).streakCount).toBe(3);
    state = handleInstantIncorrect(state);
    expect(state.streakCount).toBe(1);
    expect(handleInstantCorrect(state).streakCount).toBe(2);
  });
  it("marks prize exchange separately from a loss", () => {
    const state = handleAnswer(start({ progress: 4 }), true);
    expect(state.rewardEarnedCount).toBe(1);
    expect(state.streakCount).toBe(0);
    expect(state.rewardChangeReason).toBe("exchange");
  });
  it("keeps the previous strict and soft behavior available", () => {
    expect(handleAnswer(start({ legacy: true }), false).streakCount).toBe(0);
    let state = handleAnswer(start({ legacy: true, strict: false }), false);
    expect(state.streakCount).toBe(3);
    expect(handleAnswer(state, true).streakCount).toBe(4);
  });
  it("persists the blocked trial through recovery and refuses a snapshot after policy rollback", () => {
    const state = handleInPlaceIncorrect(start());
    const context = { studentId: "s", topicId: "t", modeId: "m", topicVersion: "1", rewardPolicy: state.rewardPolicy, strictStars: true };
    const snapshot = createActiveSessionSnapshot(context, state);
    const recovered = restoreActiveSessionState(snapshot, context);
    expect(handleAnswer(recovered, true).streakCount).toBe(2);
    expect(restoreActiveSessionState(snapshot, { ...context, rewardPolicy: undefined })).toBeNull();
    expect(restoreActiveSessionState(snapshot, { ...context, strictStars: false })).toBeNull();
    expect(restoreActiveSessionState(snapshot, { ...context, rewardPolicy: { version: 2, lossMode: "all" } })).toBeNull();
  });
});
