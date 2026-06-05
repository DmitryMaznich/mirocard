import { describe, it, expect } from "vitest";
import { createSessionState, handleAnswer, handleAdvance, handleInstantCorrect, handleInstantIncorrect, computeSessionRecord } from "./sessionEngine";

const TASKS = [
  { type: "yes_no", conceptId: "tshirt", card: { id: "t1" }, displayLabel: "футболка", isLabelCorrect: true },
  { type: "yes_no", conceptId: "jacket", card: { id: "j1" }, displayLabel: "куртка",   isLabelCorrect: true },
  { type: "yes_no", conceptId: "skirt",  card: { id: "s1" }, displayLabel: "юбка",     isLabelCorrect: true },
];

const MODE = { id: "yes_no", type: "yes_no", evaluation: "auto" };

describe("createSessionState", () => {
  it("creates initial state with task_active status", () => {
    const state = createSessionState(TASKS, MODE, "student_1", "clothes", "1.0.0", ["tshirt","jacket","skirt"]);
    expect(state.status).toBe("task_active");
    expect(state.taskIndex).toBe(0);
    expect(state.correctCount).toBe(0);
  });
});

describe("handleAnswer — auto evaluation", () => {
  it("correct answer sets status to answer_correct and increments correctCount", () => {
    const state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", ["tshirt","jacket","skirt"]);
    const next = handleAnswer(state, true);
    expect(next.status).toBe("answer_correct");
    expect(next.correctCount).toBe(1);
    expect(next.incorrectCount).toBe(0);
  });

  it("incorrect answer sets status to answer_incorrect and adds to mistakes", () => {
    const state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", ["tshirt","jacket","skirt"]);
    const next = handleAnswer(state, false, "tshirt", "t1");
    expect(next.status).toBe("answer_incorrect");
    expect(next.incorrectCount).toBe(1);
    expect(next.mistakes).toHaveLength(1);
    expect(next.mistakes[0].conceptId).toBe("tshirt");
  });

  it("advancing from last task sets status to completed", () => {
    let state = createSessionState([TASKS[0]], MODE, "s1", "t1", "1.0.0", ["tshirt"]);
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    expect(state.status).toBe("completed");
  });

  it("advancing from non-last task increments taskIndex", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", ["tshirt","jacket","skirt"]);
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    expect(state.taskIndex).toBe(1);
    expect(state.status).toBe("task_active");
  });
});

describe("handleAdvance — none evaluation (intro)", () => {
  const INTRO_MODE = { id: "intro", type: "intro", evaluation: "none" };
  const INTRO_TASKS = [
    { type: "intro", conceptId: "tshirt", card: { id: "t1" }, label: "футболка" },
    { type: "intro", conceptId: "jacket", card: { id: "j1" }, label: "куртка" },
  ];

  it("advances through tasks without tracking score", () => {
    let state = createSessionState(INTRO_TASKS, INTRO_MODE, "s1", "t1", "1.0.0", ["tshirt","jacket"]);
    state = handleAdvance(state);
    expect(state.taskIndex).toBe(1);
    expect(state.correctCount).toBe(0);
  });

  it("completes on last advance", () => {
    let state = createSessionState([INTRO_TASKS[0]], INTRO_MODE, "s1", "t1", "1.0.0", ["tshirt"]);
    state = handleAdvance(state);
    expect(state.status).toBe("completed");
  });
});

describe("handleAnswer — streak tracking", () => {
  const MODE = { id: "yes_no", type: "yes_no", evaluation: "auto" };
  const TASKS = Array.from({ length: 10 }, (_, i) => ({
    type: "yes_no", conceptId: `c${i}`, card: { id: `c${i}` },
  }));

  it("increments streakCount on correct answer", () => {
    const state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    const next = handleAnswer(state, true);
    expect(next.streakCount).toBe(1);
  });

  it("resets streakCount on incorrect answer", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    state = handleAnswer(state, true);
    state = handleAnswer(state, true);
    expect(state.streakCount).toBe(2);
    state = handleAnswer(state, false);
    expect(state.streakCount).toBe(0);
  });

  it("resets streakCount to 0 and increments rewardEarnedCount at streak 5", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    for (let i = 0; i < 4; i++) state = handleAnswer(state, true);
    expect(state.streakCount).toBe(4);
    expect(state.rewardEarnedCount).toBe(0);
    state = handleAnswer(state, true);
    expect(state.streakCount).toBe(0);
    expect(state.rewardEarnedCount).toBe(1);
  });

  it("can earn reward multiple times per session", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    for (let i = 0; i < 5; i++) state = handleAnswer(state, true);
    expect(state.rewardEarnedCount).toBe(1);
    for (let i = 0; i < 5; i++) state = handleAnswer(state, true);
    expect(state.rewardEarnedCount).toBe(2);
  });
});

describe("handleAdvance — deck_exhausted for deck modes", () => {
  const MODE = { id: "yes_no", type: "yes_no", evaluation: "auto" };
  const TASKS = [
    { type: "yes_no", conceptId: "c1", card: { id: "c1" } },
  ];

  it("returns deck_exhausted instead of completed when isDeckMode is true", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", ["c1"], null, true);
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    expect(state.status).toBe("deck_exhausted");
  });

  it("still returns completed when isDeckMode is false", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", ["c1"], null, false);
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    expect(state.status).toBe("completed");
  });
});

describe("handleInstantCorrect — streak without session completion", () => {
  const MODE = { id: "operation_observe", type: "operation_observe", evaluation: "instant" };
  const TASKS = Array.from({ length: 10 }, (_, i) => ({
    type: "operation_observe", conceptId: `c${i}`, card: { id: `c${i}` },
  }));

  it("increments streakCount", () => {
    const state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    const next = handleInstantCorrect(state);
    expect(next.streakCount).toBe(1);
    expect(next.status).toBe("task_active");
  });

  it("does NOT set status to completed at streak 5", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    for (let i = 0; i < 5; i++) state = handleInstantCorrect(state);
    expect(state.status).toBe("task_active");
    expect(state.streakCount).toBe(0);
    expect(state.rewardEarnedCount).toBe(1);
  });

  it("resets streakCount on incorrect", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    state = handleInstantCorrect(state);
    state = handleInstantCorrect(state);
    expect(state.streakCount).toBe(2);
    state = handleInstantIncorrect(state);
    expect(state.streakCount).toBe(0);
  });
});

describe("computeSessionRecord", () => {
  it("returns correct session record shape", () => {
    let state = createSessionState([TASKS[0]], MODE, "student_1", "clothes", "2.0.0", ["tshirt"]);
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    const rec = computeSessionRecord(state, "student_1", "clothes", "2.0.0");
    expect(rec.studentId).toBe("student_1");
    expect(rec.topicId).toBe("clothes");
    expect(rec.topicVersion).toBe("2.0.0");
    expect(rec.percentCorrect).toBe(100);
    expect(rec.mistakes).toHaveLength(0);
    expect(rec.startedAt).toBeTruthy();
    expect(rec.completedAt).toBeTruthy();
    expect(rec.id).toBeTruthy();
  });

  it("stores optional textId for reading sessions", () => {
    let state = createSessionState([TASKS[0]], MODE, "student_1", "reading", "1.0.0", ["dad_best"], "dad_best");
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    const rec = computeSessionRecord(state, "student_1", "reading", "1.0.0");
    expect(rec.textId).toBe("dad_best");
  });

  it("percentCorrect is null for evaluation: none", () => {
    const INTRO_MODE = { id: "intro", type: "intro", evaluation: "none" };
    let state = createSessionState(
      [{ type: "intro", conceptId: "tshirt", card: { id: "t1" }, label: "футболка" }],
      INTRO_MODE, "s1", "t1", "1.0.0", ["tshirt"]
    );
    state = handleAdvance(state);
    const rec = computeSessionRecord(state, "s1", "t1", "1.0.0");
    expect(rec.percentCorrect).toBeNull();
  });
});
