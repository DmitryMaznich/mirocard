import { describe, expect, it } from "vitest";
import { getFigureDifficultyRecommendation } from "./figureDifficultyProgress";

function session({
  difficulty = "starter",
  percentCorrect = 100,
  completedAt = "2026-08-16T10:00:00.000Z",
  studentId = "student-1",
  topicId = "symmetry_draw",
  modeId = "mirror_draw",
} = {}) {
  return {
    studentId,
    topicId,
    modeId,
    percentCorrect,
    completedAt,
    paramsSnapshot: { figureDifficulty: difficulty },
  };
}

const starterContext = {
  studentId: "student-1",
  topicId: "symmetry_draw",
  modeId: "mirror_draw",
  difficulty: "starter",
};

describe("getFigureDifficultyRecommendation", () => {
  it("recommends the next level after three recent successful sessions", () => {
    const sessions = [
      session({ completedAt: "2026-08-16T10:03:00.000Z" }),
      session({ percentCorrect: 80, completedAt: "2026-08-16T10:02:00.000Z" }),
      session({ completedAt: "2026-08-16T10:01:00.000Z" }),
    ];

    expect(getFigureDifficultyRecommendation(sessions, starterContext)).toEqual({
      nextDifficulty: "reinforce",
      successfulSessions: 3,
    });
  });

  it("does not recommend a level after a recent difficult attempt", () => {
    const sessions = [
      session({ completedAt: "2026-08-16T10:03:00.000Z" }),
      session({ percentCorrect: 60, completedAt: "2026-08-16T10:02:00.000Z" }),
      session({ completedAt: "2026-08-16T10:01:00.000Z" }),
    ];

    expect(getFigureDifficultyRecommendation(sessions, starterContext)).toBeNull();
  });

  it("keeps progress isolated to the same student, mode and level", () => {
    const sessions = [
      session({ completedAt: "2026-08-16T10:03:00.000Z" }),
      session({ completedAt: "2026-08-16T10:02:00.000Z", modeId: "repeat_draw" }),
      session({ completedAt: "2026-08-16T10:01:00.000Z", difficulty: "reinforce" }),
      session({ completedAt: "2026-08-16T10:00:00.000Z", studentId: "student-2" }),
    ];

    expect(getFigureDifficultyRecommendation(sessions, starterContext)).toBeNull();
  });

  it("offers challenge after reinforce but never after the final level", () => {
    const sessions = [
      session({ difficulty: "reinforce", completedAt: "2026-08-16T10:03:00.000Z" }),
      session({ difficulty: "reinforce", completedAt: "2026-08-16T10:02:00.000Z" }),
      session({ difficulty: "reinforce", completedAt: "2026-08-16T10:01:00.000Z" }),
    ];

    expect(getFigureDifficultyRecommendation(sessions, { ...starterContext, difficulty: "reinforce" })?.nextDifficulty)
      .toBe("challenge");
    expect(getFigureDifficultyRecommendation(sessions, { ...starterContext, difficulty: "challenge" })).toBeNull();
  });
});
