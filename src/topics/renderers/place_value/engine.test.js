import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

const PLACE_VALUE_CARDS = [
  { id: "build_number",    conceptId: "build_number",    renderer: "place_value", params: { mode: "build_number" } },
  { id: "identify_number", conceptId: "identify_number", renderer: "place_value", params: { mode: "identify_number" } },
  { id: "regroup_ten",     conceptId: "regroup_ten",     renderer: "place_value", params: { mode: "regroup_ten" } },
];

describe("generateTasks – build_number", () => {
  it("limits the introductory range to one ten and carries teaching choices into the task", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxTens: 9, maxOnes: 9, numberRange: "teens", buildApproach: "ready", askComposition: true, supportMode: "independent" });
    expect(tasks.every((t) => t.number >= 11 && t.number <= 19 && t.target.tens === 1)).toBe(true);
    expect(tasks.every((t) => t.buildApproach === "ready" && t.askComposition && t.supportMode === "independent")).toBe(true);
  });
  it("returns tasks of type build_number with number matching target", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 10, { maxOnes: 9 });
    expect(tasks).toHaveLength(10);
    for (const t of tasks) {
      expect(t.type).toBe("build_number");
      expect(t.number).toBe(t.target.tens * 10 + t.target.ones);
    }
  });

  it("maxOnes 0: ones digit is always 0", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 20, { maxOnes: 0 });
    for (const t of tasks) expect(t.target.ones).toBe(0);
  });

  it("maxOnes 2: ones digit is always 1 or 2, never 0", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxOnes: 2 });
    for (const t of tasks) expect([1, 2]).toContain(t.target.ones);
  });

  it("maxOnes 9: ones digit spans 1-9", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxOnes: 9 });
    for (const t of tasks) {
      expect(t.target.ones).toBeGreaterThanOrEqual(1);
      expect(t.target.ones).toBeLessThanOrEqual(9);
    }
  });

  it("maxTens 9: tens digit spans the full 1-9 range", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxOnes: 9, maxTens: 9 });
    for (const t of tasks) {
      expect(t.target.tens).toBeGreaterThanOrEqual(1);
      expect(t.target.tens).toBeLessThanOrEqual(9);
    }
  });

  it("maxTens not specified: tens digit defaults to the 1-3 range", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxOnes: 9 });
    for (const t of tasks) {
      expect(t.target.tens).toBeGreaterThanOrEqual(1);
      expect(t.target.tens).toBeLessThanOrEqual(3);
    }
  });

  it("maxTens 1: tens digit is always 1", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 20, { maxOnes: 9, maxTens: 1 });
    for (const t of tasks) expect(t.target.tens).toBe(1);
  });

  it("task.maxTens reflects the configured value", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 5, { maxOnes: 9, maxTens: 5 });
    expect(tasks.every((t) => t.maxTens === 5)).toBe(true);
  });

  it("numericBlocks defaults to false when not specified", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 5, { maxOnes: 9 });
    expect(tasks.every(t => t.numericBlocks === false)).toBe(true);
  });

  it("numericBlocks follows the numericBlocks param", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 5, { maxOnes: 9, numericBlocks: true });
    expect(tasks.every(t => t.numericBlocks === true)).toBe(true);
  });
});

describe("generateTasks – identify_number", () => {
  it("supports separate single, round and two-digit sets and the chosen maximum tens", () => {
    const single = generateTasks("identify_number", PLACE_VALUE_CARDS, 20, { numberSet: "single", maxOnes: 3 });
    expect(single.every((t) => t.model.tens === 0 && t.number >= 1 && t.number <= 3)).toBe(true);
    const round = generateTasks("identify_number", PLACE_VALUE_CARDS, 20, { numberSet: "round", maxTens: 2 });
    expect(round.every((t) => [10, 20].includes(t.number))).toBe(true);
    const two = generateTasks("identify_number", PLACE_VALUE_CARDS, 20, { numberSet: "two_digit", maxTens: 1, maxOnes: 2 });
    expect(two.every((t) => [11, 12].includes(t.number))).toBe(true);
  });
  it("returns tasks of type identify_number with number matching model", () => {
    const tasks = generateTasks("identify_number", PLACE_VALUE_CARDS, 10, { maxOnes: 7 });
    expect(tasks).toHaveLength(10);
    for (const t of tasks) {
      expect(t.type).toBe("identify_number");
      expect(t.number).toBe(t.model.tens * 10 + t.model.ones);
    }
  });

  // Round tens (30, 40...) and bare single digits (7) are mixed in among
  // the regular two-digit draws — a large sample should contain both, not
  // just the regular 1-9/1-9 case.
  it("mixes in round tens (ones = 0) and bare single digits (tens = 0) over a large sample", () => {
    const tasks = generateTasks("identify_number", PLACE_VALUE_CARDS, 400, { maxOnes: 9 });
    expect(tasks.some((t) => t.model.tens > 0 && t.model.ones === 0)).toBe(true);
    expect(tasks.some((t) => t.model.tens === 0 && t.model.ones > 0)).toBe(true);
    expect(tasks.some((t) => t.model.tens > 0 && t.model.ones > 0)).toBe(true);
    for (const t of tasks) {
      expect(t.model.tens).toBeGreaterThanOrEqual(0);
      expect(t.model.ones).toBeGreaterThanOrEqual(0);
      expect(t.number).toBe(t.model.tens * 10 + t.model.ones);
    }
  });

  // maxOnes: 0 stays the pre-existing, deliberate "round tens only"
  // session — every task must have ones === 0, never mixed with tens === 0.
  it("maxOnes: 0 still means every task is a round ten, with tens never 0", () => {
    const tasks = generateTasks("identify_number", PLACE_VALUE_CARDS, 30, { maxOnes: 0 });
    for (const t of tasks) {
      expect(t.model.ones).toBe(0);
      expect(t.model.tens).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("generateTasks – regroup_ten", () => {
  it("honours the maximum tens and independent-trial settings", () => {
    const tasks = generateTasks("regroup_ten", PLACE_VALUE_CARDS, 20, { maxTens: 1, supportMode: "independent", allowReverse: false });
    expect(tasks.every((t) => t.initial.tens === 1 && t.supportMode === "independent" && !t.allowReverse)).toBe(true);
  });
  it("returns tasks where after = initial minus one ten plus ten ones", () => {
    const tasks = generateTasks("regroup_ten", PLACE_VALUE_CARDS, 20, { maxOnes: 9 });
    expect(tasks).toHaveLength(20);
    for (const t of tasks) {
      expect(t.type).toBe("regroup_ten");
      expect(t.initial.tens).toBeGreaterThanOrEqual(1);
      expect(t.after.tens).toBe(t.initial.tens - 1);
      expect(t.after.ones).toBe(t.initial.ones + 10);
      expect(t.after.tens * 10 + t.after.ones).toBe(t.number);
    }
  });
});
