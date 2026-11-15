import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DrawingRenderer from '../index.jsx';
import { generateTasks } from '../engine.js';
import { FACES, PARTS, PART_LABELS, PLACEMENTS } from './parts.js';
import { STEPS, back, chooseShape, freshPortrait, next, pick, portraitKey, readPortrait, validPortrait } from './state.js';

describe('portrait data and state', () => {
  it('has three faces and six variants with labels and a place for every one of the seven parts', () => {
    expect(FACES).toHaveLength(3); expect(PARTS).toHaveLength(STEPS); expect(PLACEMENTS).toHaveLength(STEPS);
    for (const [i, part] of PARTS.entries()) { expect(part).toHaveLength(6); expect(PART_LABELS[i]).toHaveLength(6); expect(part.every(Boolean)).toBe(true); }
  });
  it('walks shape → seven parts → done, and steps back exactly one choice at a time', () => {
    let s = chooseShape(freshPortrait(), 1);
    expect(next(s)).toBe(s); // no variant chosen yet
    for (let i = 0; i < STEPS; i++) { s = pick(s, (i % 6) + 1); expect(validPortrait(s)).toBe(true); s = next(s); }
    expect(s).toMatchObject({ phase: 'done', shape: 1, results: [1, 2, 3, 4, 5, 6, 1], value: null });
    s = back(s); expect(s).toMatchObject({ phase: 'part', results: [1, 2, 3, 4, 5, 6], value: 1 });
    s = back(s); expect(s.value).toBe(null); s = back(s); expect(s).toMatchObject({ results: [1, 2, 3, 4, 5], value: 6 });
    expect(pick(s, 7)).toBe(s); expect(pick(s, 0)).toBe(s);
  });
  it('rejects a damaged saved portrait', () => {
    localStorage.setItem('k', JSON.stringify({ version: 1, phase: 'done', shape: 0, results: [1], value: null }));
    expect(readPortrait('k')).toEqual(freshPortrait());
    localStorage.setItem('k', '{');
    expect(readPortrait('k')).toEqual(freshPortrait());
  });
  it('makes one portrait task from the first-lines card', () => {
    const tasks = generateTasks({ type: 'drawing_portrait' }, [{ id: 'c', conceptId: 'x', firstLines: { kind: 'short_line' } }], 15, {});
    expect(tasks).toEqual([{ type: 'drawing_portrait', id: 'portrait', cardId: 'c', conceptId: 'x' }]);
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
  const render = async (params = {}, extra = {}) => act(async () => root.render(<DrawingRenderer task={{ type: 'drawing_portrait', id: 'portrait' }} student={{ id: 'kid' }} sessionParams={params} {...extra} />));
  const click = async el => act(async () => el.click());
  const label = name => host.querySelector(`[aria-label="${name}"]`);

  it('real die: the child taps the variant with the same pips, the next arrow appears, the portrait is saved', async () => {
    await render();
    expect(host.querySelectorAll('.portrait-shape')).toHaveLength(3);
    await click(label('Овальное'));
    expect(host.querySelector('h2').textContent).toBe('Левый глаз');
    expect(host.querySelector('.portrait-next')).toBeNull();
    const options = host.querySelectorAll('.portrait-option');
    expect(options).toHaveLength(6);
    await click(options[2]);
    expect(options[2].getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.portrait-face__current')).not.toBeNull();
    for (let i = 0; i < STEPS; i++) {
      if (i) await click(host.querySelectorAll('.portrait-option')[0]);
      await click(host.querySelector('.portrait-next'));
    }
    expect(host.querySelector('.portrait').dataset.phase).toBe('done');
    expect(JSON.parse(localStorage.getItem(portraitKey('kid')))).toMatchObject({ phase: 'done', shape: 1, results: [3, 1, 1, 1, 1, 1, 1] });
    await click(label('Новый портрет'));
    expect(host.querySelectorAll('.portrait-shape')).toHaveLength(3);
  });
  it('screen die: variants are not tappable, a throw picks one by itself', async () => {
    vi.useFakeTimers();
    await render({ dice: 'screen' });
    await click(label('Угловатое'));
    expect([...host.querySelectorAll('.portrait-option')].every(b => b.disabled)).toBe(true);
    await click(label('Бросить кубик'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(host.querySelectorAll('.portrait-option[aria-pressed="true"]')).toHaveLength(1);
    expect(label('Бросить кубик')).toBeNull();
    expect(host.querySelector('.portrait-next')).not.toBeNull();
  });
  it('continues after a reload with the chosen variant', async () => {
    localStorage.setItem(portraitKey('kid'), JSON.stringify({ version: 1, phase: 'part', shape: 2, results: [1, 2], value: 4 }));
    await render();
    expect(host.querySelector('h2').textContent).toBe('Нос');
    expect(host.querySelector('.portrait-option[aria-pressed="true"]').getAttribute('aria-label')).toMatch(/^4:/);
  });
});
