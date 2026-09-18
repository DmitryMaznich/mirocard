import { test } from "node:test";
import assert from "node:assert/strict";
import { fitFigureToGrid } from "./figure-jsons.mjs";

test("fitFigureToGrid centres a mirror figure and keeps one-cell margins", () => {
  const fitted = fitFigureToGrid({
    id: "yachta", label: "Яхта", taskKind: "mirror", columns: 40, rows: 20, axisCol: 20,
    sourcePaths: [[
      { col: 20, row: 12 }, { col: 20, row: 6 }, { col: 15, row: 12 }, { col: 20, row: 12 },
      { col: 20, row: 16 }, { col: 16, row: 16 }, { col: 14, row: 13 }, { col: 20, row: 13 },
    ]],
    sourceCircles: [
      { col: 16.5, row: 14.5, diameter: 1, placement: "cell" },
      { col: 18.5, row: 14.5, diameter: 1, placement: "cell" },
    ],
  });

  assert.equal(fitted.columns, 14);
  assert.equal(fitted.rows, 12);
  assert.equal(fitted.axisCol, 7);
  assert.deepEqual(fitted.sourcePaths[0][0], { col: 7, row: 7 });
  assert.deepEqual(fitted.sourcePaths[0][6], { col: 1, row: 8 });
  assert.deepEqual(fitted.sourceCircles.map((circle) => circle.col), [3.5, 5.5]);
});

test("fitFigureToGrid crops both panels of a repeat card consistently", () => {
  const fitted = fitFigureToGrid({
    id: "repeat_test", label: "Повтори", taskKind: "repeat", columns: 20, rows: 12, axisCol: 10,
    sourcePaths: [[{ col: 3, row: 4 }, { col: 5, row: 7 }]],
  });

  assert.equal(fitted.columns, 8);
  assert.equal(fitted.axisCol, 4);
  assert.equal(fitted.rows, 5);
  assert.deepEqual(fitted.sourcePaths[0], [{ col: 1, row: 1 }, { col: 3, row: 4 }]);
});

test("fitFigureToGrid preserves dictation commands while moving the start", () => {
  const fitted = fitFigureToGrid({
    id: "dictation_test", label: "Диктант", taskKind: "dictation", columns: 20, rows: 20,
    start: { col: 8, row: 9 }, commands: [{ direction: "right", cells: 3 }, { direction: "up", cells: 2 }],
  });

  assert.equal(fitted.columns, 5);
  assert.equal(fitted.rows, 4);
  assert.deepEqual(fitted.start, { col: 1, row: 3 });
  assert.deepEqual(fitted.commands, [{ direction: "right", cells: 3 }, { direction: "up", cells: 2 }]);
});
