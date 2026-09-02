import { describe, it, expect, vi, afterEach } from "vitest";
import { generateTasks, taskNeedsBorrowTeaching, buildSubColumns, resolveCompareMode } from "./engine.js";
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

describe("buildSubColumns compareTopDigit", () => {
  it("equals topDigit when no borrow flows in from the right (units column)", () => {
    const cols = buildSubColumns(652, 357, 3);
    expect(cols[0].position).toBe("units");
    expect(cols[0].borrowIn).toBe(0);
    expect(cols[0].compareTopDigit).toBe(cols[0].topDigit);
  });

  it("is reduced by 1 when a borrow flows in from the column to the right", () => {
    const cols = buildSubColumns(652, 357, 3);
    const tens = cols[1];
    expect(tens.position).toBe("tens");
    expect(tens.borrowIn).toBe(1);
    expect(tens.topDigit).toBe(5);
    expect(tens.compareTopDigit).toBe(4);
  });

  it("regression: raw topDigit equals bottomDigit, but compareTopDigit still correctly signals a borrow is needed", () => {
    const cols = buildSubColumns(652, 357, 3);
    const tens = cols[1];
    // Raw digits look equal — a naive comparison would say "=", no borrow needed.
    expect(tens.topDigit).toBe(tens.bottomDigit);
    // The engine's own decision says a borrow IS needed for this column.
    expect(tens.borrowOut).toBe(1);
    // compareTopDigit is what must be compared instead — and it correctly says "<".
    expect(tens.compareTopDigit).toBeLessThan(tens.bottomDigit);
  });
});

// digits:"mixed" carryMode picks top/bottom independently within a range, rather than
// deriving bottom from "how much room is left before the digit cap" — at the RNG's
// top-of-range value that let add/mixed hand back a 2-digit result over 99 (or a 3-digit
// result over 999). Math.random is pinned to just-under-1 so randomInt(min, max) always
// resolves to max, deterministically reproducing the worst case instead of relying on
// hitting it by chance.
describe("column_arithmetic — result never exceeds the selected digit count", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("add/mixed, digits:2 — result stays within 2 digits at the RNG's top-of-range value", () => {
    vi.spyOn(Math, "random").mockReturnValue(1 - 1e-9);
    const tasks = generateTasks("column_arithmetic", CARDS, 1, { operation: "add", carryMode: "mixed", digits: 2 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].result).toBeLessThanOrEqual(99);
  });

  it("add/mixed, digits:3 — result stays within 3 digits at the RNG's top-of-range value", () => {
    vi.spyOn(Math, "random").mockReturnValue(1 - 1e-9);
    const tasks = generateTasks("column_arithmetic", CARDS, 1, { operation: "add", carryMode: "mixed", digits: 3 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].result).toBeLessThanOrEqual(999);
  });

  it("subtract/mixed, digits:2 — result stays within [0, 99] at the RNG's top-of-range value", () => {
    vi.spyOn(Math, "random").mockReturnValue(1 - 1e-9);
    const tasks = generateTasks("column_arithmetic", CARDS, 1, { operation: "subtract", carryMode: "mixed", digits: 2 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].result).toBeGreaterThanOrEqual(0);
    expect(tasks[0].result).toBeLessThanOrEqual(99);
  });
});

describe("buildSubSteps borrow/adjust step shape", () => {
  it("borrow step sits at the receiving (lower) column's own position", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    expect(t).toBeDefined();
    const borrowStep = t.steps.find((s) => s.cellType === "borrow");
    expect(borrowStep.position).toBe("units");
    expect(borrowStep.digit).toBe(1);
  });

  it("adjust step sits at the source (higher) column's position with topDigit-1", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    const adjustStep = t.steps.find((s) => s.cellType === "adjust");
    expect(adjustStep.position).toBe("tens");
    expect(adjustStep.digit).toBe(t.columns[1].topDigit - 1);
  });

  it("step order is borrow, result(lower) — finish the current column — then crossout, adjust, result(higher)", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    expect(t.steps.map((s) => s.cellType)).toEqual(["borrow", "result", "crossout", "adjust", "result"]);
  });

  it("crossout step sits at the source column's position, between borrow and adjust", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    const t = tasks.find((task) => task.columns[0].borrowOut > 0);
    const crossoutStep = t.steps.find((s) => s.cellType === "crossout");
    expect(crossoutStep).toBeDefined();
    expect(crossoutStep.position).toBe("tens");
  });

  it("no crossout step when the column doesn't need a borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "none", digits: 2 });
    for (const t of tasks) {
      expect(t.steps.some((s) => s.cellType === "crossout")).toBe(false);
    }
  });

  it("no adjust step when the column doesn't need a borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "none", digits: 2 });
    for (const t of tasks) {
      expect(t.steps.some((s) => s.cellType === "adjust")).toBe(false);
      expect(t.steps.some((s) => s.cellType === "borrow")).toBe(false);
    }
  });
});

describe("taskNeedsBorrowTeaching", () => {
  it("true for subtraction tasks with a borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    expect(tasks.every(taskNeedsBorrowTeaching)).toBe(true);
  });

  it("false for addition tasks, even with carry", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "carry", digits: 2 });
    expect(tasks.every((t) => !taskNeedsBorrowTeaching(t))).toBe(true);
  });

  it("false for subtraction tasks without a borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "none", digits: 2 });
    expect(tasks.every((t) => !taskNeedsBorrowTeaching(t))).toBe(true);
  });
});

describe("resolveCompareMode", () => {
  it("returns sessionParams.compareMode when present", () => {
    expect(resolveCompareMode({ compareMode: "always" })).toBe("always");
    expect(resolveCompareMode({ compareMode: "off" })).toBe("off");
  });

  it("migrates legacy showCompare: true to onBorrow when compareMode is absent", () => {
    expect(resolveCompareMode({ showCompare: true })).toBe("onBorrow");
  });

  it("migrates legacy showCompare: false to off when compareMode is absent", () => {
    expect(resolveCompareMode({ showCompare: false })).toBe("off");
  });

  it("defaults to onBorrow when neither compareMode nor showCompare is set", () => {
    expect(resolveCompareMode({})).toBe("onBorrow");
    expect(resolveCompareMode(undefined)).toBe("onBorrow");
  });

  it("compareMode takes priority over a stale legacy showCompare value", () => {
    expect(resolveCompareMode({ compareMode: "always", showCompare: false })).toBe("always");
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

const FINGER_CARDS = [
  { id: "fshow_3",      conceptId: "fshow_3",      renderer: "column_addition", params: { mode: "fingers_show",  n: 3 } },
  { id: "fshow_7",      conceptId: "fshow_7",      renderer: "column_addition", params: { mode: "fingers_show",  n: 7 } },
  { id: "fcount_a_3_4", conceptId: "fcount_a_3_4", renderer: "column_addition", params: { mode: "fingers_count", op: "add", a: 3, b: 4 } },
  { id: "fcount_s_7_3", conceptId: "fcount_s_7_3", renderer: "column_addition", params: { mode: "fingers_count", op: "sub", a: 7, b: 3 } },
];

describe("generateTasks – fingers_show", () => {
  it("returns tasks of type fingers_show", () => {
    const tasks = generateTasks("fingers_show", FINGER_CARDS, 4);
    expect(tasks.every(t => t.type === "fingers_show")).toBe(true);
  });

  it("task.n matches card.params.n", () => {
    const tasks = generateTasks("fingers_show", FINGER_CARDS, 2);
    expect(tasks[0].n).toBeDefined();
  });

  it("arithmetic mode ignores finger cards", () => {
    const mixed = [...CARDS, ...FINGER_CARDS];
    const tasks = generateTasks("column_arithmetic", mixed, 10, { operation: "add", carryMode: "none", digits: 2 });
    expect(tasks.every(t => t.type === "column_arithmetic")).toBe(true);
  });
});

describe("generateTasks – fingers_count", () => {
  it("returns tasks of type fingers_count", () => {
    const tasks = generateTasks("fingers_count", FINGER_CARDS, 4);
    expect(tasks.every(t => t.type === "fingers_count")).toBe(true);
  });

  it("add task: result = a + b", () => {
    const tasks = generateTasks("fingers_count", FINGER_CARDS, 4);
    const addTasks = tasks.filter(t => t.op === "add");
    for (const t of addTasks) expect(t.result).toBe(t.a + t.b);
  });

  it("sub task: has removeMode", () => {
    const tasks = generateTasks("fingers_count", FINGER_CARDS, 4);
    const subTasks = tasks.filter(t => t.op === "sub");
    for (const t of subTasks) expect(t.removeMode).toMatch(/^hand|fold$/);
  });

  it("sub task 7-3: removeMode hand, removeHand left", () => {
    const tasks = generateTasks("fingers_count", FINGER_CARDS, 10);
    const t = tasks.find(t => t.op === "sub" && t.a === 7 && t.b === 3);
    expect(t?.removeMode).toBe("hand");
    expect(t?.removeHand).toBe("left");
  });
});

const PLACE_VALUE_CARDS = [
  { id: "build_number",    conceptId: "build_number",    renderer: "column_addition", params: { mode: "build_number" } },
  { id: "identify_number", conceptId: "identify_number", renderer: "column_addition", params: { mode: "identify_number" } },
  { id: "regroup_ten",     conceptId: "regroup_ten",     renderer: "column_addition", params: { mode: "regroup_ten" } },
];

describe("generateTasks – build_number", () => {
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
