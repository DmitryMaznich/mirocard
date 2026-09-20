import { test } from "node:test";
import assert from "node:assert/strict";
import { fitFigureToGrid, normalizeFigureGridNoise, readTopic, validateFigureCard } from "./figure-jsons.mjs";

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

test("fixed geometry is validated and follows the source when fitting the grid", () => {
  const fitted = fitFigureToGrid({
    id: "fixed_test", label: "Фигура с готовым элементом", taskKind: "mirror", columns: 10, rows: 10, axisCol: 5,
    sourcePaths: [[{ col: 3, row: 3 }, { col: 5, row: 4 }]],
    fixedPaths: [[{ col: 2, row: 2 }, { col: 3, row: 2 }]],
    fixedDots: [{ col: 4, row: 3 }],
    fixedCircles: [{ col: 3.5, row: 4.5, diameter: 1, placement: "cell" }],
  });

  assert.deepEqual(fitted.sourcePaths[0], [{ col: 2, row: 2 }, { col: 4, row: 3 }]);
  assert.deepEqual(fitted.fixedPaths[0], [{ col: 1, row: 1 }, { col: 2, row: 1 }]);
  assert.deepEqual(fitted.fixedDots, [{ col: 3, row: 2 }]);
  assert.deepEqual(fitted.fixedCircles, [{ col: 2.5, row: 3.5, diameter: 1, placement: "cell" }]);
  assert.doesNotThrow(() => validateFigureCard(fitted));
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

test("fitFigureToGrid corrects a stale dictation canvas around its real route", () => {
  const fitted = fitFigureToGrid({
    id: "stale_canvas", label: "Старая сетка", taskKind: "dictation", columns: 11, rows: 9,
    start: { col: 2, row: 10 }, commands: [{ direction: "up", cells: 5 }, { direction: "right", cells: 3 }],
  });

  assert.equal(fitted.rows, 7);
  assert.deepEqual(fitted.start, { col: 1, row: 6 });
  assert.doesNotThrow(() => validateFigureCard(fitted));
});

test("normalizeFigureGridNoise keeps real fractions but removes workshop pointer noise", () => {
  const corrected = normalizeFigureGridNoise({
    id: "symmetry_crown", label: "Корона", taskKind: "mirror", columns: 12, rows: 6, axisCol: 6,
    sourcePaths: [[
      { col: 0.04, row: 2.9 }, { col: 2.05, row: 1.06 }, { col: 3.5, row: 3.02 }, { col: 6.05, row: 0.98 },
    ]],
  });

  assert.deepEqual(corrected.sourcePaths[0], [
    { col: 0, row: 3 }, { col: 2, row: 1 }, { col: 3.5, row: 3 }, { col: 6, row: 1 },
  ]);
  assert.doesNotThrow(() => validateFigureCard(corrected));
});

test("normalizeFigureGridNoise corrects a slightly missed edge without moving half-cells", () => {
  const corrected = normalizeFigureGridNoise({
    id: "edge_noise", label: "Шум у края", taskKind: "mirror", columns: 12, rows: 10, axisCol: 6,
    sourcePaths: [[{ col: 6, row: 1.16 }, { col: 3.5, row: 10.16 }]],
  });

  assert.deepEqual(corrected.sourcePaths[0], [{ col: 6, row: 1 }, { col: 3.5, row: 10 }]);
  assert.doesNotThrow(() => validateFigureCard(corrected));
});

test("drawing drills loop until an adult closes the session", () => {
  const topic = readTopic();
  const drawingModes = ["graphic_dictation", "repeat_draw", "symmetry_draw"];

  for (const modeId of drawingModes) {
    assert.equal(topic.modes.find((mode) => mode.id === modeId)?.loop, true, `${modeId} must loop`);
  }
});
