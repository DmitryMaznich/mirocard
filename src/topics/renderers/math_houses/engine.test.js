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
  const SELECTIVE_MODE = { id: "math_houses_selective", type: "math_houses_selective", evaluation: "auto" };

  it("selective fill mode generates the requested number of tasks", () => {
    const tasks = generateTasks(SELECTIVE_MODE.type, CARDS, {}, 10);
    expect(tasks).toHaveLength(10);
  });

  it("selective fill task has number, pairs, hiddenIndex, hiddenSide, answer", () => {
    const tasks = generateTasks(SELECTIVE_MODE.type, CARDS, {}, 5);
    const t = tasks[0];
    expect(t.type).toBe("math_houses_selective");
    expect(t.number).toBe(5);
    expect(Array.isArray(t.pairs)).toBe(true);
    expect(t.hiddenPairIndex).toBeGreaterThanOrEqual(0);
    expect(t.hiddenSide).toMatch(/^left|right$/);
    expect(typeof t.answer).toBe("number");
    expect(t.answer + t.knownValue).toBe(5);
  });

  it("supports hiding several windows at once", () => {
    const tasks = generateTasks(SELECTIVE_MODE.type, CARDS, 5, { hiddenWindows: 3 });
    expect(tasks[0].hiddenCells).toHaveLength(3);
    expect(new Set(tasks[0].hiddenCells.map((cell) => cell.key)).size).toBe(3);
    expect(new Set(tasks[0].hiddenCells.map((cell) => cell.pairIndex)).size).toBe(3);
  });

  it("supports shuffled pair order for selective mode", () => {
    const originalRandom = Math.random;
    let index = 0;
    const sequence = [0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4, 0.5];
    Math.random = () => sequence[index++ % sequence.length];
    const tasks = generateTasks(SELECTIVE_MODE.type, CARDS, 1, { shufflePairs: true });
    Math.random = originalRandom;
    expect(tasks[0].pairs).not.toEqual([[0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0]]);
  });

  it("legacy fill mode generates one full house per card", () => {
    const tasks = generateTasks("math_houses", CARDS, {}, 10);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("math_houses");
    expect(tasks[0].hiddenSide).toBeUndefined();
  });

  it("read mode generates a full house task (no hidden cell)", () => {
    const tasks = generateTasks("math_houses_read", CARDS, {}, 3);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("math_houses_read");
    expect(tasks[0].hiddenSide).toBeUndefined();
  });

  it("recall mode generates a full house task", () => {
    const tasks = generateTasks("math_houses_recall", CARDS, {}, 3);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("math_houses_recall");
    expect(tasks[0].pairs).toEqual([[0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0]]);
  });

  it("accepts a mode object from the session engine", () => {
    const tasks = generateTasks({ id: "math_houses_read", type: "math_houses_read" }, CARDS, 1, {});
    expect(tasks[0].type).toBe("math_houses_read");
  });

  it("grow mode keeps all pairs visible for recall", () => {
    const tasks = generateTasks("math_houses_grow", CARDS, {}, 1);
    expect(tasks[0].type).toBe("math_houses_grow");
    expect(tasks[0].pairs).toEqual([[0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0]]);
    expect(tasks[0].hiddenSide).toBeUndefined();
  });

  it("supports v1 total param name", () => {
    const cards = [{ ...CARDS[0], params: { total: 7 } }];
    const tasks = generateTasks("math_houses_grow", cards, {}, 1);
    expect(tasks[0].number).toBe(7);
    expect(tasks[0].pairs).toHaveLength(8);
  });
});
