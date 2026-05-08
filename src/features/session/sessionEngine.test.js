import { describe, it, expect } from "vitest";
import { createSessionState, handleAnswer, handleAdvance, computeSessionRecord } from "./sessionEngine";

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
