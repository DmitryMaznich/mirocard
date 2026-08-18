import { test } from "node:test";
import assert from "node:assert/strict";
import { isCorrectMove, isCorrectTap } from "./gesture_match.mjs";

test("isCorrectMove accepts a drag that starts at start and ends at end", () => {
  const points = [
    { col: 2, row: 2 },
    { col: 3, row: 2 },
    { col: 4, row: 2 },
  ];
  assert.equal(isCorrectMove(points, { col: 2, row: 2 }, { col: 4, row: 2 }), true);
});

test("isCorrectMove rejects a drag that doesn't start near the active point", () => {
  const points = [
    { col: 8, row: 2 },
    { col: 9, row: 2 },
  ];
  assert.equal(isCorrectMove(points, { col: 2, row: 2 }, { col: 9, row: 2 }), false);
});

test("isCorrectTap accepts a single tap landing on the target", () => {
  assert.equal(isCorrectTap([{ col: 6.1, row: 4.9 }], { col: 6, row: 5 }), true);
});

test("isCorrectTap accepts a small jittery tap near the target", () => {
  const points = [
    { col: 5.9, row: 5.05 },
    { col: 6.05, row: 4.95 },
  ];
  assert.equal(isCorrectTap(points, { col: 6, row: 5 }), true);
});

test("isCorrectTap rejects a tap far from the target", () => {
  assert.equal(isCorrectTap([{ col: 1, row: 1 }], { col: 6, row: 5 }), false);
});

test("isCorrectTap rejects an empty gesture", () => {
  assert.equal(isCorrectTap([], { col: 6, row: 5 }), false);
});

test("isCorrectTap rejects a real drag that only ends near the target (not a tap)", () => {
  const points = [
    { col: 2, row: 2 },
    { col: 4, row: 3 },
    { col: 6, row: 5 },
  ];
  assert.equal(isCorrectTap(points, { col: 6, row: 5 }), false);
});
