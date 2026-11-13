import { describe, expect, it } from 'vitest';
import { createShapeAttempt, restoreShape } from './shapeAttempt.js';
import { SHAPE_KINDS, partPoint, transformPoint, demonstrationFrame, shapeDefinition } from './shapes.js';
import { readSheet, saveSheet } from './checkpoint.js';
import { SCREENSHOT_ZIGZAG } from './testPaths.js';
const world = (part, p) => transformPoint(p, part.frame);
function drawPart(a, i, noise = 0, lifts = false) {
  const part = a.shape.parts[i], steps = part.type === 'line' ? 36 : 160;
  a.begin(world(part, partPoint(part, 0)), 0);
  for (let n = 1; n <= steps; n++) {
    const p = partPoint(part, n / steps);
    const actual = world(part, { x: p.x + Math.sin(n) * noise, y: p.y + Math.cos(n) * noise });
    a.move(actual, n * 20);
    if (lifts && n % 20 === 0 && n < steps) { a.end(); expect(a.begin(actual, n * 20)).toBe(true); }
  }
  return a.end();
}
describe('shape geometry and card boundaries', () => {
  for (const kind of SHAPE_KINDS) it(`${kind}: accepts the whole figure with small natural unevenness and lifts`, () => {
    const a = createShapeAttempt(kind);
    for (let i = 0; i < a.shape.parts.length; i++) expect(drawPart(a, i, 4, true)).toBe(i === a.shape.parts.length - 1);
    expect(a.state.done).toBe(true); expect(a.state.hadError).toBe(false);
  });
  for (const kind of SHAPE_KINDS.slice(0, 4)) it(`${kind}: rejects the reported zigzag in its rotated coordinates`, () => {
    const a = createShapeAttempt(kind), part = a.shape.parts[0]; let errors = 0;
    a.begin(world(part, { x: SCREENSHOT_ZIGZAG[0][0], y: SCREENSHOT_ZIGZAG[0][1] }));
    SCREENSHOT_ZIGZAG.slice(1).forEach(([x,y], i) => { if (a.move(world(part, {x,y}), i * 100).mistake) errors++; });
    expect(a.end()).toBe(false); expect(errors).toBe(1);
    expect(drawPart(a, 0)).toBe(true); expect(a.state.hadError).toBe(true);
  });
  for (const kind of ['circle', 'oval']) {
    it(`${kind}: touching the shared start/end dot never completes`, () => {
      const a = createShapeAttempt(kind), p = partPoint(a.shape.parts[0], 0);
      expect(a.begin(p)).toBe(true); expect(a.end()).toBe(false); expect(a.state.hadError).toBe(false);
    });
    it(`${kind}: a shortcut through the centre is an error, and correction preserves ink`, () => {
      const a = createShapeAttempt(kind), part = a.shape.parts[0];
      a.begin(partPoint(part, 0)); expect(a.move({ x: 500, y: 500 }, 500).mistake).toBe(true); a.end();
      expect(a.state.done).toBe(false); const strokes = a.state.parts[0].strokes.length;
      // Resume from the last accepted point rather than deleting the work.
      const anchor = a.state.parts[0].anchor; expect(a.begin(anchor)).toBe(true);
      for (let i = 0; i <= 160; i++) a.move(partPoint(part, i / 160), i * 20);
      expect(a.end()).toBe(true); expect(a.state.parts[0].strokes.length).toBeGreaterThan(strokes);
    });
    it(`${kind}: an incomplete or unclosed contour is not credited`, () => {
      const a = createShapeAttempt(kind), part = a.shape.parts[0]; a.begin(partPoint(part, 0));
      for (let i = 1; i <= 140; i++) a.move(partPoint(part, i / 160), i * 20);
      expect(a.end()).toBe(false); expect(a.state.hadError).toBe(false);
    });
  }
  it('distinguishes an oval from a circle within the broad road', () => {
    const a = createShapeAttempt('oval', undefined, 'wide');
    a.begin(partPoint(a.shape.parts[0], 0));
    for (let i = 1; i <= 160; i++) { const angle = -Math.PI / 2 + 2 * Math.PI * i / 160; a.move({ x: 500 + 150 * Math.cos(angle), y: 530 + 150 * Math.sin(angle) }, i * 20); }
    expect(a.end()).toBe(false); expect(a.state.hadError).toBe(true);
  });
  it('square: an error on a later side preserves finished sides and reports once per figure', () => {
    const a = createShapeAttempt('square'); expect(drawPart(a, 0)).toBe(false);
    const first = structuredClone(a.state.parts[0]); let mistakes = 0;
    for (let side = 1; side <= 2; side++) {
      const part = a.shape.parts[side]; a.begin(world(part, partPoint(part, 0)));
      if (a.move(world(part, {x: 450, y: 700}), 400).mistake) mistakes++;
      a.end(); expect(drawPart(a, side)).toBe(false);
    }
    expect(a.state.parts[0]).toEqual(first); expect(mistakes).toBe(1);
    expect(drawPart(a, 3)).toBe(true); expect(a.state.hadError).toBe(true);
  });
  it('technical cancellation cannot complete a side or a card', () => {
    const a = createShapeAttempt('square'); const part = a.shape.parts[0];
    a.begin(world(part, partPoint(part, 0))); a.move(world(part, partPoint(part, 1)), 500);
    expect(a.end(true)).toBe(false); expect(a.state.part).toBe(0); expect(a.state.hadError).toBe(false);
  });
  it('restores current side, real ink and spent attempt, and bounds sheets to four slots', () => {
    const a = createShapeAttempt('square'); drawPart(a, 0);
    const restored = createShapeAttempt('square', restoreShape({ version: 2, attempt: a.state }, 'square'));
    expect(restored.state.part).toBe(1);
    for (let i=1; i<4; i++) drawPart(restored,i);
    localStorage.clear(); saveSheet('drawing-sheet:test', 0, restored.state);
    expect(readSheet('drawing-sheet:test')[0]).toEqual(restored.state);
    expect(readSheet('drawing-sheet:test').slice(1)).toEqual([null,null,null]);
    expect(restoreShape({version:2,attempt:restored.state},'oval').done).toBe(false);
  });
});

it('the square demonstration stops at every corner and explicitly models lifting', () => {
  const shape = shapeDefinition('square');
  for (let side = 0; side < 4; side++) {
    const moving = demonstrationFrame(shape, side * 1200 + 400);
    expect(moving.progress).toBeGreaterThan(side / 4); expect(moving.progress).toBeLessThan((side + 1) / 4); expect(moving.lift).toBeNull();
    expect(demonstrationFrame(shape, side * 1200 + 950)).toEqual({ progress: (side + 1) / 4, lift: side });
  }
  expect(demonstrationFrame(shape, shape.motionMs).progress).toBe(1);
});
