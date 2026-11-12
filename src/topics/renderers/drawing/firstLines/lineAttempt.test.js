import { describe, expect, it } from 'vitest';
import { createLineAttempt, restoreAttempt } from './lineAttempt.js';
import { SCREENSHOT_ZIGZAG } from './testPaths.js';

const p = (x, y = 500) => ({ x, y });
function line(a, start = 320, end = 680) {
  expect(a.begin(p(start))).toBe(true);
  a.move(p(end), 500);
  return a.end();
}

describe('first short line', () => {
  for (const width of ['wide', 'normal', 'narrow']) {
    it(`${width}: rejects the screenshot's zigzag inside the road and accepts its correction`, () => {
      const a = createLineAttempt(undefined, width);
      expect(a.begin(p(...SCREENSHOT_ZIGZAG[0]))).toBe(true);
      let errors = 0;
      for (const xy of SCREENSHOT_ZIGZAG.slice(1)) errors += Number(a.move(p(...xy)).mistake);
      expect(a.end()).toBe(false); expect(errors).toBe(1);
      expect(a.state.errorKind).toBe('shape'); expect(a.state.progress).toBe(320);
      expect(a.state.strokes[0].points.length).toBeGreaterThan(10);
      expect(a.state.strokes[0].failedFrom).toBe(0);
      expect(line(a)).toBe(true); expect(a.state.hadError).toBe(true);
    });
  }
  for (const samples of [1, 5, 20]) {
    it(`has the same zigzag verdict with ${samples} samples per segment`, () => {
      const a = createLineAttempt(); a.begin(p(...SCREENSHOT_ZIGZAG[0]));
      let errors = 0;
      for (let i = 1; i < SCREENSHOT_ZIGZAG.length; i++) {
        const [x, y] = SCREENSHOT_ZIGZAG[i - 1], [xx, yy] = SCREENSHOT_ZIGZAG[i];
        for (let k = 1; k <= samples; k++) errors += Number(a.move(p(x + (xx - x) * k / samples, y + (yy - y) * k / samples)).mistake);
      }
      expect(a.end()).toBe(false); expect(errors).toBe(1);
    });
  }
  it('does not turn a zigzag into a straight line when the pen is lifted at each corner', () => {
    const a = createLineAttempt();
    for (let i = 1; i < SCREENSHOT_ZIGZAG.length && !a.state.needsReturn; i++) {
      expect(a.begin(p(...SCREENSHOT_ZIGZAG[i - 1]))).toBe(true);
      a.move(p(...SCREENSHOT_ZIGZAG[i])); a.end();
    }
    expect(a.state.hadError).toBe(true); expect(a.state.done).toBe(false);
    expect(a.state.errorKind).toBe('shape');
  });
  it('keeps small high-frequency tremor and a gentle bow acceptable', () => {
    for (const bow of [false, true]) {
      const a = createLineAttempt(); a.begin(p(320));
      for (let x = 321; x <= 680; x++) a.move(p(x, 500 + (bow ? 45 * Math.sin(Math.PI * (x - 320) / 360) : 8 * Math.sin(x * 2))));
      expect(a.end()).toBe(true); expect(a.state.hadError).toBe(false);
    }
  });
  it('keeps small tremor acceptable when the child lifts the pen frequently', () => {
    const a = createLineAttempt();
    let previous = p(320);
    for (let x = 332; x <= 680 && !a.state.done; x += 12) {
      expect(a.begin(previous)).toBe(true);
      previous = p(x, 500 + (x % 24 ? 8 : -8));
      expect(a.move(previous).mistake).toBe(false);
      a.end();
    }
    expect(a.state.done).toBe(true); expect(a.state.hadError).toBe(false);
  });
  it('rejects a loop inside the road and preserves earlier completed movement for the retry', () => {
    const a = createLineAttempt(); a.begin(p(320)); a.move(p(420)); a.end();
    const accepted = structuredClone(a.state.strokes[0]);
    a.begin(p(420)); a.move(p(448));
    for (let i = 1; i <= 32; i++) a.move(p(420 + 28 * Math.cos(i * 2 * Math.PI / 32), 500 + 28 * Math.sin(i * 2 * Math.PI / 32)));
    expect(a.end()).toBe(false); expect(a.state.errorKind).toBe('shape');
    expect(a.state.progress).toBe(420); expect(a.state.anchor).toEqual(p(420));
    expect(a.state.strokes[0]).toEqual(accepted);
    expect(a.begin(p(420))).toBe(true); a.move(p(680)); expect(a.end()).toBe(true);
  });
  for (const [width, size, error] of [['wide', 140, false], ['normal', 100, false], ['narrow', 60, true]]) {
    it(`${width}: applies the selected visible width to the boundary check`, () => {
      const a = createLineAttempt(undefined, width);
      expect(a.line.halfWidth * 2).toBe(size);
      expect(a.line.tolerance).toBe(size / 2 + 15);
      a.begin(p(320)); a.move(p(450), 100); a.move(p(450, 560), 200); a.move(p(520, 560), 400); a.move(p(680), 600);
      expect(a.state.hadError).toBe(error);
      expect(a.end()).toBe(!error);
    });
  }
  it('keeps the previous width for missing or unknown saved settings', () => {
    expect(createLineAttempt().line.halfWidth).toBe(50);
    expect(createLineAttempt(undefined, 'old-value').line.halfWidth).toBe(50);
    expect(createLineAttempt(undefined, 'toString').line.halfWidth).toBe(50);
  });
  it('needs a real movement from the start and a lift at the goal, not a tap or backwards shortcut', () => {
    const a = createLineAttempt();
    expect(a.begin(p(680))).toBe(false);
    expect(a.begin(p(320))).toBe(true);
    expect(a.end()).toBe(false);
    expect(line(a)).toBe(true);
    expect(a.begin(p(320))).toBe(false);
    expect(a.end()).toBe(false);
  });
  it('allows lifts and slight backward motion without erasing the accepted work', () => {
    const a = createLineAttempt();
    a.begin(p(320)); a.move(p(470), 200); expect(a.end()).toBe(false);
    expect(a.begin(p(650))).toBe(false);
    expect(a.begin(p(470))).toBe(true);
    a.move(p(450)); a.move(p(680), 500);
    expect(a.end()).toBe(true);
    expect(a.state.strokes).toHaveLength(2);
  });
  it('does not penalize boundary jitter or a brief small excursion', () => {
    const a = createLineAttempt();
    a.begin(p(320));
    for (let x = 330; x <= 600; x += 10) expect(a.move(p(x, 552 + (x % 20 ? 5 : -5)), x).mistake).toBe(false);
    a.move(p(605, 568), 610); a.move(p(610, 550), 620); a.move(p(680), 700);
    expect(a.end()).toBe(true); expect(a.state.hadError).toBe(false);
  });
  it('registers only one mistake and requires a lift and return, keeping both trails', () => {
    const a = createLineAttempt();
    a.begin(p(320)); a.move(p(450), 100);
    expect(a.move(p(450, 620), 220).mistake).toBe(true);
    expect(a.move(p(680), 400).mistake).toBe(false);
    expect(a.state.progress).toBeLessThan(500);
    expect(a.end()).toBe(false);
    expect(a.begin(p(680))).toBe(false);
    const anchor = { ...a.state.anchor };
    expect(a.begin(p(anchor.x, 563))).toBe(false);
    expect(a.begin(anchor)).toBe(true);
    a.move(p(480, 650), 600); a.end();
    expect(a.state.marks).toHaveLength(2);
    expect(a.begin(a.state.anchor)).toBe(true);
    a.move(p(680), 800); expect(a.end()).toBe(true);
    expect(a.state.strokes).toHaveLength(3);
    expect(a.state.strokes[0].failedFrom).not.toBeNull();
  });
  it('detects a slow short exit but not a stationary pen outside the edge', () => {
    const a = createLineAttempt(); a.begin(p(320)); a.move(p(450));
    a.move(p(450, 568), 100);
    expect(a.move(p(450, 568), 500).mistake).toBe(false);
    expect(a.move(p(466, 568), 600).mistake).toBe(true);
  });
  it('detects fast exits even with just one event; event sampling does not change the verdict', () => {
    for (const steps of [1, 3, 30]) {
      const a = createLineAttempt(); a.begin(p(320));
      let events = 0;
      for (let i = 1; i <= steps; i++) events += Number(a.move(p(320 + 120 * i / steps, 500 + 150 * i / steps), i).mistake);
      expect(events).toBe(1); expect(a.state.needsReturn).toBe(true);
    }
  });
  it('treats pointer cancellation as an interruption, never completion or a mistake', () => {
    const a = createLineAttempt(); a.begin(p(320)); a.move(p(680), 400);
    expect(a.end(true)).toBe(false); expect(a.state.hadError).toBe(false);
    expect(a.state.progress).toBe(680);
  });
  it('restores unfinished progress and a spent attempt without restoring capture', () => {
    const a = createLineAttempt(); a.begin(p(320)); a.move(p(480)); a.move(p(480, 700), 500);
    const saved = restoreAttempt(JSON.parse(JSON.stringify({ version: 1, attempt: a.state })));
    const b = createLineAttempt(saved);
    expect(b.active).toBe(false); expect(b.state.hadError).toBe(true);
    expect(b.state.strokes).toEqual(a.state.strokes);
    expect(b.begin(b.state.anchor)).toBe(true); b.move(p(680), 800);
    expect(b.end()).toBe(true);
    expect(restoreAttempt({ version: 1, attempt: { ...saved, progress: Infinity } }).strokes).toEqual([]);
  });
});
