import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

const PLACE_VALUE_CARDS = [
  { id: "build_number",    conceptId: "build_number",    renderer: "place_value", params: { mode: "build_number" } },
  { id: "identify_number", conceptId: "identify_number", renderer: "place_value", params: { mode: "identify_number" } },
  { id: "exchange_ten",    conceptId: "exchange_ten",    renderer: "place_value", params: { mode: "exchange_ten" } },
  { id: "group_ten",       conceptId: "group_ten",       renderer: "place_value", params: { mode: "group_ten" } },
];

describe("generateTasks – build_number", () => {
  it("limits the introductory range to one ten and carries teaching choices into the task", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxTens: 9, maxOnes: 9, numberRange: "teens", prompt: "words", supportMode: "independent" });
    expect(tasks.every((t) => t.number >= 11 && t.number <= 19 && t.target.tens === 1)).toBe(true);
    expect(tasks.every((t) => t.prompt === "words" && t.supportMode === "independent")).toBe(true);
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

  it("maxTens not specified: tens digit defaults to the 1-5 range", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 30, { maxOnes: 9 });
    for (const t of tasks) {
      expect(t.target.tens).toBeGreaterThanOrEqual(1);
      expect(t.target.tens).toBeLessThanOrEqual(5);
    }
  });

  it("maxTens 1: tens digit is always 1", () => {
    const tasks = generateTasks("build_number", PLACE_VALUE_CARDS, 20, { maxOnes: 9, maxTens: 1 });
    for (const t of tasks) expect(t.target.tens).toBe(1);
  });

  it("prompt: digits by default, words, or a per-task mix", () => {
    expect(generateTasks("build_number", PLACE_VALUE_CARDS, 5, {}).every((t) => t.prompt === "digits")).toBe(true);
    expect(generateTasks("build_number", PLACE_VALUE_CARDS, 5, { prompt: "words" }).every((t) => t.prompt === "words")).toBe(true);
    const mixed = generateTasks("build_number", PLACE_VALUE_CARDS, 60, { prompt: "mix" });
    expect(new Set(mixed.map((t) => t.prompt))).toEqual(new Set(["digits", "words"]));
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

describe("generateTasks – exchange_ten", () => {
  it("makes exactly half of a session need an exchange, with the reason matching the action", () => {
    for (const operation of ["give", "get", "mixed"]) {
      const tasks = generateTasks("exchange_ten", PLACE_VALUE_CARDS, 10, { operation, maxTens: 5 });
      expect(tasks).toHaveLength(10);
      expect(tasks.filter((t) => t.needsExchange)).toHaveLength(5);
      for (const t of tasks) {
        expect(t.type).toBe("exchange_ten");
        expect(t.number).toBe(t.start.tens * 10 + t.start.ones);
        expect(t.result).toBe(t.op === "give" ? t.number - t.k : t.number + t.k);
        expect(t.result).toBeGreaterThanOrEqual(1);
        expect(t.result).toBeLessThanOrEqual(99);
        expect(t.k).toBeGreaterThanOrEqual(1);
        expect(t.k).toBeLessThanOrEqual(9);
        expect(t.start.tens).toBeLessThanOrEqual(5);
        expect(t.needsExchange).toBe(t.op === "give" ? t.k > t.start.ones : t.start.ones + t.k >= 10);
        if (operation !== "mixed") expect(t.op).toBe(operation);
      }
    }
  });

  it("carries the adult's settings into each task", () => {
    const [task] = generateTasks("exchange_ten", PLACE_VALUE_CARDS, 1, { supportMode: "independent", showColumn: true });
    expect(task).toMatchObject({ supportMode: "independent", showColumn: true, cardId: "exchange_ten" });
  });

  it("works with a single ten available", () => {
    const tasks = generateTasks("exchange_ten", PLACE_VALUE_CARDS, 20, { operation: "mixed", maxTens: 1 });
    expect(tasks.every((t) => t.start.tens === 1)).toBe(true);
    expect(tasks.filter((t) => t.needsExchange)).toHaveLength(10);
  });
});

describe("generateTasks – group_ten", () => {
  it("keeps each range inside its bounds and splits the number into tens and ones", () => {
    const bounds = { teens: [11, 19], to49: [21, 49], round: [20, 40], mixed: [11, 49] };
    for (const [numberRange, [min, max]] of Object.entries(bounds)) {
      const tasks = generateTasks("group_ten", PLACE_VALUE_CARDS, 30, { numberRange });
      expect(tasks).toHaveLength(30);
      for (const t of tasks) {
        expect(t.type).toBe("group_ten");
        expect(t.number).toBeGreaterThanOrEqual(min);
        expect(t.number).toBeLessThanOrEqual(max);
        expect(t.tens * 10 + t.ones).toBe(t.number);
        if (numberRange === "round") expect(t.ones).toBe(0);
        if (numberRange === "to49") expect(t.ones).not.toBe(0);
      }
    }
  });

  it("does not repeat a number until the range is used up", () => {
    const tasks = generateTasks("group_ten", PLACE_VALUE_CARDS, 9, { numberRange: "teens" });
    expect(new Set(tasks.map((t) => t.number)).size).toBe(9);
  });

  it("carries the frame and support settings", () => {
    const [task] = generateTasks("group_ten", PLACE_VALUE_CARDS, 1, { supportMode: "independent", showFrame: false });
    expect(task).toMatchObject({ supportMode: "independent", showFrame: false, cardId: "group_ten" });
    const [defaults] = generateTasks("group_ten", PLACE_VALUE_CARDS, 1, {});
    expect(defaults).toMatchObject({ supportMode: "learning", showFrame: true });
  });
});
