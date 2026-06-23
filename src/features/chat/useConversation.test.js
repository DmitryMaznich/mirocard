import { describe, it, expect } from "vitest";
import { resolveNextTurnIndex, applyChoice } from "./useConversation";

const turns = [
  {
    id: "t1",
    from: "contact",
    text: "Привет!",
    anyIsCorrect: true,
    choices: [{ text: "Привет!" }, { text: "Добрый день!" }],
    reactionOnSend: "Мама: Отлично!",
  },
  {
    id: "t2",
    from: "contact",
    text: "Ты хочешь кушать?",
    choices: [
      { text: "Да", correct: true, next: "t3" },
      { text: "Нет", correct: true, next: "t3" },
      { text: "Не знаю", correct: false },
    ],
    reactionOnCorrect: "Мама: Хорошо!",
    reactionOnWrong: null,
  },
  {
    id: "t3",
    from: "contact",
    text: "Жди меня.",
    anyIsCorrect: true,
    choices: [{ text: "Ок" }],
  },
];

const initialState = {
  turnIndex: 0,
  score: { correct: 0, total: 0 },
  disabledChoices: new Set(),
  showHint: false,
};

describe("resolveNextTurnIndex", () => {
  it("returns next index when no next specified", () => {
    expect(resolveNextTurnIndex(turns, 0, undefined)).toBe(1);
  });

  it("resolves next by id", () => {
    expect(resolveNextTurnIndex(turns, 1, "t3")).toBe(2);
  });

  it("falls back to linear when id not found", () => {
    expect(resolveNextTurnIndex(turns, 0, "nonexistent")).toBe(1);
  });
});

describe("applyChoice — anyIsCorrect turn", () => {
  it("counts as correct for any choice", () => {
    const state = applyChoice(initialState, { text: "Привет!" }, turns);
    expect(state.score).toEqual({ correct: 1, total: 1 });
    expect(state.turnIndex).toBe(1);
    expect(state.showHint).toBe(false);
    expect(state.disabledChoices.size).toBe(0);
    expect(state.isAdvancing).toBe(true);
  });

  it("advances even without explicit correct flag", () => {
    const state = applyChoice(initialState, { text: "Что угодно" }, turns);
    expect(state.score.correct).toBe(1);
    expect(state.isAdvancing).toBe(true);
  });

  it("sets pendingReaction from reactionOnSend", () => {
    const state = applyChoice(initialState, { text: "Привет!" }, turns);
    expect(state.pendingReaction).toBe("Мама: Отлично!");
  });
});

describe("applyChoice — correct/false turn", () => {
  const stateAtT2 = { ...initialState, turnIndex: 1 };

  it("correct choice advances and increments score", () => {
    const state = applyChoice(stateAtT2, { text: "Да", correct: true, next: "t3" }, turns);
    expect(state.score).toEqual({ correct: 1, total: 1 });
    expect(state.turnIndex).toBe(2);
    expect(state.isAdvancing).toBe(true);
  });

  it("wrong choice adds to disabledChoices and sets showHint", () => {
    const state = applyChoice(stateAtT2, { text: "Не знаю", correct: false }, turns);
    expect(state.score).toEqual({ correct: 0, total: 1 });
    expect(state.disabledChoices.has("Не знаю")).toBe(true);
    expect(state.showHint).toBe(true);
    expect(state.turnIndex).toBe(1);
    expect(state.isAdvancing).toBe(false);
  });

  it("correct after wrong clears hint and disabled choices", () => {
    const stateWithHint = {
      ...stateAtT2,
      disabledChoices: new Set(["Не знаю"]),
      showHint: true,
      score: { correct: 0, total: 1 },
    };
    const state = applyChoice(stateWithHint, { text: "Да", correct: true, next: "t3" }, turns);
    expect(state.showHint).toBe(false);
    expect(state.disabledChoices.size).toBe(0);
    expect(state.score).toEqual({ correct: 1, total: 2 });
  });

  it("sets pendingReaction from reactionOnCorrect", () => {
    const state = applyChoice(stateAtT2, { text: "Да", correct: true, next: "t3" }, turns);
    expect(state.pendingReaction).toBe("Мама: Хорошо!");
  });
});

describe("applyChoice — session completion", () => {
  it("marks isComplete when last turn is answered", () => {
    const stateAtLast = { ...initialState, turnIndex: 2 };
    const state = applyChoice(stateAtLast, { text: "Ок" }, turns);
    expect(state.isComplete).toBe(true);
  });

  it("does not mark isComplete on intermediate turns", () => {
    const state = applyChoice(initialState, { text: "Привет!" }, turns);
    expect(state.isComplete).toBeFalsy();
  });
});
