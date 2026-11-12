import { describe, expect, it } from "vitest";
import { layoutTest, blanksOf, pagePrimitives, gridOf } from "./layout.js";
import { newBlock, normalizeBlock, buildBlock, isAnswerRight, KIND_IDS } from "./blocks.js";
import { LIBRARY, testFromLibrary, normalizeTest } from "./store.js";

const testOf = (blocks, patch = {}) => normalizeTest({ title: "Т", blocks: blocks.map((b, i) => normalizeBlock({ ...b, id: `b${i}`, seed: 7 + i })), ...patch });

describe("math_tests layout", () => {
  it("puts every token on whole cells inside the frame", () => {
    for (const type of KIND_IDS) {
      const t = testOf([{ type, count: 12, maxNumber: 20, changeMax: 10 }]);
      const { grid, pages } = layoutTest(t);
      for (const b of pages[0].blocks) {
        for (const it of b.items) {
          expect(it.c0).toBeGreaterThanOrEqual(2);
          expect(it.c0 + it.width).toBeLessThanOrEqual(grid.cols - 2);
          expect(it.r).toBeLessThan(b.r0 + b.h);
          for (const tok of it.tokens) expect(Number.isInteger(tok.c)).toBe(true);
        }
      }
    }
  });

  it("starts a new page instead of cutting a block", () => {
    const blocks = Array.from({ length: 8 }, () => ({ type: "chain", count: 6, steps: 4, cols: 1 }));
    const { grid, pages } = layoutTest(testOf(blocks));
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) for (const b of p.blocks) expect(b.r0 + b.h).toBeLessThanOrEqual(grid.rows);
  });

  it("A5 and the big cell give a smaller grid", () => {
    expect(gridOf({ format: "a4", paper: "cell" })).toMatchObject({ cols: 40, rows: 57 });
    expect(gridOf({ format: "a5", paper: "cell" }).cols).toBe(27);
    expect(gridOf({ format: "a4", paper: "bigcell" }).cols).toBe(26);
  });

  it("an answer box is as wide as the biggest number", () => {
    const small = blanksOf(layoutTest(testOf([{ type: "one", maxNumber: 5 }])));
    const big = blanksOf(layoutTest(testOf([{ type: "one", maxNumber: 20 }])));
    expect(small.every((b) => b.w === 1)).toBe(true);
    expect(big.every((b) => b.w === 2)).toBe(true);
    const signs = blanksOf(layoutTest(testOf([{ type: "sign" }])));
    expect(signs.every((b) => b.kind === "sign" && b.w === 1)).toBe(true);
  });

  it("shows the right answer over a wrong box", () => {
    const t = testOf([{ type: "one", count: 2 }]);
    const layout = layoutTest(t);
    const [first] = blanksOf(layout);
    const prims = pagePrimitives(layout, 0, { test: t, values: { [first.key]: "0" }, marks: { [first.key]: "wrong" } });
    expect(prims.some((p) => p.k === "text" && p.text === String(first.answer) && p.fill === "#1f7a4f")).toBe(true);
  });

  it("every ready sheet fits its pages", () => {
    for (const entry of LIBRARY) {
      const { overflow, pages } = layoutTest(testFromLibrary(entry));
      expect(overflow, entry.id).toBe(false);
      expect(pages.length, entry.id).toBe(1);
    }
  });
});

describe("math_tests blocks", () => {
  it("the same seed gives the same examples, another seed others", () => {
    const a = normalizeBlock({ type: "one", id: "x", seed: 5 });
    expect(buildBlock(a).items).toEqual(buildBlock({ ...a }).items);
    expect(buildBlock({ ...a, seed: 6 }).items).not.toEqual(buildBlock(a).items);
  });
  it("checks numbers and signs", () => {
    expect(isAnswerRight(9, "9")).toBe(true);
    expect(isAnswerRight(9, "09")).toBe(true);
    expect(isAnswerRight(9, "")).toBe(false);
    expect(isAnswerRight("add", "add")).toBe(true);
    expect(isAnswerRight("add", "subtract")).toBe(false);
  });
  it("new blocks get their own id and seed", () => {
    const a = newBlock("multi");
    const b = newBlock("multi");
    expect(a.id).not.toBe(b.id);
    expect(a.steps).toBe(2);
  });
});
