import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

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
