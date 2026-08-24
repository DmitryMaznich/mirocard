import { describe, it, expect } from "vitest";
import { createSessionState, handleAnswer, handleAdvance, handleInstantCorrect, handleInstantIncorrect, handleInPlaceIncorrect, computeSessionRecord } from "./sessionEngine";

const TASKS = [
  { type: "yes_no", conceptId: "tshirt", card: { id: "t1" }, displayLabel: "футболка", isLabelCorrect: true },
  { type: "yes_no", conceptId: "jacket", card: { id: "j1" }, displayLabel: "куртка",   isLabelCorrect: true },
  { type: "yes_no", conceptId: "skirt",  card: { id: "s1" }, displayLabel: "юбка",     isLabelCorrect: true },
];

// 15 evaluable tasks — needed for answersPerStar=2 (needs ≥10) and answersPerStar=3 (needs ≥15)
const TASKS_15 = Array.from({ length: 15 }, (_, i) => ({
  type: "yes_no", conceptId: `c${i}`, card: { id: `c${i}` }, displayLabel: `слово${i}`, isLabelCorrect: true,
}));

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

  it("returns to the first card for a looping mode", () => {
    const loopingMode = { ...INTRO_MODE, loop: true };
    let state = createSessionState([INTRO_TASKS[0]], loopingMode, "s1", "t1", "1.0.0", ["tshirt"]);
    state = handleAdvance(state);
    expect(state.status).toBe("task_active");
    expect(state.taskIndex).toBe(0);
  });

  it("reshuffles a mixed looping round without repeating its closing relation first", () => {
    const tasks = [
      { type: "spatial_mixed", card: { id: "in-1", relation: "in" } },
      { type: "spatial_mixed", card: { id: "on-1", relation: "on" } },
      { type: "spatial_mixed", card: { id: "under-1", relation: "under" } },
    ];
    const mixedMode = { ...INTRO_MODE, loop: true, reshuffleOnLoop: true };
    let state = createSessionState(tasks, mixedMode, "s1", "t1", "1.0.0", []);
    state.taskIndex = tasks.length - 1;
    state = handleAdvance(state);
    expect(state.status).toBe("task_active");
    expect(state.taskIndex).toBe(0);
    expect(state.tasks.map((task) => task.card.id).sort()).toEqual(tasks.map((task) => task.card.id).sort());
    expect(state.tasks[0].card.relation).not.toBe("under");
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

  it("answersPerStar is capped when task count < 5 × answersPerStar", () => {
    const mk = (n) => Array.from({ length: n }, (_, i) => ({ type: "yes_no", conceptId: `c${i}`, card: { id: `c${i}` } }));
    // 8 tasks + ×2 → Math.floor(8/5)=1 → cap to 1
    expect(createSessionState(mk(8), MODE, "s1", "t1", "1.0.0", [], null, false, 2).answersPerStar).toBe(1);
    // 8 tasks + ×3 → same cap
    expect(createSessionState(mk(8), MODE, "s1", "t1", "1.0.0", [], null, false, 3).answersPerStar).toBe(1);
    // 10 tasks + ×2 → Math.floor(10/5)=2 → stays 2
    expect(createSessionState(mk(10), MODE, "s1", "t1", "1.0.0", [], null, false, 2).answersPerStar).toBe(2);
    // 10 tasks + ×3 → Math.floor(10/5)=2 → cap to 2
    expect(createSessionState(mk(10), MODE, "s1", "t1", "1.0.0", [], null, false, 3).answersPerStar).toBe(2);
    // 15 tasks + ×3 → Math.floor(15/5)=3 → stays 3
    expect(createSessionState(mk(15), MODE, "s1", "t1", "1.0.0", [], null, false, 3).answersPerStar).toBe(3);
  });

  it("answersPerStar=2: earns reward at streak 10, not at 5", () => {
    let state = createSessionState(TASKS_15, MODE, "s1", "t1", "1.0.0", [], null, false, 2);
    expect(state.answersPerStar).toBe(2);
    for (let i = 0; i < 5; i++) state = handleAnswer(state, true);
    expect(state.streakCount).toBe(5);
    expect(state.rewardEarnedCount).toBe(0);
    for (let i = 0; i < 5; i++) state = handleAnswer(state, true);
    expect(state.streakCount).toBe(0);
    expect(state.rewardEarnedCount).toBe(1);
  });

  it("answersPerStar=3: earns reward at streak 15", () => {
    let state = createSessionState(TASKS_15, MODE, "s1", "t1", "1.0.0", [], null, false, 3);
    expect(state.answersPerStar).toBe(3);
    for (let i = 0; i < 14; i++) state = handleAnswer(state, true);
    expect(state.rewardEarnedCount).toBe(0);
    state = handleAnswer(state, true);
    expect(state.streakCount).toBe(0);
    expect(state.rewardEarnedCount).toBe(1);
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
    expect(state.bestStreak).toBe(5);
  });

  it("resets streakCount on incorrect", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    state = handleInstantCorrect(state);
    state = handleInstantCorrect(state);
    expect(state.streakCount).toBe(2);
    state = handleInstantIncorrect(state);
    expect(state.streakCount).toBe(0);
  });

  it("retries in place and resets the strict reward series", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", []);
    state = handleInstantCorrect(state);
    state = handleInstantCorrect(state);
    const next = handleInPlaceIncorrect(state, "c2", "c2");
    expect(next.taskIndex).toBe(state.taskIndex);
    expect(next.taskRetry).toBe(1);
    expect(next.streakCount).toBe(0);
    expect(next.mistakes).toEqual([{ conceptId: "c2", cardId: "c2" }]);
  });

  it("keeps the reward series on an in-place error when strict stars are disabled", () => {
    let state = createSessionState(TASKS, MODE, "s1", "t1", "1.0.0", [], null, false, 1, false);
    state = handleInstantCorrect(state);
    const next = handleInPlaceIncorrect(state);
    expect(next.streakCount).toBe(1);
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

  it("preserves analytics telemetry as a snapshot of the completed session", () => {
    let state = createSessionState([TASKS[0]], MODE, "s1", "t1", "1.0.0", ["tshirt"]);
    state = handleAnswer(state, true);
    state = handleAdvance(state);
    const rec = computeSessionRecord(state, "s1", "t1", "1.0.0", [], {
      activeDurationMs: 42_000,
      elapsedDurationMs: 57_000,
      paramsSnapshot: { level: 2, distractors: 3 },
      entryPoint: "student_portal",
    });
    expect(rec.activeDurationMs).toBe(42_000);
    expect(rec.elapsedDurationMs).toBe(57_000);
    expect(rec.paramsSnapshot).toEqual({ level: 2, distractors: 3 });
    expect(rec.entryPoint).toBe("student_portal");
  });
});
