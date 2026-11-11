import { describe, expect, it } from "vitest";
import { normalizeBlock, buildBlock, isAnswerRight } from "./blocks.js";
import { layoutTest, blanksOf, pagePrimitives } from "./layout.js";
import { normalizeTest } from "./store.js";
import { sideValue } from "./compare.js";

const relOf = (a, b) => (a < b ? "<" : a > b ? ">" : "=");

describe("math_tests «Сравнение»", () => {
  for (const type of ["cmp_nums", "cmp_expr", "cmp_two"]) {
    for (const maxNumber of [10, 20, 100]) {
      it(`${type} до ${maxNumber}: the answer is the true relation, numbers in range`, () => {
        for (let seed = 1; seed <= 40; seed += 1) {
          const block = normalizeBlock({ type, maxNumber, count: 12, id: "c", seed });
          const { items } = buildBlock(block);
          expect(items.length).toBe(12);
          for (const it of items) {
            const at = it.tokens.findIndex((t) => t.t === "blank");
            expect(it.tokens[at]).toMatchObject({ kind: "cmp", i: 0 });
            const left = sideValue(it.tokens.slice(0, at));
            const right = sideValue(it.tokens.slice(at + 1));
            expect(it.answers).toEqual([relOf(left, right)]);
            for (const t of it.tokens) if (t.t === "num") { expect(t.v).toBeGreaterThanOrEqual(0); expect(t.v).toBeLessThanOrEqual(maxNumber); }
          }
        }
      });
    }
  }

  it("all three signs come up", () => {
    const seen = new Set();
    for (let seed = 1; seed <= 10; seed += 1) for (const it of buildBlock(normalizeBlock({ type: "cmp_expr", count: 12, id: "c", seed })).items) seen.add(it.answers[0]);
    expect([...seen].sort()).toEqual(["<", "=", ">"]);
  });

  it("only + or only − when asked", () => {
    const { items } = buildBlock(normalizeBlock({ type: "cmp_two", ops: "subtract", count: 12, id: "c", seed: 3 }));
    for (const it of items) for (const t of it.tokens) if (t.t === "op") expect(t.op).toBe("subtract");
  });

  it("the box is one cell, a wrong answer shows the right sign", () => {
    const t = normalizeTest({ title: "С", blocks: [normalizeBlock({ type: "cmp_expr", id: "c", seed: 2 })] });
    const layout = layoutTest(t);
    const blanks = blanksOf(layout);
    expect(blanks.every((b) => b.kind === "cmp" && b.w === 1)).toBe(true);
    const b = blanks[0];
    const wrong = b.answer === "<" ? ">" : "<";
    const prims = pagePrimitives(layout, 0, { test: t, values: { [b.key]: wrong }, marks: { [b.key]: "wrong" } });
    expect(prims.some((p) => p.k === "path" && p.stroke === "#1f7a4f")).toBe(true);
    expect(isAnswerRight(b.answer, b.answer)).toBe(true);
    expect(isAnswerRight(b.answer, wrong)).toBe(false);
  });
});
