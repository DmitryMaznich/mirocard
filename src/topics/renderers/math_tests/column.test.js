import { describe, expect, it } from "vitest";
import { normalizeBlock, buildBlock } from "./blocks.js";
import { layoutTest, blanksOf, pagePrimitives } from "./layout.js";
import { normalizeTest } from "./store.js";
import { regroups } from "./column.js";

const colBlock = (patch) => normalizeBlock({ type: "column", id: "c", seed: 3, count: 12, ...patch });

describe("math_tests «Реши в столбик»", () => {
  it("every example is right, sized as asked, carries / borrows as asked", () => {
    for (const size of ["2+1", "2+2", "3+1", "3+2", "3+3"]) {
      for (const ops of ["add", "subtract"]) {
        for (const regroup of ["with", "without"]) {
          for (let seed = 1; seed <= 6; seed += 1) {
            const { items } = buildBlock(colBlock({ size, ops, regroup, seed }));
            expect(items.length).toBe(12);
            for (const it of items) {
              const { a, b, op } = it.column;
              const [la, lb] = size.split("+").map(Number);
              expect(String(a).length).toBe(la);
              expect(String(b).length).toBe(lb);
              expect(op).toBe(ops);
              expect(it.answers[0]).toBe(op === "add" ? a + b : a - b);
              expect(it.answers[0]).toBeGreaterThan(0);
              expect(regroups(a, b, op)).toBe(regroup === "with");
            }
          }
        }
      }
    }
  });

  it("the numbers as cells, as in the trainer: digits, zeros where marked, a longer bottom with «+»", () => {
    const zerosOf = (n) => String(n).split("").reverse().flatMap((d, p) => (d === "0" ? [p] : []));
    const operands = { top: 3, topZeros: [1], bottom: 2, bottomZeros: [0] };
    for (let seed = 1; seed <= 6; seed += 1) {
      for (const it of buildBlock(colBlock({ operands, ops: "subtract", regroup: "mixed", seed })).items) {
        const { a, b } = it.column;
        expect(String(a)).toHaveLength(3);
        expect(zerosOf(a)).toEqual([1]); // 305-like
        expect(String(b)).toHaveLength(2);
        expect(zerosOf(b)).toEqual([0]); // 40-like
        expect(it.answers[0]).toBe(a - b);
      }
    }
    const longer = buildBlock(colBlock({ operands: { top: 2, bottom: 3 }, ops: "add" })).items;
    expect(longer.every((it) => String(it.column.a).length === 2 && String(it.column.b).length === 3)).toBe(true);
    // «−» keeps the bottom no longer than the top
    expect(normalizeBlock({ type: "column", id: "c", ops: "subtract", operands: { top: 2, bottom: 3 } }).operands.bottom).toBe(2);
  });

  it("«строкой»: 347 + 28 = ☐ in a line — the column goes in the notebook, the answer is graded", () => {
    const block = colBlock({ form: "line", operands: { top: 3, topZeros: [0], bottom: 2 }, ops: "add", regroup: "with" });
    const { items, maxNumber } = buildBlock(block);
    for (const it of items) {
      expect(it.grid).toBeUndefined();
      expect(it.tokens.map((t) => t.t)).toEqual(["num", "op", "num", "eq", "blank"]);
      expect(it.answers[0]).toBe(it.line.a + it.line.b);
      expect(it.line.a % 10).toBe(0);
    }
    expect(maxNumber).toBeGreaterThanOrEqual(Math.max(...items.map((it) => it.answers[0])));
    const t = normalizeTest({ title: "С", blocks: [block] });
    expect(blanksOf(layoutTest(t)).filter((b) => !b.aux)).toHaveLength(12);
  });

  it("«Новый разряд» off: the answer keeps the longer number's width (a sheet «до 100» stays under 100)", () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      for (const it of buildBlock(colBlock({ operands: { top: 2, bottom: 2 }, ops: "both", regroup: "with", newPlace: false, seed })).items) {
        expect(String(it.answers[0])).toHaveLength(2);
      }
    }
  });

  it("a block saved with the old «Разрядность» opens as cells", () => {
    expect(normalizeBlock({ type: "column", id: "c", size: "3+1" }).operands).toEqual({ top: 3, topZeros: [], bottom: 1, bottomZeros: [] });
  });

  it("digits stand in cells: places right-aligned, the answer box under the places", () => {
    const { items } = buildBlock(colBlock({ size: "3+2", ops: "add" }));
    for (const it of items) {
      const w = it.grid.w;
      const units = it.tokens.filter((t) => t.t === "digit" && t.pos === 0);
      expect(units.every((t) => t.c === w - 1)).toBe(true);
      const box = it.tokens.find((t) => t.t === "blank" && t.kind === "num");
      expect(box.c + box.w).toBe(w);
      expect(box.w).toBe(String(it.answers[0]).length);
      for (const t of it.tokens) { expect(Number.isInteger(t.c)).toBe(true); expect(t.c + (t.w ?? 1)).toBeLessThanOrEqual(w); }
    }
  });

  it("marks are aux (not graded), the answer is one box per example", () => {
    const t = normalizeTest({ title: "С", blocks: [colBlock({ count: 4 })] });
    const blanks = blanksOf(layoutTest(t));
    expect(blanks.filter((b) => !b.aux).length).toBe(4);
    expect(blanks.filter((b) => b.aux).every((b) => b.kind === "mark")).toBe(true);
  });

  it("a crossed digit and a mark are drawn (on paper too, for «PDF с решением»)", () => {
    const t = normalizeTest({ title: "С", blocks: [colBlock({ count: 2, ops: "subtract", regroup: "with" })] });
    const layout = layoutTest(t);
    const prims = pagePrimitives(layout, 0, { test: t, values: { "c:0:x1": "x", "c:0:m1": "4" } });
    expect(prims.some((p) => p.k === "line" && p.stroke === "#1d4ed8")).toBe(true);
    expect(prims.some((p) => p.k === "text" && p.text === "4" && p.fill === "#1d4ed8")).toBe(true);
    // no tap targets or dashed boxes on paper
    expect(prims.some((p) => p.role === "cross" || p.dash)).toBe(false);
  });
});

describe("math_tests screen layout («Решать на экране»)", () => {
  const test = normalizeTest({
    title: "Э",
    blocks: [
      normalizeBlock({ type: "one", id: "a", seed: 1, count: 12, maxNumber: 20 }),
      normalizeBlock({ type: "chain", id: "b", seed: 2, count: 4, steps: 4, maxNumber: 20 }),
      colBlock({ id: "d", size: "3+3" }),
      normalizeBlock({ type: "cmp_two", id: "e", seed: 4, count: 8 }),
    ],
  });

  it("one page as wide as the screen, every item inside its frame", () => {
    for (const cols of [13, 14, 20, 37, 48]) {
      const { grid, pages } = layoutTest(test, { screenCols: cols });
      expect(pages.length).toBe(1);
      expect(grid.cols).toBeGreaterThanOrEqual(cols);
      for (const b of pages[0].blocks) for (const it of b.items) expect(it.c0 + it.width).toBeLessThanOrEqual(grid.cols - 2);
    }
  });

  it("a phone fits two column examples side by side", () => {
    const { pages } = layoutTest(normalizeTest({ title: "Э", blocks: [colBlock({ size: "2+2" })] }), { screenCols: 14 });
    const c0s = new Set(pages[0].blocks[0].items.map((it) => it.c0));
    expect(c0s.size).toBe(2);
  });

  it("the boxes have the same keys as on paper (the answers go into «PDF с решением»)", () => {
    const keys = (l) => blanksOf(l).map((b) => b.key).sort();
    expect(keys(layoutTest(test, { screenCols: 14 }))).toEqual(keys(layoutTest(test)));
  });
});
