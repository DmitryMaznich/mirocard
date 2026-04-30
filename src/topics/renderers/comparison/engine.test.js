import { describe, it, expect } from "vitest";
import { generateComparisonTask, generateTasks } from "./engine";

const CARD_EASY   = { id: "compare_easy",   conceptId: "compare_easy",   primary: true, label: "Сравни", renderer: "comparison", params: { min: 1, max: 10, minDiff: 3, allowEqual: false } };
const CARD_MEDIUM = { id: "compare_medium", conceptId: "compare_medium", primary: true, label: "Сравни", renderer: "comparison", params: { min: 1, max: 10, minDiff: 1, allowEqual: false } };
const CARD_HARD   = { id: "compare_hard",   conceptId: "compare_hard",   primary: true, label: "Сравни", renderer: "comparison", params: { min: 1, max: 20, minDiff: 1, allowEqual: true  } };

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
  const MODE = { id: "compare_visual", type: "compare_visual", evaluation: "auto" };

  it("generates sessionSize tasks per card by default", () => {
    const cards = [CARD_EASY];
    const tasks = generateTasks(MODE.type, cards, {}, 15);
    expect(tasks).toHaveLength(15);
  });

  it("each task has type, left, right, conceptId", () => {
    const tasks = generateTasks("compare_numbers", [CARD_MEDIUM], {}, 5);
    expect(tasks[0]).toMatchObject({
      type: "compare_numbers",
      left: expect.any(Number),
      right: expect.any(Number),
      conceptId: "compare_medium",
    });
  });

  it("mixes cards proportionally when multiple cards provided", () => {
    const tasks = generateTasks("compare_sign", [CARD_EASY, CARD_MEDIUM], {}, 20);
    expect(tasks).toHaveLength(20);
    const easyCount   = tasks.filter((t) => t.conceptId === "compare_easy").length;
    const mediumCount = tasks.filter((t) => t.conceptId === "compare_medium").length;
    expect(easyCount).toBeGreaterThan(0);
    expect(mediumCount).toBeGreaterThan(0);
  });
});
