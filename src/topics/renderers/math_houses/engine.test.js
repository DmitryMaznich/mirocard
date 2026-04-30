import { describe, it, expect } from "vitest";
import { generatePairs, generateTasks } from "./engine";

describe("generatePairs", () => {
  it("generates all pairs summing to N", () => {
    const pairs = generatePairs(5);
    expect(pairs).toHaveLength(6);
    expect(pairs.every(([a, b]) => a + b === 5)).toBe(true);
  });

  it("includes (0,N) and (N,0)", () => {
    const pairs = generatePairs(3);
    expect(pairs[0]).toEqual([0, 3]);
    expect(pairs[pairs.length - 1]).toEqual([3, 0]);
  });
});

describe("generateTasks for math_houses", () => {
  const CARDS = [
    { id: "house_5", conceptId: "house_5", primary: true, label: "Число 5",
      renderer: "math_houses", params: { number: 5 } }
  ];
  const MODE = { id: "math_houses", type: "math_houses", evaluation: "auto" };

  it("generates the requested number of tasks", () => {
    const tasks = generateTasks(MODE.type, CARDS, {}, 10);
    expect(tasks).toHaveLength(10);
  });

  it("each task has number, pairs, hiddenIndex, hiddenSide, answer", () => {
    const tasks = generateTasks(MODE.type, CARDS, {}, 5);
    const t = tasks[0];
    expect(t.number).toBe(5);
    expect(Array.isArray(t.pairs)).toBe(true);
    expect(t.hiddenPairIndex).toBeGreaterThanOrEqual(0);
    expect(t.hiddenSide).toMatch(/^left|right$/);
    expect(typeof t.answer).toBe("number");
    expect(t.answer + t.knownValue).toBe(5);
  });

  it("read mode generates display tasks (no hidden cell)", () => {
    const tasks = generateTasks("math_houses_read", CARDS, {}, 3);
    expect(tasks[0].type).toBe("math_houses_read");
    expect(tasks[0].hiddenSide).toBeUndefined();
  });
});
