import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DrawingRenderer from '../index.jsx';
import { generateTasks } from '../engine.js';
import { STYLES, styleSteps } from './styles.js';
import { back, chooseShape, freshPortrait, next, pick, portraitKey, readPortrait, stepCount, validPortrait } from './state.js';
import { LIFT_MS, splitSubpaths, timeline, timelineEnd } from './drawPath.js';
import { colorSteps, paintLesson, transformPath } from './paintPlan.js';

describe('portrait styles', () => {
  it('«Простое лицо»: three faces, seven steps of six variants, finite paths and a place for every step', () => {
    expect(STYLES.simple.faces).toHaveLength(3); expect(stepCount('simple')).toBe(7);
    for (let shape = 0; shape < 3; shape++) {
      const steps = styleSteps('simple', shape);
      expect(steps.map(s => s.name)).toEqual(['Глаза', 'Брови', 'Нос', 'Рот', 'Уши', 'Волосы', 'Шея']);
      for (const step of steps) {
        expect(step.variants).toHaveLength(6); expect(step.places.length).toBeGreaterThan(0);
        for (const v of step.variants) { expect(v.label).toBeTruthy(); expect(v.d).not.toMatch(/NaN|undefined/); }
      }
    }
  });
  it('«Простое лицо» draws paired parts on both sides of the face', () => {
    const steps = styleSteps('simple', 1);
    for (const index of [0, 1, 4]) for (const v of steps[index].variants) expect(splitSubpaths(v.d).length % 2).toBe(0);
  });
  it('«Простое лицо»: every eye variant has a pupil', () => {
    for (const shape of [0, 1, 2]) expect(styleSteps('simple', shape)[0].variants.every(v => splitSubpaths(v.fill).length === 2)).toBe(true);
  });
  it('«Простое лицо» brows are level (no emotion) and the neck starts at the chin', () => {
    for (const shape of [0, 1, 2]) {
      const steps = styleSteps('simple', shape);
      for (const v of steps[1].variants) for (const sub of splitSubpaths(v.d)) {
        const ys = [...sub.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => +m[2]);
        expect(Math.abs(ys[0] - ys.at(-1))).toBeLessThan(.01);
      }
      expect(steps[6].variants.every(v => v.d.startsWith('M'))).toBe(true);
    }
  });
  it('hair along the top of the head ends on the right side, never jumps back to the left', () => {
    for (const shape of [0, 1, 2]) for (const v of styleSteps('simple', shape)[5].variants) {
      const xs = [...v.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => +m[1]);
      if (v.label === 'Шапочка' || v.label === 'Зигзаг' || v.label === 'Длинные') expect(xs.at(-1)).toBeGreaterThan(110);
    }
  });
  it('«Пикассо» keeps the prototype: seven steps, hair placed per face shape', () => {
    expect(stepCount('picasso')).toBe(7);
    expect(styleSteps('picasso', 0)[6].transform).not.toBe(styleSteps('picasso', 1)[6].transform);
  });
});

describe('portrait state', () => {
  it('walks shape → parts → done and steps back one choice at a time', () => {
    let s = chooseShape(freshPortrait('simple'), 1);
    expect(next(s)).toBe(s);
    for (let i = 0; i < 7; i++) { s = next(pick(s, (i % 6) + 1)); }
    expect(s).toMatchObject({ phase: 'done', style: 'simple', results: [1, 2, 3, 4, 5, 6, 1] });
    s = back(s); expect(s).toMatchObject({ phase: 'part', results: [1, 2, 3, 4, 5, 6], value: 1 });
    expect(validPortrait(s)).toBe(true); expect(pick(s, 7)).toBe(s);
  });
  it('reads a pre-style save as Picasso and starts over when the adult chose another style', () => {
    localStorage.setItem('k', JSON.stringify({ version: 1, phase: 'part', shape: 0, results: [1, 2], value: null }));
    expect(readPortrait('k', 'picasso')).toMatchObject({ style: 'picasso', results: [1, 2] });
    expect(readPortrait('k', 'simple')).toEqual(freshPortrait('simple'));
    localStorage.setItem('k', '{'); expect(readPortrait('k', 'picasso')).toEqual(freshPortrait('picasso'));
  });
  it('makes one portrait task from the first-lines card', () => {
    const tasks = generateTasks({ type: 'drawing_portrait' }, [{ id: 'c', conceptId: 'x', firstLines: { kind: 'short_line' } }], 15, {});
    expect(tasks).toEqual([{ type: 'drawing_portrait', id: 'portrait', cardId: 'c', conceptId: 'x' }]);
  });
  it('times each stroke by its length with a pencil lift between them', () => {
    const spans = timeline([{ length: 100 }, { length: 300 }]);
    expect(spans[1].start).toBe(spans[0].ms + LIFT_MS); expect(spans[1].ms).toBeCloseTo(spans[0].ms * 3, 5);
    expect(timelineEnd(spans)).toBeLessThanOrEqual(2200);
  });
});

describe('portrait screen', () => {
  let root, host;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear();
    HTMLDialogElement.prototype.showModal ??= function () { this.open = true; };
    HTMLDialogElement.prototype.close ??= function () { this.open = false; };
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
  const render = async (params = {}) => act(async () => root.render(<DrawingRenderer task={{ type: 'drawing_portrait', id: 'portrait' }} student={{ id: 'kid' }} sessionParams={params} />));
  const click = async el => act(async () => el.click());
  const label = name => host.querySelector(`[aria-label="${name}"]`);

  it('«Простое лицо» by default: tap the variant with the same pips, ▶ shows it again, seven steps to the portrait', async () => {
    await render();
    expect(host.querySelector('.portrait').dataset.style).toBe('simple');
    await click(label('Овальное'));
    expect(host.querySelector('h2').textContent).toBe('Глаза');
    expect(host.querySelector('.portrait-next')).toBeNull(); expect(label('Показать, как рисовать')).toBeNull();
    const options = host.querySelectorAll('.portrait-option');
    expect(options).toHaveLength(6);
    await click(options[1]);
    expect(options[1].getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.portrait-face__current path')).not.toBeNull();
    expect(label('Показать, как рисовать')).not.toBeNull();
    for (let i = 0; i < 7; i++) {
      if (i) await click(host.querySelectorAll('.portrait-option')[0]);
      await click(host.querySelector('.portrait-next'));
    }
    expect(host.querySelector('.portrait').dataset.phase).toBe('done');
    expect(JSON.parse(localStorage.getItem(portraitKey('kid')))).toMatchObject({ style: 'simple', phase: 'done', shape: 1, results: [2, 1, 1, 1, 1, 1, 1] });
    // One primary action, no home button: leaving the lesson is only the shared header's ✕.
    expect(label('Закончить')).toBeNull(); expect(label('Новый портрет')).toBeNull();
    expect(host.querySelectorAll('.portrait-next')).toHaveLength(1); expect(label('Раскрасить')).not.toBeNull();
  });
  it('«Пикассо» when the adult chose it: seven steps', async () => {
    await render({ style: 'picasso' });
    await click(label('Фантазийное'));
    expect(host.querySelector('h2').textContent).toBe('Левый глаз');
    expect(host.querySelector('[aria-label="Шаг 1 из 7"]')).not.toBeNull();
    // Card icons stay in their own space (a face transform pushed them off the card, 2026-11-15).
    expect([...host.querySelectorAll('.portrait-option svg g')].every(g => !g.getAttribute('transform'))).toBe(true);
  });
  it('screen die: variants are not tappable, a throw picks one by itself', async () => {
    vi.useFakeTimers();
    await render({ dice: 'screen' });
    await click(label('Круглое'));
    expect([...host.querySelectorAll('.portrait-option')].every(b => b.disabled)).toBe(true);
    await click(label('Бросить кубик'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(host.querySelectorAll('.portrait-option[aria-pressed="true"]')).toHaveLength(1);
    expect(label('Бросить кубик')).toBeNull(); expect(host.querySelector('.portrait-next')).not.toBeNull();
  });
  it('colouring after the portrait: every colour is picked by tap (no die); the coloured portrait is kept', async () => {
    localStorage.setItem(portraitKey('kid'), JSON.stringify({ version: 2, style: 'simple', phase: 'done', shape: 1, results: [1, 1, 1, 6, 2, 2, 2], colors: [], value: null }));
    await render();
    await click(label('Раскрасить'));
    expect(host.querySelector('h2').textContent).toBe('Лицо');
    const skin = host.querySelectorAll('.portrait-color');
    expect(skin).toHaveLength(6); expect(skin[0].querySelector('.portrait-die')).toBeNull();
    await click(skin[3]); await click(host.querySelector('.portrait-next'));
    expect(host.querySelector('h2').textContent).toBe('Волосы');
    expect(host.querySelectorAll('.portrait-color .portrait-die')).toHaveLength(0);
    for (const name of ['Волосы', 'Одежда', 'Глаза', 'Губы']) {
      expect(host.querySelector('h2').textContent).toBe(name);
      await click(host.querySelectorAll('.portrait-color')[1]); await click(host.querySelector('.portrait-next'));
    }
    expect(host.querySelector('.portrait').dataset.phase).toBe('colored');
    expect(JSON.parse(localStorage.getItem(portraitKey('kid')))).toMatchObject({ phase: 'colored', colors: [4, 2, 2, 2, 2] });
    expect(host.querySelectorAll('.portrait-next')).toHaveLength(1);
    await click(label('Новый портрет'));
    expect(host.querySelectorAll('.portrait-shape')).toHaveLength(3);
  });
  it('builds the colouring lesson painter-wise: outline, then skin, hair, clothes, eyes (iris inside the eye), lips', () => {
    const results = [1, 1, 1, 6, 2, 2, 2], plan = colorSteps('simple', 1, results);
    expect(plan.map(s => s.group)).toEqual(['skin', 'hair', 'clothes', 'eyes', 'lips']);
    const { lesson, ends } = paintLesson('simple', 1, results, [1, 1, 1, 1, 1]);
    expect(lesson.steps[0]).toMatchObject({ kind: 'stroke', tool: 'black' });
    expect(ends).toHaveLength(6); expect(ends.at(-1)).toBe(lesson.steps.length);
    const eyes = lesson.steps.slice(ends[3], ends[4]);
    expect(eyes.every(s => s.kind === 'color' && s.clip)).toBe(true);
    expect(lesson.steps.filter(s => s.kind === 'color').every(s => s.fill.startsWith('#'))).toBe(true);
    // Only areas are coloured: a line mouth has no lips step, brows are never recoloured.
    expect(colorSteps('simple', 1, [1, 1, 1, 2, 2, 2, 2]).map(s => s.group)).toEqual(['skin', 'hair', 'clothes', 'eyes']);
    expect(lesson.steps.slice(1).every(s => s.kind === 'color')).toBe(true);
    // The face is hatched around the eyes, mouth and hair: their shapes are even-odd holes, clipped to the face.
    const face = lesson.steps[1];
    expect(face.clip).toBeTruthy(); expect(splitSubpaths(face.d).length).toBeGreaterThan(4);
  });
  it('moves Picasso parts onto the sheet for colouring (translate + scale, relative arcs too)', () => {
    expect(transformPath('M10 20 L30 40 a5 5 0 1 0 10 0Z', 'translate(43 66) scale(.39)')).toBe('M46.9 73.8 L54.7 81.6 a1.95 1.95 0 1 0 3.9 0 Z');
    expect(colorSteps('picasso', 0, [1, 2, 3, 4, 5, 6, 1]).map(s => s.group)).toEqual(['skin', 'hair', 'eyes', 'lips']);
    // Picasso hair is coloured as a mass (a closed area), never as a traced line.
    for (let v = 1; v <= 6; v++) expect(paintLesson('picasso', 0, [1, 2, 3, 4, 5, 6, v], [1, 1, 1, 1]).lesson.steps.filter(s => s.kind === 'stroke')).toHaveLength(1);
  });
  it('the adult menu opens with an ordinary tap and has no own exit (the shared header ✕ does that)', async () => {
    await render();
    await click(label('Для взрослого'));
    const dialog = host.querySelector('dialog');
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Распечатать контур лица');
    expect(dialog.textContent).not.toContain('Закончить занятие'); expect(dialog.textContent).not.toMatch(/удержива/i);
  });
  it('continues after a reload with the chosen variant', async () => {
    localStorage.setItem(portraitKey('kid'), JSON.stringify({ version: 2, style: 'simple', phase: 'part', shape: 2, results: [1, 2], value: 4 }));
    await render();
    expect(host.querySelector('h2').textContent).toBe('Нос');
    expect(host.querySelector('.portrait-option[aria-pressed="true"]').getAttribute('aria-label')).toBe('4: Уголок');
  });
});
