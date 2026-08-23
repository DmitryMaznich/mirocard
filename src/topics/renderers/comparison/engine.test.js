import { describe, it, expect } from "vitest";
import { generateComparisonTask, generateTasks, getVerdict } from "./engine";

// generateComparisonTask() takes a raw params object directly — unrelated to
// the "cards" shape below (cards no longer carry their own min/max/minDiff,
// see note further down).
const EASY_PARAMS   = { min: 1, max: 10, minDiff: 3, allowEqual: false };
const MEDIUM_PARAMS = { min: 1, max: 10, minDiff: 1, allowEqual: false };
const HARD_PARAMS   = { min: 1, max: 20, minDiff: 1, allowEqual: true  };

// Real cards only carry id/conceptId/label — the number range is driven
// solely by sessionParams.level (COMPARISON_LEVELS), not by a per-card
// params object. A card only ever affects which conceptId a task is tagged
// with (used for per-concept progress tracking).
const CARD_EASY   = { id: "compare_easy",   conceptId: "compare_easy",   primary: true };
const CARD_MEDIUM = { id: "compare_medium", conceptId: "compare_medium", primary: true };
const CARD_HARD   = { id: "compare_hard",   conceptId: "compare_hard",   primary: true };

const ALL_CARDS = [CARD_EASY, CARD_MEDIUM, CARD_HARD];

const MODE_VISUAL = {
  id: "compare_visual", type: "compare_visual", evaluation: "auto",
  defaultCardId: "compare_easy",
  ui: { title: "1. Где больше?", instruction: "Нажми на сторону где больше кружков" },
};
const MODE_NUMBERS = {
  id: "compare_numbers", type: "compare_numbers", evaluation: "auto",
  defaultCardId: "compare_medium",
  ui: { title: "3. Какое больше?", instruction: "Нажми на большее число" },
};
const MODE_EQUAL = {
  id: "compare_equal", type: "compare_equal", evaluation: "auto",
  defaultCardId: "compare_hard",
  ui: { title: "5. Больше, меньше или равно?", instruction: "Нажми на большее или на =" },
};
const MODE_FIRST = {
  id: "compare_first_number", type: "compare_first_number", evaluation: "auto",
  defaultCardId: "compare_medium",
  ui: { title: "Первое число", instruction: "Посмотри на первое число" },
};

describe("generateComparisonTask", () => {
  it("returns left and right within [min, max]", () => {
    for (let i = 0; i < 50; i++) {
      const { left, right } = generateComparisonTask(EASY_PARAMS);
      expect(left).toBeGreaterThanOrEqual(1);
      expect(left).toBeLessThanOrEqual(10);
      expect(right).toBeGreaterThanOrEqual(1);
      expect(right).toBeLessThanOrEqual(10);
    }
  });

  it("respects minDiff when allowEqual is false", () => {
    for (let i = 0; i < 100; i++) {
      const { left, right } = generateComparisonTask(EASY_PARAMS);
      expect(Math.abs(left - right)).toBeGreaterThanOrEqual(3);
    }
  });

  it("never produces equal values when allowEqual is false", () => {
    for (let i = 0; i < 100; i++) {
      const { left, right } = generateComparisonTask(MEDIUM_PARAMS);
      expect(left).not.toBe(right);
    }
  });

  it("sometimes produces equal values when allowEqual is true", () => {
    let seenEqual = false;
    for (let i = 0; i < 200; i++) {
      const { left, right } = generateComparisonTask(HARD_PARAMS);
      if (left === right) { seenEqual = true; break; }
    }
    expect(seenEqual).toBe(true);
  });
});

describe("generateTasks", () => {
  it("returns requested count of tasks", () => {
    expect(generateTasks(MODE_VISUAL, ALL_CARDS, 20)).toHaveLength(20);
  });

  it("defaults to level 2 (1-10, minDiff 1) when no level is given", () => {
    for (let i = 0; i < 5; i++) {
      const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 20);
      tasks.forEach(({ left, right }) => {
        expect(left).toBeGreaterThanOrEqual(1);
        expect(left).toBeLessThanOrEqual(10);
        expect(right).toBeGreaterThanOrEqual(1);
        expect(right).toBeLessThanOrEqual(10);
      });
    }
  });

  it("level (not the card) controls the numeric range — level 4 reaches two-digit numbers", () => {
    const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 30, { level: 4 });
    tasks.forEach(({ left, right }) => {
      expect(left).toBeGreaterThanOrEqual(10);
      expect(left).toBeLessThanOrEqual(99);
      expect(right).toBeGreaterThanOrEqual(10);
      expect(right).toBeLessThanOrEqual(99);
    });
  });

  it("level 1 enforces minDiff >= 5 regardless of which card is selected", () => {
    const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 30, { level: 1, cardId: "compare_hard" });
    tasks.forEach(({ left, right }) => {
      expect(Math.abs(left - right)).toBeGreaterThanOrEqual(5);
    });
  });

  it("each task has type, left, right, conceptId, question fields", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 5);
    tasks.forEach((task) => {
      expect(task).toMatchObject({
        type:      "compare_numbers",
        left:      expect.any(Number),
        right:     expect.any(Number),
        conceptId: "compare_medium",
        question:  expect.stringMatching(/^(more|less|equal)$/),
      });
    });
  });

  it("default question is 'more' — all non-equal tasks have question='more'", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 20);
    tasks.forEach(({ left, right, question }) => {
      if (left !== right) expect(question).toBe("more");
    });
  });

  it("question='less' sets all non-equal tasks to 'less'", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 20, { question: "less" });
    tasks.forEach(({ left, right, question }) => {
      if (left !== right) expect(question).toBe("less");
    });
  });

  it("question='mix' produces both 'more' and 'less' tasks", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 40, { question: "mix" });
    const nonEqual = tasks.filter(({ left, right }) => left !== right);
    const questions = new Set(nonEqual.map((t) => t.question));
    expect(questions.has("more")).toBe(true);
    expect(questions.has("less")).toBe(true);
  });

  it("showEqual generates ~30% equal tasks", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 20, { showEqual: true });
    const equalCount = tasks.filter(({ left, right }) => left === right).length;
    expect(equalCount).toBe(6); // Math.round(20 * 0.3) = 6
  });

  it("equal tasks always get question='equal'", () => {
    const tasks = generateTasks(MODE_EQUAL, ALL_CARDS, 20, { showEqual: true });
    tasks.forEach(({ left, right, question }) => {
      if (left === right) expect(question).toBe("equal");
    });
  });

  it("showEqual=false never produces equal tasks even for hard card", () => {
    for (let i = 0; i < 5; i++) {
      const tasks = generateTasks(MODE_EQUAL, ALL_CARDS, 20, { showEqual: false });
      tasks.forEach(({ left, right }) => expect(left).not.toBe(right));
    }
  });

  it("cardId override only changes which conceptId tasks are tagged with, not the number range", () => {
    const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 20, { cardId: "compare_hard" });
    tasks.forEach(({ left, right, conceptId }) => {
      expect(conceptId).toBe("compare_hard");
      // range still comes from the default level (2: 1-10), the hard card
      // does not widen it — number ranges are level-driven, not card-driven.
      expect(left).toBeLessThanOrEqual(10);
      expect(right).toBeLessThanOrEqual(10);
    });
  });

  it("falls back to cards[0] when defaultCardId is not found", () => {
    const orphanMode = { ...MODE_VISUAL, defaultCardId: "nonexistent" };
    const tasks = generateTasks(orphanMode, [CARD_EASY], 10);
    expect(tasks).toHaveLength(10);
    tasks.forEach(({ conceptId }) => expect(conceptId).toBe("compare_easy"));
  });

  it("compare_first_number derives question from the first number relation", () => {
    const tasks = generateTasks(MODE_FIRST, ALL_CARDS, 40, { showEqual: true });
    tasks.forEach(({ left, right, question, instruction, type }) => {
      expect(type).toBe("compare_first_number");
      expect(instruction).toMatch(/первое число/i);
      if (left === right) expect(question).toBe("equal");
      if (left < right) expect(question).toBe("less");
      if (left > right) expect(question).toBe("more");
    });
  });
});

describe("getVerdict", () => {
  it("returns 'больше' verdict for question='more'", () => {
    expect(getVerdict({ left: 7, right: 4, question: "more" })).toBe("7 больше 4");
  });

  it("returns 'меньше' verdict for question='less'", () => {
    expect(getVerdict({ left: 7, right: 4, question: "less" })).toBe("4 меньше 7");
  });

  it("returns '=' verdict for question='equal'", () => {
    expect(getVerdict({ left: 5, right: 5, question: "equal" })).toBe("5 = 5");
  });

  it("returns '=' verdict when left === right regardless of question", () => {
    expect(getVerdict({ left: 3, right: 3, question: "more" })).toBe("3 = 3");
  });

  it("returns first-number verdict for compare_first_number tasks", () => {
    expect(getVerdict({ type: "compare_first_number", left: 7, right: 9, question: "less" })).toBe("7 меньше 9");
    expect(getVerdict({ type: "compare_first_number", left: 7, right: 5, question: "more" })).toBe("7 больше 5");
  });
});
