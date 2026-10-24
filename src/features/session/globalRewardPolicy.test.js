import { afterEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry.js";
import { buildGeneratedSessionState, resolveModeSelection } from "./useSessionEngine.js";
import { handleAnswer, handleStreakReset } from "./sessionEngine.js";

const original = useAppStore.getState();
afterEach(() => { vi.restoreAllMocks(); useAppStore.setState(original, true); });

it("uses one student's rules across topics and scoped modes despite conflicting saved lesson settings", () => {
  const student = { id: "s", rewardSettings: { algorithm: "flexible", strictStars: false, lossMode: "all", duration: "60" } };
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
      expect(state.strictStars).toBe(false);
      expect(state.rewardPolicy).toEqual({ version: 2, lossMode: "all" });
      const progress = { ...state, streakCount: 3 };
      expect(handleStreakReset(progress).streakCount).toBe(3);
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
  expect(state.strictStars).toBe(true);
  expect(handleStreakReset({ ...state, streakCount: 3 }).streakCount).toBe(2);
  expect(student.rewardSettings.strictStars).toBe(false);
});
