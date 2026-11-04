import { afterEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry.js";
import { buildGeneratedSessionState, resolveModeSelection } from "./useSessionEngine.js";
import { handleAnswer, handleStreakReset } from "./sessionEngine.js";

const original = useAppStore.getState();
afterEach(() => { vi.restoreAllMocks(); useAppStore.setState(original, true); });

// «Строгий подсчёт» is set per topic before the lesson (the «Видеоприз» plate, owner 2026-11-04: «как и
// было») — link.strictStars wins; what a mistake burns and the duration stay the student's rules.
it.each([undefined, "legacy", "flexible"])("uses the lesson's strict counting and the student's loss and duration (saved algorithm %s)", algorithm => {
  const student = { id: "s", rewardSettings: { algorithm, strictStars: false, lossMode: "all", duration: "60" } };
  useAppStore.setState({ activeStudentId: "s", students: [student] });
  for (const renderer of ["streak_tracker", "comparison", "reading", "place_value", "sentence_puzzle"]) {
    vi.spyOn(ENGINE_REGISTRY, renderer).mockReturnValue(Array.from({ length: 20 }, (_, i) => ({ type: "streak", cardId: String(i), conceptId: "c" })));
    for (const id of ["first", "second"]) {
      const topic = { meta: { id: renderer, renderer, version: "1" }, cards: [{ id: "c", conceptId: "c", primary: true }] };
      const mode = { id, type: "streak", evaluation: "auto", paramsScope: "mode", rewardDefaults: { forceStrictStars: true } };
      const link = { strictStars: true, params: { byMode: { [id]: { rewardLossMode: "one" } } } };
      const selection = resolveModeSelection(topic, mode, link, renderer === "reading", "text");
      expect(selection.sessionParams.rewardLossMode).toBe("all");
      // Renderers forward all errors, while the central engine applies strictness.
      expect(selection.sessionParams.strictStars).toBe(true);
      const state = buildGeneratedSessionState({ topicRecord: topic, mode, activeStudentId: "s", activeTopicId: renderer, activeTextId: "text", activeStudent: student, link, ...selection });
      expect(state.strictStars).toBe(true);
      expect(state.rewardPolicy).toEqual({ version: 2, lossMode: "all" });
      const progress = { ...state, streakCount: 3 };
      expect(handleStreakReset(progress).streakCount).toBe(0);
      expect(handleAnswer(progress, false).streakCount).toBe(0);
      expect(state.rewardSettings.duration).toBe("60");
    }
  }
  // Another student keeps their own choices; a running session is a snapshot.
  const other = { id: "other", rewardSettings: { algorithm: "flexible", strictStars: true, lossMode: "one" } };
  useAppStore.setState({ activeStudentId: "other", students: [student, other] });
  const topic = { meta: { id: "streak_tracker", renderer: "streak_tracker", version: "1" }, cards: [] };
  const mode = { id: "m", type: "streak", evaluation: "auto" };
  const selection = resolveModeSelection(topic, mode, { strictStars: false, params: { rewardLossMode: "all" } }, false);
  const state = buildGeneratedSessionState({ topicRecord: topic, mode, activeStudentId: "other", activeTopicId: topic.meta.id, activeStudent: other, link: { strictStars: false }, ...selection });
  expect(state.strictStars).toBe(false);
  expect(handleStreakReset({ ...state, streakCount: 3 }).streakCount).toBe(3);
  // a topic where strict counting was never set takes the student's rule
  const unset = buildGeneratedSessionState({ topicRecord: topic, mode, activeStudentId: "other", activeTopicId: topic.meta.id, activeStudent: other, link: {}, ...selection });
  expect(unset.strictStars).toBe(true);
  expect(handleStreakReset({ ...unset, streakCount: 3 }).streakCount).toBe(2);
  expect(student.rewardSettings.strictStars).toBe(false);
});

it("uses the current default policy when the selected student has no settings", () => {
  useAppStore.setState({ activeStudentId: "missing", students: [] });
  const selection = resolveModeSelection({ meta: { id: "streak_tracker" } }, { id: "m" }, { params: {}, strictStars: false }, false);
  expect(selection.sessionParams).toMatchObject({ strictStars: true, rewardPolicyVersion: 2, rewardLossMode: "one" });
});
