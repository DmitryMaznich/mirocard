import { describe, it, expect } from "vitest";
import { computeConceptLevel, computeProgressAfterSession } from "./useConceptProgress";

function makeSession(conceptIds, mistakeConceptIds, completedAt = new Date().toISOString()) {
  return {
    id: "s" + Math.random(),
    studentId: "student_1",
    topicId: "clothes",
    conceptIds,
    mistakes: mistakeConceptIds.map((cid) => ({ conceptId: cid, cardId: cid + "_1" })),
    completedAt,
    percentCorrect: 80,
  };
}

describe("computeConceptLevel", () => {
  it("counts agreement checks rather than supported teaching as mastery", () => {
    const session = { ...makeSession(["autumn"], []), topicId: "word_formation_soup", modeId: "season_form_pick", paramsSnapshot: { activityStage: "training" } };
    expect(computeConceptLevel([session], "student_1", "word_formation_soup", "autumn")).toBe(0);
    expect(computeConceptLevel([{ ...session, paramsSnapshot: { activityStage: "check" } }], "student_1", "word_formation_soup", "autumn")).toBe(1);
  });
  it("reports transfer separately from mastery on familiar material", () => {
    const session = { ...makeSession(["fish"], []), topicId: "word_formation_soup", modeId: "pick_form", paramsSnapshot: { materialSet: "transfer" } };
    expect(computeConceptLevel([session], "student_1", "word_formation_soup", "fish")).toBe(0);
  });
  it("does not count word formation models and prompted answers as mastery", () => {
    const session = { ...makeSession(["fish"], []), topicId: "word_formation_soup", modeId: "pair_intro" };
    const sessions = [session, { ...session, assessments: [{ conceptId: "fish", quality: "after_model" }] },
      { ...session, assessments: [{ conceptId: "fish", quality: "prompted" }] }];
    expect(computeConceptLevel(sessions, "student_1", "word_formation_soup", "fish")).toBe(0);
    sessions.push({ ...session, assessments: [{ conceptId: "fish", quality: "independent" }] });
    expect(computeConceptLevel(sessions, "student_1", "word_formation_soup", "fish")).toBe(1);
  });
  it("returns 0 when no sessions include the concept", () => {
    const sessions = [makeSession(["jacket"], [])];
    expect(computeConceptLevel(sessions, "student_1", "clothes", "tshirt")).toBe(0);
  });

  it("returns 1 when concept seen but has errors", () => {
    const sessions = [makeSession(["tshirt"], ["tshirt"])];
    expect(computeConceptLevel(sessions, "student_1", "clothes", "tshirt")).toBe(1);
  });

  it("returns 2 when no errors in 2 sessions", () => {
    const sessions = [
      makeSession(["tshirt"], []),
      makeSession(["tshirt"], []),
    ];
    expect(computeConceptLevel(sessions, "student_1", "clothes", "tshirt")).toBe(2);
  });

  it("returns 3 when no errors in last 3 consecutive sessions", () => {
    const now = Date.now();
    const sessions = [
      makeSession(["tshirt"], [], new Date(now - 3000).toISOString()),
      makeSession(["tshirt"], [], new Date(now - 2000).toISOString()),
      makeSession(["tshirt"], [], new Date(now - 1000).toISOString()),
    ];
    expect(computeConceptLevel(sessions, "student_1", "clothes", "tshirt")).toBe(3);
  });

  it("stays at 1 when majority of sessions have errors", () => {
    const sessions = [
      makeSession(["tshirt"], ["tshirt"]),
      makeSession(["tshirt"], ["tshirt"]),
      makeSession(["tshirt"], []),
    ];
    expect(computeConceptLevel(sessions, "student_1", "clothes", "tshirt")).toBe(1);
  });

  it("regresses from 3 to 2 when errors appear in 2 of last 3 sessions", () => {
    const now = Date.now();
    const sessions = [
      makeSession(["tshirt"], [], new Date(now - 5000).toISOString()),
      makeSession(["tshirt"], [], new Date(now - 4000).toISOString()),
      makeSession(["tshirt"], [], new Date(now - 3000).toISOString()),
      makeSession(["tshirt"], ["tshirt"], new Date(now - 2000).toISOString()),
      makeSession(["tshirt"], ["tshirt"], new Date(now - 1000).toISOString()),
      makeSession(["tshirt"], [],         new Date(now).toISOString()),
    ];
    expect(computeConceptLevel(sessions, "student_1", "clothes", "tshirt")).toBe(2);
  });
});

describe("computeProgressAfterSession", () => {
  it("returns a map of conceptId → level for all concepts in the session", () => {
    const completed = makeSession(["tshirt", "jacket"], ["tshirt"]);
    const allSessions = [completed];
    const result = computeProgressAfterSession(allSessions, completed);
    expect(result).toHaveProperty("tshirt");
    expect(result).toHaveProperty("jacket");
    expect(result["tshirt"]).toBe(1);
    expect(result["jacket"]).toBe(1);
  });
});
