import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rendererSource = await readFile(new URL("./renderer.js", import.meta.url), "utf8");

function answerGeometry() {
  const marker = "window.__MirocardRenderer = function SymmetryDrawRenderer";
  assert.ok(rendererSource.includes(marker), "renderer export marker is present");
  const instrumented = rendererSource.replace(marker, `window.__MirocardAnswerGeometry = { isOnMirrorAxis, omitSelfMirroredSegments, evaluateCoverage };\n  ${marker}`);
  const window = { __Mirocard: { React: {} } };
  new Function("window", instrumented)(window);
  return window.__MirocardAnswerGeometry;
}

test("axis-only parts of a mirror drawing are not requested again", () => {
  const { omitSelfMirroredSegments } = answerGeometry();
  const paths = [[
    { col: 7, row: 7 }, { col: 7, row: 1 }, // mast: already shown on the axis
    { col: 12, row: 7 }, { col: 7, row: 7 },
    { col: 7, row: 11 }, // keel: also already shown on the axis
    { col: 11, row: 11 }, { col: 13, row: 8 }, { col: 7, row: 8 },
  ]];

  assert.deepEqual(omitSelfMirroredSegments(paths, 7), [
    [{ col: 7, row: 1 }, { col: 12, row: 7 }, { col: 7, row: 7 }],
    [{ col: 7, row: 11 }, { col: 11, row: 11 }, { col: 13, row: 8 }, { col: 7, row: 8 }],
  ]);
});

test("a segment touching the axis remains part of the answer", () => {
  const { omitSelfMirroredSegments } = answerGeometry();
  assert.deepEqual(omitSelfMirroredSegments([[{ col: 7, row: 2 }, { col: 10, row: 5 }]], 7), [
    [{ col: 7, row: 2 }, { col: 10, row: 5 }],
  ]);
});

test("an axis-only drawing can be confirmed without a redundant stroke", () => {
  const { evaluateCoverage } = answerGeometry();
  const result = evaluateCoverage([], [], [], [], 0.7, 2);
  assert.equal(result.complete, true);
  assert.equal(result.total, 0);
});

test("mirror and repeat drawings use the same answer-outline feedback", () => {
  assert.doesNotMatch(rendererSource, /isRepeat && result \? targetSegments/);
  assert.match(rendererSource, /result \? targetSegments\.map\(\(segment, index\) => h\("line", \{/);
  assert.match(rendererSource, /symmetry-draw__answer-feedback--\$\{coveredSegments\.has\(index\) \? "covered" : "missed"\}/);
});
