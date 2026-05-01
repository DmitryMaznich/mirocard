import { describe, it, expect } from "vitest";
import { generateComparisonTask, generateTasks } from "./engine";

const CARD_EASY   = { id: "compare_easy",   conceptId: "compare_easy",   primary: true, params: { min: 1, max: 10, minDiff: 3, allowEqual: false } };
const CARD_MEDIUM = { id: "compare_medium", conceptId: "compare_medium", primary: true, params: { min: 1, max: 10, minDiff: 1, allowEqual: false } };
const CARD_HARD   = { id: "compare_hard",   conceptId: "compare_hard",   primary: true, params: { min: 1, max: 20, minDiff: 1, allowEqual: true  } };

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

describe("generateComparisonTask", () => {
  it("returns left and right within [min, max]", () => {
    for (let i = 0; i < 50; i++) {
      const { left, right } = generateComparisonTask(CARD_EASY.params);
      expect(left).toBeGreaterThanOrEqual(1);
      expect(left).toBeLessThanOrEqual(10);
      expect(right).toBeGreaterThanOrEqual(1);
      expect(right).toBeLessThanOrEqual(10);
    }
  });

  it("respects minDiff when allowEqual is false", () => {
    for (let i = 0; i < 100; i++) {
      const { left, right } = generateComparisonTask(CARD_EASY.params);
      expect(Math.abs(left - right)).toBeGreaterThanOrEqual(3);
    }
  });

  it("never produces equal values when allowEqual is false", () => {
    for (let i = 0; i < 100; i++) {
      const { left, right } = generateComparisonTask(CARD_MEDIUM.params);
      expect(left).not.toBe(right);
    }
  });

  it("sometimes produces equal values when allowEqual is true", () => {
    let seenEqual = false;
    for (let i = 0; i < 200; i++) {
      const { left, right } = generateComparisonTask(CARD_HARD.params);
      if (left === right) { seenEqual = true; break; }
    }
    expect(seenEqual).toBe(true);
  });
});

describe("generateTasks", () => {
  it("returns requested count of tasks", () => {
    expect(generateTasks(MODE_VISUAL, ALL_CARDS, 20)).toHaveLength(20);
  });

  it("uses defaultCardId to select card — easy mode enforces minDiff >= 3", () => {
    for (let i = 0; i < 5; i++) {
      const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 20);
      tasks.forEach(({ left, right }) => {
        expect(Math.abs(left - right)).toBeGreaterThanOrEqual(3);
      });
    }
  });

  it("each task has type from mode.type", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 5);
    tasks.forEach((task) => {
      expect(task).toMatchObject({
        type: "compare_numbers",
        left: expect.any(Number),
        right: expect.any(Number),
        conceptId: "compare_medium",
      });
    });
  });

  it("hard mode allows equal values", () => {
    let seenEqual = false;
    for (let i = 0; i < 10; i++) {
      const tasks = generateTasks(MODE_EQUAL, ALL_CARDS, 20);
      if (tasks.some(({ left, right }) => left === right)) { seenEqual = true; break; }
    }
    expect(seenEqual).toBe(true);
  });

  it("falls back to cards[0] when defaultCardId is not found", () => {
    const orphanMode = { ...MODE_VISUAL, defaultCardId: "nonexistent" };
    const tasks = generateTasks(orphanMode, [CARD_EASY], 10);
    expect(tasks).toHaveLength(10);
    tasks.forEach(({ conceptId }) => expect(conceptId).toBe("compare_easy"));
  });
});
