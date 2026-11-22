import { describe, it, expect, vi, afterEach } from "vitest";
import { generateTasks, taskNeedsBorrowTeaching, buildSubColumns, resolveCompareMode, generateCopySheet, COPY_KINDS, hasCarry, hasBorrow, columnTaskOfExample, operandsExample, normalizeOperands, resolveOperands } from "./engine.js";

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

describe("generateTasks – column_arithmetic, digits: \"2+1\" (2-зн. + 1-зн.)", () => {
  it("top is always 2-digit, bottom is always 1-digit", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "mixed", carryMode: "mixed", digits: "2+1" });
    for (const t of tasks) {
      expect(t.top).toBeGreaterThanOrEqual(10);
      expect(t.top).toBeLessThanOrEqual(99);
      expect(t.bottom).toBeGreaterThanOrEqual(1);
      expect(t.bottom).toBeLessThanOrEqual(9);
    }
  });

  it("grid stays 2 columns wide (tens + units)", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 10, { operation: "add", carryMode: "none", digits: "2+1" });
    for (const t of tasks) expect(t.columns).toHaveLength(2);
  });

  it("units column has a real bottom digit, tens column does not", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "mixed", carryMode: "mixed", digits: "2+1" });
    for (const t of tasks) {
      const units = t.columns.find((c) => c.position === "units");
      const tens = t.columns.find((c) => c.position === "tens");
      expect(units.hasBottomDigit).toBe(true);
      expect(tens.hasBottomDigit).toBe(false);
      expect(tens.bottomDigit).toBe(0);
    }
  });

  it("add/none: no carry", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "none", digits: "2+1" });
    for (const t of tasks) expect(t.columns.every((c) => c.carryOut === 0)).toBe(true);
  });

  it("add/carry: units column carries into tens", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "carry", digits: "2+1" });
    for (const t of tasks) expect(t.columns.some((c) => c.carryOut > 0)).toBe(true);
  });

  it("add: sum never exceeds 99, regardless of carryMode (97+4=101 must never appear)", () => {
    for (const carryMode of ["none", "carry", "mixed"]) {
      const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode, digits: "2+1" });
      expect(tasks.length).toBeGreaterThan(0);
      for (const t of tasks) expect(t.result).toBeLessThanOrEqual(99);
    }
  });

  it("subtract/none: no borrow", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "none", digits: "2+1" });
    for (const t of tasks) expect(t.columns.every((c) => c.borrowOut === 0)).toBe(true);
  });

  it("subtract/carry: units column borrows from tens", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "subtract", carryMode: "carry", digits: "2+1" });
    for (const t of tasks) expect(t.columns.some((c) => c.borrowOut > 0)).toBe(true);
  });

  it("result = top ± bottom", () => {
    const addTasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "add", carryMode: "mixed", digits: "2+1" });
    for (const t of addTasks) expect(t.result).toBe(t.top + t.bottom);
    const subTasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "subtract", carryMode: "mixed", digits: "2+1" });
    for (const t of subTasks) expect(t.result).toBe(t.top - t.bottom);
  });

  it("no form/solve step ever targets the phantom tens position on the bottom row", () => {
    // Steps only carry a cellType + position, never row — but "result" at
    // tens always belongs to the top number's own digit (see writeDigit),
    // which is exactly what the renderer needs; this just confirms every
    // step still resolves to a defined digit (no undefined from a missing
    // bottom digit leaking through).
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "mixed", carryMode: "mixed", digits: "2+1" });
    for (const t of tasks) {
      for (const step of t.steps) {
        expect(step.cellType === "crossout" || typeof step.digit === "number").toBe(true);
      }
    }
  });
});

describe("generateTasks – column_arithmetic, digits: \"round10\" (Круглые дес.)", () => {
  it("both top and bottom are multiples of 10, in [10, 90]", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "mixed", carryMode: "mixed", digits: "round10" });
    for (const t of tasks) {
      expect(t.top % 10).toBe(0);
      expect(t.bottom % 10).toBe(0);
      expect(t.top).toBeGreaterThanOrEqual(10);
      expect(t.top).toBeLessThanOrEqual(90);
      expect(t.bottom).toBeGreaterThanOrEqual(10);
      expect(t.bottom).toBeLessThanOrEqual(90);
    }
  });

  it("grid stays 2 columns wide, both with a real (zero) bottom digit", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 10, { operation: "add", carryMode: "none", digits: "round10" });
    for (const t of tasks) {
      expect(t.columns).toHaveLength(2);
      const units = t.columns.find((c) => c.position === "units");
      expect(units.hasBottomDigit).toBe(true);
      expect(units.topDigit).toBe(0);
      expect(units.bottomDigit).toBe(0);
    }
  });

  it("add/none: tens sum stays under 10 (result stays 2-digit)", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode: "none", digits: "round10" });
    for (const t of tasks) {
      expect(t.columns.every((c) => c.carryOut === 0)).toBe(true);
      expect(t.result).toBeLessThanOrEqual(90);
    }
  });

  it("add: sum never exceeds 100, regardless of carryMode (60+70=130 must never appear)", () => {
    for (const carryMode of ["none", "carry", "mixed"]) {
      const tasks = generateTasks("column_arithmetic", CARDS, 20, { operation: "add", carryMode, digits: "round10" });
      expect(tasks.length).toBeGreaterThan(0);
      for (const t of tasks) expect(t.result).toBeLessThanOrEqual(100);
    }
  });

  it("subtract: top > bottom always, never a borrow, regardless of carryMode", () => {
    for (const carryMode of ["none", "carry", "mixed"]) {
      const tasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "subtract", carryMode, digits: "round10" });
      expect(tasks.length).toBeGreaterThan(0);
      for (const t of tasks) {
        expect(t.top).toBeGreaterThan(t.bottom);
        expect(t.columns.every((c) => c.borrowOut === 0)).toBe(true);
      }
    }
  });

  it("result = top ± bottom", () => {
    const addTasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "add", carryMode: "mixed", digits: "round10" });
    for (const t of addTasks) expect(t.result).toBe(t.top + t.bottom);
    const subTasks = generateTasks("column_arithmetic", CARDS, 15, { operation: "subtract", carryMode: "mixed", digits: "round10" });
    for (const t of subTasks) expect(t.result).toBe(t.top - t.bottom);
  });
});

describe("generateCopySheet – «Контрольная работа»", () => {
  const all = Object.fromEntries(COPY_KINDS.map((k) => [k.key, true]));
  const answer = (e) => (e.operation === "add" ? e.top + e.bottom : e.top - e.bottom);
  const len = (n) => String(n).length;

  it("mixes every ticked kind on one sheet, no example twice", () => {
    const sheet = generateCopySheet(16, { ...all, operation: "mixed", carryMode: "mixed" });
    expect(sheet).toHaveLength(16);
    expect(new Set(sheet.map((e) => e.kind)).size).toBe(8);
    expect(new Set(sheet.map((e) => `${e.operation}${e.top},${e.bottom}`)).size).toBe(16);
  });

  it("numbers stay within three digits; only «Новый разряд» changes the answer's width", () => {
    for (let run = 0; run < 30; run++) {
      for (const e of generateCopySheet(10, { ...all, operation: "mixed", carryMode: "mixed" })) {
        expect(e.top).toBeLessThan(1000);
        expect(e.bottom).toBeLessThanOrEqual(e.operation === "subtract" ? e.top : 999);
        expect(answer(e)).toBeGreaterThan(0);
        const wide = Math.max(len(e.top), len(e.bottom));
        if (e.kind === "newplace") expect(len(answer(e))).not.toBe(e.operation === "add" ? wide : len(e.top));
        else expect(len(answer(e))).toBe(wide);
      }
    }
  });

  it("each kind has its shape", () => {
    const shapes = { 22: [2, 2], 21: [2, 1], 33: [3, 3], 32: [3, 2], 31: [3, 1] };
    for (let run = 0; run < 20; run++) {
      for (const e of generateCopySheet(12, { ...all, operation: "mixed", carryMode: "mixed" })) {
        if (shapes[e.kind]) expect([len(e.top), len(e.bottom)]).toEqual(shapes[e.kind]);
        if (e.kind === "round") { expect(e.top % 10).toBe(0); expect(e.bottom % 10).toBe(0); }
        if (e.kind === "zero") expect(String(e.top).slice(1)).toContain("0");
      }
    }
  });

  it("«Перенос / заём» filters every kind but «Новый разряд»", () => {
    for (const carryMode of ["none", "carry"]) {
      for (const operation of ["add", "subtract"]) {
        const sheet = generateCopySheet(10, { ...all, kind_newplace: false, operation, carryMode });
        expect(sheet.length).toBeGreaterThan(0);
        for (const e of sheet) {
          const crosses = operation === "add" ? hasCarry(e.top, e.bottom) : hasBorrow(e.top, e.bottom);
          expect(crosses).toBe(carryMode === "carry");
        }
      }
    }
  });

  it("«С нулём» with a borrow brings the borrow through zero (305 − 7, 400 − 126)", () => {
    const sheet = generateCopySheet(10, { kind_zero: true, operation: "subtract", carryMode: "carry" });
    expect(sheet).toHaveLength(10);
    expect(sheet.every((e) => hasBorrow(e.top, e.bottom))).toBe(true);
  });

  it("nothing ticked falls back to 2 + 2", () => {
    expect(generateCopySheet(6, {}).every((e) => e.kind === "22")).toBe(true);
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
describe("«Числа в примере» — each number chosen on its own", () => {
  const gen = (operands, operation = "mixed", carryMode = "mixed", n = 40) =>
    generateTasks("column_arithmetic", CARDS, n, { operation, carryMode, operands });

  it("widths and zeros hold for every combination; the answer keeps the longer number's width", () => {
    const subsets = (n) => [[], [0], [1], [0, 1]].filter((z) => z.every((p) => p < n - 1));
    for (const top of [1, 2, 3]) for (const bottom of [1, 2, 3]) {
      for (const topZeros of subsets(top)) for (const bottomZeros of subsets(bottom)) {
        for (const operation of ["add", "subtract"]) {
          const spec = { top, topZeros, bottom, bottomZeros };
          const tasks = gen(spec, operation, "mixed", 8);
          // 1 − 1 digits: nothing to subtract that keeps a column; 1 + 1 only below 10
          if (top === 1 && bottom === 1 && operation === "subtract") continue;
          expect(tasks.length, JSON.stringify({ ...spec, operation })).toBeGreaterThan(0);
          // with a «−» the bottom is cut to the top's length (its zeros too)
          const wBottom = operation === "subtract" ? Math.min(bottom, top) : bottom;
          const [wTop, zTop, zBottom] = [top, topZeros, bottomZeros.filter((p) => p < wBottom - 1)];
          for (const t of tasks) {
            expect(String(t.top)).toHaveLength(wTop);
            expect(String(t.bottom)).toHaveLength(wBottom);
            expect(String(t.result)).toHaveLength(Math.max(wTop, wBottom));
            const zerosOf = (n) => String(n).split("").reverse().flatMap((d, p) => (d === "0" ? [p] : []));
            expect(zerosOf(t.top)).toEqual(zTop);
            expect(zerosOf(t.bottom)).toEqual(zBottom);
            const r = Object.fromEntries(t.steps.filter((st) => st.cellType === "result").map((st) => [st.position, st.digit]));
            expect((r.hundreds ?? 0) * 100 + (r.tens ?? 0) * 10 + (r.units ?? 0)).toBe(t.result);
          }
        }
      }
    }
  });

  it("25 + 326: a shorter top number — its empty cell is marked, the grid as wide as the longer", () => {
    const t = columnTaskOfExample({ operation: "add", top: 25, bottom: 326 });
    expect(t.digits).toBe(3);
    expect(t.columns.map((c) => c.hasTopDigit)).toEqual([true, true, false]);
    expect(t.steps.filter((st) => st.cellType === "result").map((st) => st.digit)).toEqual([1, 5, 3]);
  });

  it("carry is honoured where the numbers allow it", () => {
    for (const t of gen({ top: 3, bottom: 2 }, "add", "carry")) expect(hasCarry(t.top, t.bottom)).toBe(true);
    for (const t of gen({ top: 3, topZeros: [1], bottom: 2 }, "subtract", "carry")) expect(hasBorrow(t.top, t.bottom)).toBe(true);
    for (const t of gen({ top: 2, bottom: 1 }, "add", "none")) expect(hasCarry(t.top, t.bottom)).toBe(false);
  });

  it("a carry the numbers can't have: examples come without it, marked relaxed", () => {
    // round tens + round tens carry only into a new place, which the trainer doesn't do
    const ex = operandsExample({ top: 2, topZeros: [0], bottom: 2, bottomZeros: [0] }, "add", "carry");
    expect(ex).toBeTruthy();
    expect(ex.relaxed).toBe(true);
    expect(gen({ top: 2, topZeros: [0], bottom: 2, bottomZeros: [0] }, "add", "carry")).not.toHaveLength(0);
  });

  it("either number may be the longer; the leading digit never a zero", () => {
    expect(normalizeOperands({ top: 2, bottom: 3 })).toMatchObject({ top: 2, bottom: 3 });
    expect(normalizeOperands({ top: 1, bottom: 1 })).toMatchObject({ top: 1, bottom: 1 });
    expect(normalizeOperands({ top: 2, bottom: 3 }, "subtract")).toMatchObject({ top: 2, bottom: 2 });
    // «Микс»: the setting stays free; each subtraction example cuts the bottom itself
    const mixed = generateTasks("column_arithmetic", CARDS, 40, { operation: "mixed", carryMode: "mixed", operands: { top: 2, bottom: 3 } });
    expect(mixed.some((t) => t.operation === "add" && String(t.bottom).length === 3)).toBe(true);
    for (const t of mixed.filter((t) => t.operation === "subtract")) expect(String(t.bottom).length).toBeLessThanOrEqual(2);
    expect(normalizeOperands({ top: 2, topZeros: [0, 1], bottom: 1, bottomZeros: [0] })).toEqual({ top: 2, topZeros: [0], bottom: 1, bottomZeros: [] });
  });

  it("old settings map onto the cells", () => {
    expect(resolveOperands({ digits: "3+1" })).toEqual({ top: 3, topZeros: [], bottom: 1, bottomZeros: [] });
    expect(resolveOperands({ digits: "round10" })).toEqual({ top: 2, topZeros: [0], bottom: 2, bottomZeros: [0] });
    expect(resolveOperands({ digits: "zero" })).toEqual({ top: 3, topZeros: [1], bottom: 2, bottomZeros: [] });
    expect(resolveOperands({})).toEqual({ top: 2, topZeros: [], bottom: 2, bottomZeros: [] });
    expect(resolveOperands({ operands: { top: 3, topKind: "round", bottom: 2, bottomKind: "any" } })).toEqual({ top: 3, topZeros: [0], bottom: 2, bottomZeros: [] });
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

  it("step order: take — give — reduce: the «1» in front, then crossout and adjust, then the result", () => {
    const tasks = generateTasks("column_arithmetic", CARDS, 30, { operation: "subtract", carryMode: "carry", digits: 2 });
    // (52 − 47 = 5 has no tens to write — a leading zero is not written)
    const t = tasks.find((task) => task.columns[0].borrowOut > 0 && task.result >= 10);
    expect(t.steps.map((s) => s.cellType)).toEqual(["borrow", "crossout", "adjust", "result", "result"]);
    expect(t.steps[0].lenders).toEqual(["tens"]);
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

describe("generateTasks – column_arithmetic with leftover finger cards", () => {
  it("arithmetic mode ignores finger cards", () => {
    const fingerCards = [
      { id: "fshow_3",      conceptId: "fshow_3",      renderer: "column_addition", params: { mode: "fingers_show",  n: 3 } },
      { id: "fcount_a_3_4", conceptId: "fcount_a_3_4", renderer: "column_addition", params: { mode: "fingers_count", op: "add", a: 3, b: 4 } },
    ];
    const tasks = generateTasks("column_arithmetic", [...CARDS, ...fingerCards], 10, { operation: "add", carryMode: "none", digits: 2 });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every(t => t.type === "column_arithmetic")).toBe(true);
  });
});

describe("borrowing through a zero (trainer and the tablet check)", () => {
  const steps = (top, bottom) => columnTaskOfExample({ operation: "subtract", top, bottom }).steps
    .map((st) => `${st.cellType}:${st.position}:${st.digit}`);

  it("302 − 195: the hundreds give first, the 0 becomes 10, gives one and is 9 — then the units take their «1»", () => {
    expect(steps(302, 195)).toEqual([
      "crossout:hundreds:null", "adjust:hundreds:2",
      "regroup:tens:10", "crossout:tens:null", "adjust:tens:9",
      "borrow:units:1",
      "result:units:7",
      "result:tens:0", "result:hundreds:1",
    ]);
  });

  it("532 − 157: the tens lend, then borrow themselves — one order for every place", () => {
    expect(steps(532, 157)).toEqual([
      "borrow:units:1", "crossout:tens:null", "adjust:tens:2", "result:units:5",
      "borrow:tens:1", "crossout:hundreds:null", "adjust:hundreds:4", "result:tens:7",
      "result:hundreds:3",
    ]);
  });

  it("every place starts with its «хватает?» numbers: what is on top now and the bottom digit", () => {
    const firsts = columnTaskOfExample({ operation: "subtract", top: 532, bottom: 157 }).steps.filter((st) => st.first);
    expect(firsts.map((st) => [st.column, st.have, st.need])).toEqual([["units", 2, 7], ["tens", 2, 5], ["hundreds", 4, 1]]);
    const short = columnTaskOfExample({ operation: "subtract", top: 347, bottom: 5 }).steps.filter((st) => st.first);
    expect(short.map((st) => st.need)).toEqual([5, null, null]);
  });

  it("400 − 126: through a zero: the hundreds give, the 0 of the tens becomes 10, then 9", () => {
    expect(steps(400, 126)).toEqual([
      "crossout:hundreds:null", "adjust:hundreds:3",
      "regroup:tens:10", "crossout:tens:null", "adjust:tens:9",
      "borrow:units:1",
      "result:units:4",
      "result:tens:7", "result:hundreds:2",
    ]);
  });

  it("708 − 409 and 808 − 599: «хватает?» first, then the ten travels top-down, the 10 the child writes, the units last", () => {
    const t = columnTaskOfExample({ operation: "subtract", top: 708, bottom: 409 });
    expect(t.steps.map((st) => `${st.cellType}:${st.position}:${st.digit}`)).toEqual([
      "crossout:hundreds:null", "adjust:hundreds:6",
      "regroup:tens:10", "crossout:tens:null", "adjust:tens:9",
      "borrow:units:1", "result:units:9",
      "result:tens:9", "result:hundreds:2",
    ]);
    // «Хватает?» (8 − 9) is asked on the very first step of the chain
    expect(t.steps[0]).toMatchObject({ first: true, column: "units", have: 8, need: 9 });
    // the «1» comes from the tens (the 10 that just gave one away)
    expect(t.steps.find((st) => st.cellType === "borrow").lenders).toEqual(["tens"]);
    expect(steps(808, 599).filter((st) => st.startsWith("result"))).toEqual(["result:units:9", "result:tens:0", "result:hundreds:2"]);
  });

  it("every 3-digit subtraction: digits 0–9 only, the result digits make the answer", () => {
    for (let top = 100; top < 1000; top++) {
      for (let bottom = 1; bottom < top; bottom += 7) {
        const t = columnTaskOfExample({ operation: "subtract", top, bottom });
        expect(t.steps.every((st) => st.digit === null || (st.digit >= 0 && st.digit <= (st.cellType === "regroup" ? 10 : 9)))).toBe(true);
        const r = Object.fromEntries(t.steps.filter((st) => st.cellType === "result").map((st) => [st.position, st.digit]));
        expect((r.hundreds ?? 0) * 100 + (r.tens ?? 0) * 10 + (r.units ?? 0)).toBe(t.result);
      }
    }
  });

  it("no step asks for a digit outside 0–9, the result digits make the answer", () => {
    const cards = [{ id: "s", conceptId: "s", renderer: "column_addition", params: { operation: "subtract" } }];
    for (let run = 0; run < 100; run++) {
      for (const t of generateTasks("column_arithmetic", cards, 10, { digits: run % 2 ? 3 : "zero", carryMode: "carry", operation: "subtract" })) {
        expect(t.steps.every((st) => st.digit === null || (st.digit >= 0 && st.digit <= (st.cellType === "regroup" ? 10 : 9)))).toBe(true);
        const r = Object.fromEntries(t.steps.filter((st) => st.cellType === "result").map((st) => [st.position, st.digit]));
        expect((r.hundreds ?? 0) * 100 + (r.tens ?? 0) * 10 + r.units).toBe(t.result);
      }
    }
  });

  it("102 − 7 = 95: no leading zero to write", () => {
    expect(steps(102, 7).filter((st) => st.startsWith("result"))).toEqual(["result:units:5", "result:tens:9"]);
    // the hundreds lent down to 0: crossed out, no «0» written over them
    expect(steps(102, 7).filter((st) => st.endsWith("hundreds:null") || st.startsWith("adjust:hundreds"))).toEqual(["crossout:hundreds:null"]);
  });

  it("new place: 95 + 7 and 650 + 470 — the child writes the last «1» in the answer", () => {
    const add = (top, bottom) => columnTaskOfExample({ operation: "add", top, bottom }).steps.map((st) => `${st.cellType}:${st.position}:${st.digit}`);
    expect(add(95, 7)).toEqual(["result:units:2", "carry:tens:1", "result:tens:0", "result:overflow:1"]);
    expect(add(650, 470)).toEqual(["result:units:0", "result:tens:2", "carry:hundreds:1", "result:hundreds:1", "result:overflow:1"]);
  });
});

