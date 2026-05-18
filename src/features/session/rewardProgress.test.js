import { describe, expect, it } from "vitest";
import {
  buildRewardProgress,
  getCompletedTaskCount,
  getRewardTargetCount,
  normalizeRewardThreshold,
} from "./rewardProgress";

const MODE = { id: "yes_no", evaluation: "auto" };
const TASKS = Array.from({ length: 10 }, (_, index) => ({ id: `task_${index}` }));

function makeState(patch = {}) {
  return {
    status: "task_active",
    tasks: TASKS,
    taskIndex: 0,
    ...patch,
  };
}

describe("reward progress", () => {
  it("normalizes the configured video threshold", () => {
    expect(normalizeRewardThreshold(80)).toBe(80);
    expect(normalizeRewardThreshold("70")).toBe(70);
    expect(normalizeRewardThreshold(150)).toBe(100);
    expect(normalizeRewardThreshold("bad")).toBe(90);
  });

  it("turns the threshold into a task target", () => {
    expect(getRewardTargetCount(10, 80)).toBe(8);
    expect(getRewardTargetCount(5, 90)).toBe(5);
    expect(getRewardTargetCount(3, 70)).toBe(3);
  });

  it("counts a correct feedback task as completed", () => {
    expect(getCompletedTaskCount(makeState({ taskIndex: 3 }))).toBe(3);
    expect(getCompletedTaskCount(makeState({ taskIndex: 3, status: "answer_correct" }))).toBe(4);
    expect(getCompletedTaskCount(makeState({ status: "completed" }))).toBe(10);
  });

  it("marks the reward earned after the configured threshold is reached", () => {
    const progress = buildRewardProgress({
      sessionState: makeState({ taskIndex: 7, status: "answer_correct" }),
      mode: MODE,
      videoRewardEnabled: true,
      hasRewardVideos: true,
      rewardThreshold: 80,
    });

    expect(progress.available).toBe(true);
    expect(progress.target).toBe(8);
    expect(progress.completed).toBe(8);
    expect(progress.earned).toBe(true);
  });

  it("uses correctCount (not total) when session is completed and child failed threshold", () => {
    const progress = buildRewardProgress({
      sessionState: {
        status: "completed",
        tasks: TASKS,
        taskIndex: 9,
        correctCount: 6,
      },
      mode: MODE,
      videoRewardEnabled: true,
      hasRewardVideos: true,
      rewardThreshold: 80,
    });
    expect(progress.completed).toBe(6);
    expect(progress.target).toBe(8);
    expect(progress.earned).toBe(false);
  });

  it("marks reward earned when correctCount meets threshold on completion", () => {
    const progress = buildRewardProgress({
      sessionState: {
        status: "completed",
        tasks: TASKS,
        taskIndex: 9,
        correctCount: 9,
      },
      mode: MODE,
      videoRewardEnabled: true,
      hasRewardVideos: true,
      rewardThreshold: 80,
    });
    expect(progress.completed).toBe(9);
    expect(progress.earned).toBe(true);
  });

  it("does not expose reward progress when videos are unavailable", () => {
    const progress = buildRewardProgress({
      sessionState: makeState({ taskIndex: 8 }),
      mode: MODE,
      videoRewardEnabled: true,
      hasRewardVideos: false,
      rewardThreshold: 80,
    });

    expect(progress.available).toBe(false);
    expect(progress.earned).toBe(false);
    expect(progress.target).toBeNull();
  });
});
