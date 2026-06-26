import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";
import { FINGER_MAP, getFingerConfig, getRemoveMode } from "./FingerSystem.js";

const CARDS = [
  { id: "col_add", conceptId: "col_add", renderer: "column_addition", params: { operation: "add" } },
  { id: "col_sub", conceptId: "col_sub", renderer: "column_addition", params: { operation: "subtract" } },
];

function posDigit(n, pos) {
  if (pos === "units")   return n % 10;
  if (pos === "tens")    return Math.floor(n / 10) % 10;
  return Math.floor(n / 100) % 10;
}

describe("generateTasks – column_arithmetic", () => {
  it("returns requested count", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 10, { operation: "add", carryMode: "none", digits: 2 });
    expect(tasks).toHaveLength(10);
  });

  it("add/none: no carry in any column", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "none", digits: 2 });
    for (const t of tasks) {
      expect(t.columns.every(c => c.carryOut === 0)).toBe(true);
    }
  });

  it("add/carry: at least one column has carry", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "carry", digits: 2 });
    for (const t of tasks) {
      expect(t.columns.some(c => c.carryOut > 0)).toBe(true);
    }
  });

  it("subtract/none: no borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "none", digits: 2 });
    for (const t of tasks) {
      expect(t.columns.every(c => c.borrowOut === 0)).toBe(true);
    }
  });

  it("subtract/carry: at least one borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "carry", digits: 2 });
    for (const t of tasks) {
      expect(t.columns.some(c => c.borrowOut > 0)).toBe(true);
    }
  });

  it("result = top + bottom for add", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "add", carryMode: "mixed", digits: 2 });
    for (const t of tasks) expect(t.result).toBe(t.top + t.bottom);
  });

  it("result = top - bottom for subtract", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "subtract", carryMode: "mixed", digits: 2 });
    for (const t of tasks) expect(t.result).toBe(t.top - t.bottom);
  });

  it("each result step digit matches actual result digit", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "add", carryMode: "carry", digits: 2 });
    for (const t of tasks) {
      for (const step of t.steps) {
        if (step.cellType === "result") {
          expect(step.digit).toBe(posDigit(t.result, step.position));
        }
      }
    }
  });

  it("3-digit tasks have 3 columns", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 5, { operation: "add", carryMode: "none", digits: 3 });
    for (const t of tasks) expect(t.columns).toHaveLength(3);
  });

  it("mixed produces both operations", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 40, { operation: "mixed", carryMode: "none", digits: 2 });
    expect(tasks.some(t => t.operation === "add")).toBe(true);
    expect(tasks.some(t => t.operation === "subtract")).toBe(true);
  });

  it("returns empty array when no cards", () => {
    const tasks = generateTasks("column_arithmetic", [], 5, {});
    expect(tasks).toHaveLength(0);
  });

  it("sub: top > bottom always", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "mixed", digits: 2 });
    for (const t of tasks) expect(t.top).toBeGreaterThan(t.bottom);
  });
});

describe("FingerSystem", () => {
  it("FINGER_MAP has 11 entries 0..10", () => {
    for (let i = 0; i <= 10; i++) expect(FINGER_MAP[i]).toBeDefined();
  });

  it("right >= left for all", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right).toBeGreaterThanOrEqual(left);
    }
  });

  it("right - left is 0 or 1 for all", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right - left).toBeLessThanOrEqual(1);
    }
  });

  it("right + left === n for all", () => {
    for (let i = 0; i <= 10; i++) {
      const { right, left } = FINGER_MAP[i];
      expect(right + left).toBe(i);
    }
  });

  it("getFingerConfig(7) returns {right:4, left:3}", () => {
    expect(getFingerConfig(7)).toEqual({ right: 4, left: 3 });
  });

  it("getRemoveMode: b matches left → removeMode hand left", () => {
    expect(getRemoveMode(7, 3)).toEqual({ removeMode: "hand", removeHand: "left" });
  });

  it("getRemoveMode: b matches right → removeMode hand right", () => {
    expect(getRemoveMode(7, 4)).toEqual({ removeMode: "hand", removeHand: "right" });
  });

  it("getRemoveMode: b matches neither → fold", () => {
    expect(getRemoveMode(7, 2)).toEqual({ removeMode: "fold" });
  });
});
