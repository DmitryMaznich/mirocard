import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrawingFinale } from './finale.js';

let svg, queue, now, controller;
function advance(ms) {
  const until = now+ms;
  while (now < until) {
    now += Math.min(16, until-now);
    const jobs = [...queue.values()]; queue.clear();
    jobs.forEach(callback => callback(now));
  }
}
beforeEach(() => {
  now = 0; queue = new Map(); let id = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', callback => { queue.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', key => queue.delete(key));
  document.body.innerHTML = '<svg><g data-finish-part="pupil" transform="translate(1 2)"></g><path data-finish-part="upper-lip"/><g data-finish-part="lower-lip"></g></svg>';
  svg = document.querySelector('svg');
  controller = createDrawingFinale(svg, { finale: { type: 'fish', mouth: [488, 368] } });
});
afterEach(() => { controller.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('drawing finale', () => {
  it('plays once and restores the original drawing without leaving animated nodes', () => {
    expect(controller.play()).toBe(true);
    advance(2400);
    expect(svg.querySelectorAll('[data-finale-bubble]')).toHaveLength(3);
    expect(svg.querySelector('[data-finish-part="pupil"]').getAttribute('transform')).not.toBe('translate(1 2)');
    expect(svg.querySelector('[data-finish-part="upper-lip"]').getAttribute('transform')).toContain('rotate(15)');
    advance(2200);
    expect(svg.querySelector('[data-finale]')).toBeNull();
    expect(svg.querySelector('[data-finish-part="pupil"]').getAttribute('transform')).toBe('translate(1 2)');
    expect(svg.querySelector('[data-finish-part="upper-lip"]').hasAttribute('transform')).toBe(false);
    expect(queue.size).toBe(0);
  });
  it('cancels immediately when leaving or hiding the page and can restart cleanly', () => {
    controller.play(); advance(2000); controller.stop();
    expect(queue.size).toBe(0); expect(svg.querySelector('[data-finale]')).toBeNull();
    controller.play(); advance(1500);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(queue.size).toBe(0); expect(svg.querySelector('[data-finale]')).toBeNull();
    expect(svg.querySelector('[data-finish-part="pupil"]').getAttribute('transform')).toBe('translate(1 2)');
  });
  it('honours reduced motion and leaves lessons without a finale untouched', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(controller.play()).toBe(false); expect(queue.size).toBe(0);
    const other = createDrawingFinale(svg, {});
    expect(other.play()).toBe(false); other.dispose();
    expect(svg.querySelector('[data-finale]')).toBeNull();
  });
});

describe('striped fish finale', () => {
  beforeEach(() => {
    controller.dispose();
    svg.innerHTML = '<path data-finish-part="head" transform="translate(1 2)"/><g data-finish-part="head"/><path data-finish-part="tail"/><g data-finish-part="tail"/>' +
      '<path data-finish-part="stripes"/>'.repeat(13);
    controller = createDrawingFinale(svg, { finale: { type: 'striped-fish', tail: [470, 150] } });
  });
  it('waves through separate stripes, swims left, returns and restores the drawing', () => {
    expect(controller.play()).toBe(true); advance(900);
    const stripes = [...svg.querySelectorAll('[data-finish-part="stripes"]')];
    expect(new Set(stripes.map(node => node.getAttribute('transform'))).size).toBe(13);
    const tails = [...svg.querySelectorAll('[data-finish-part="tail"]')];
    expect(tails[0].getAttribute('transform')).toBe(tails[1].getAttribute('transform'));
    advance(2900);
    const head = svg.querySelector('[data-finish-part="head"]');
    expect(Number(head.getAttribute('transform').match(/translate\(([-\d.]+)/)[1])).toBeLessThan(-600);
    advance(700);
    expect(Number(head.getAttribute('transform').match(/translate\(([-\d.]+)/)[1])).toBeGreaterThan(570);
    advance(2800);
    expect(head.getAttribute('transform')).toBe('translate(1 2)');
    expect(stripes.every(node => !node.hasAttribute('transform'))).toBe(true);
    expect(svg.querySelector('[data-finale]')).toBeNull(); expect(queue.size).toBe(0);
  });
  it('stops without changing layer order or leaving transformed parts', () => {
    const nodes = [...svg.children];
    controller.play(); advance(2500); controller.stop();
    expect([...svg.children]).toEqual(nodes);
    expect(nodes[0].getAttribute('transform')).toBe('translate(1 2)');
    expect(nodes.slice(1).every(node => !node.hasAttribute('transform'))).toBe(true);
    expect(queue.size).toBe(0);
    controller.play(); advance(1000); controller.dispose();
    expect(queue.size).toBe(0); expect(svg.querySelector('[data-finale]')).toBeNull();
  });
  it('requires the full fish and respects reduced motion and hidden pages', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(controller.play()).toBe(false);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    controller.play(); advance(1000);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(queue.size).toBe(0); expect(controller.play()).toBe(false);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    svg.querySelector('[data-finish-part="stripes"]').remove();
    expect(controller.play()).toBe(false); expect(queue.size).toBe(0);
  });
});
