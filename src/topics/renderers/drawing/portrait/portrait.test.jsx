import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DrawingRenderer from '../index.jsx';
import { generateTasks } from '../engine.js';
import { STYLES, styleSteps } from './styles.js';
import { back, chooseShape, freshPortrait, next, pick, portraitKey, readPortrait, stepCount, validPortrait } from './state.js';
import { LIFT_MS, splitSubpaths, timeline, timelineEnd } from './drawPath.js';

describe('portrait styles', () => {
  it('«Простое лицо»: three faces, five steps of six variants, finite paths and a place for every step', () => {
    expect(STYLES.simple.faces).toHaveLength(3); expect(stepCount('simple')).toBe(5);
    for (let shape = 0; shape < 3; shape++) {
      const steps = styleSteps('simple', shape);
      expect(steps.map(s => s.name)).toEqual(['Глаза', 'Нос', 'Рот', 'Уши', 'Волосы']);
      for (const step of steps) {
        expect(step.variants).toHaveLength(6); expect(step.places.length).toBeGreaterThan(0);
        for (const v of step.variants) { expect(v.label).toBeTruthy(); expect(v.d).not.toMatch(/NaN|undefined/); }
      }
    }
  });
  it('«Простое лицо» draws paired parts on both sides of the face', () => {
    const steps = styleSteps('simple', 1);
    for (const index of [0, 3]) for (const v of steps[index].variants) expect(splitSubpaths(v.d).length % 2).toBe(0);
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
    for (let i = 0; i < 5; i++) { s = next(pick(s, i + 1)); }
    expect(s).toMatchObject({ phase: 'done', style: 'simple', results: [1, 2, 3, 4, 5] });
    s = back(s); expect(s).toMatchObject({ phase: 'part', results: [1, 2, 3, 4], value: 5 });
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

  it('«Простое лицо» by default: tap the variant with the same pips, ▶ shows it again, five steps to the portrait', async () => {
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
    for (let i = 0; i < 5; i++) {
      if (i) await click(host.querySelectorAll('.portrait-option')[0]);
      await click(host.querySelector('.portrait-next'));
    }
    expect(host.querySelector('.portrait').dataset.phase).toBe('done');
    expect(JSON.parse(localStorage.getItem(portraitKey('kid')))).toMatchObject({ style: 'simple', phase: 'done', shape: 1, results: [2, 1, 1, 1, 1] });
    await click(label('Новый портрет'));
    expect(host.querySelectorAll('.portrait-shape')).toHaveLength(3);
  });
  it('«Пикассо» when the adult chose it: seven steps', async () => {
    await render({ style: 'picasso' });
    await click(label('Фантазийное'));
    expect(host.querySelector('h2').textContent).toBe('Левый глаз');
    expect(host.querySelector('[aria-label="Шаг 1 из 7"]')).not.toBeNull();
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
  it('continues after a reload with the chosen variant', async () => {
    localStorage.setItem(portraitKey('kid'), JSON.stringify({ version: 2, style: 'simple', phase: 'part', shape: 2, results: [1, 2], value: 4 }));
    await render();
    expect(host.querySelector('h2').textContent).toBe('Рот');
    expect(host.querySelector('.portrait-option[aria-pressed="true"]').getAttribute('aria-label')).toBe('4: Овал');
  });
});
