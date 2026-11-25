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

describe('running zebra finale', () => {
  let runningLesson;
  beforeEach(() => {
    controller.dispose();
    svg.innerHTML = '<g data-layer="colors"><g data-finish-actor="zebra" data-finish-part="body"><defs><clipPath id="zebra-test-clip"><path d="M0 0L100 0L100 100Z"/></clipPath></defs><path clip-path="url(#zebra-test-clip)"/></g></g>' +
      '<g data-layer="drawing"><path data-finish-actor="zebra" data-finish-part="body" d="M10 10L80 10L80 30Z" transform="translate(1 2)"/></g>' +
      '<g data-finish-part="butterfly"><path d="M90 5L95 10"/></g><g data-finish-part="grass"><path d="M0 100L100 100"/></g>';
    const legs = Array.from({ length: 4 }, (_, i) => ({ part: `leg-${i}`, hoof: `hoof-${i}`, root: 30, cap: 70,
      mask: 'M10 30L20 30L20 90L10 90Z', phase: i%2*Math.PI }));
    for (const leg of legs) {
      svg.querySelector('[data-layer=drawing]').insertAdjacentHTML('beforeend', `<path data-finish-actor="zebra" data-finish-part="${leg.part}" d="M10 30 C10 50 10 70 10 90 L20 90 C20 70 20 50 20 30"/><path data-finish-actor="zebra" data-finish-part="${leg.hoof}" d="M10 70L20 70"/>`);
      svg.querySelector('[data-layer=colors]').insertAdjacentHTML('beforeend', `<g data-finish-actor="zebra" data-finish-part="${leg.hoof}"><path d="M10 70L20 70L20 90L10 90Z"/></g>`);
    }
    runningLesson = { finale: { type: 'zebra-run', torso: 'M10 10L80 10L80 30Z', legs, tail: [80, 20] } };
    controller = createDrawingFinale(svg, runningLesson);
  });
  it('runs left without mirroring, keeps four joined hooves and restores the exact drawing', () => {
    const original = svg.innerHTML;
    const scenery = svg.querySelector('[data-finish-part=butterfly]');
    const sceneMarkup = scenery.outerHTML;
    expect(controller.play()).toBe(true); advance(1000);
    const layer = svg.querySelector('[data-finale="zebra-run"]');
    expect(layer.getAttribute('transform')).not.toContain('scale');
    expect(Number(layer.getAttribute('transform').match(/translate\(([-\d.]+)/)[1])).toBeLessThan(0);
    expect(svg.querySelector('[data-finish-part="leg-0"]').getAttribute('d')).not.toContain('C10 50 10 70 10 90');
    const hoof = [...svg.querySelectorAll('[data-finish-part="hoof-0"]')];
    expect(hoof[0].getAttribute('transform')).toBe(hoof[1].getAttribute('transform'));
    expect(scenery.outerHTML).toBe(sceneMarkup); expect(layer.contains(scenery)).toBe(false);
    expect(svg.querySelectorAll('#zebra-test-clip')).toHaveLength(1);
    advance(2700); expect(layer.getAttribute('transform')).toContain('translate(-720 ');
    advance(1200);
    expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0);
  });
  it('restores paths, transforms and layer order on cancellation and hiding', () => {
    const original = svg.innerHTML;
    controller.play(); advance(1300); controller.stop(); expect(svg.innerHTML).toBe(original);
    controller.play(); advance(900);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0);
    expect(controller.play()).toBe(false);
  });
  it('skips reduced motion and incomplete leg sets without moving any drawing parts', () => {
    const original = svg.innerHTML;
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(controller.play()).toBe(false); expect(svg.innerHTML).toBe(original);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    svg.querySelectorAll('[data-finish-part="hoof-3"]').forEach(node => node.remove());
    const incomplete = svg.innerHTML;
    expect(controller.play()).toBe(false); expect(svg.innerHTML).toBe(incomplete); expect(queue.size).toBe(0);
  });
  it('lets the butterfly follow later with paired wing motion and restores both actors', () => {
    controller.dispose();
    svg.querySelector('[data-finish-part=butterfly]').dataset.finishActor = 'butterfly';
    for (const part of ['butterfly-upper', 'butterfly-lower']) {
      svg.querySelector('[data-layer=colors]').insertAdjacentHTML('beforeend', `<g data-finish-actor="butterfly" data-finish-part="${part}"><path d="M90 5L100 5L95 15Z"/></g>`);
      svg.querySelector('[data-layer=drawing]').insertAdjacentHTML('beforeend', `<path data-finish-actor="butterfly" data-finish-part="${part}" d="M90 5L100 5L95 15Z"/>`);
    }
    runningLesson.finale.butterfly = { anchor: [90, 5], wings: [
      { part: 'butterfly-upper', hinge: [90, 5], angle: 50, phase: 0 },
      { part: 'butterfly-lower', hinge: [95, 10], angle: 45, phase: .5 },
    ] };
    const original = svg.innerHTML;
    controller = createDrawingFinale(svg, runningLesson);
    expect(controller.play()).toBe(true); advance(800);
    const flight = svg.querySelector('[data-finale-follower=butterfly]');
    expect(flight.getAttribute('transform')).toContain('translate(0 ');
    advance(600);
    expect(Number(flight.getAttribute('transform').match(/translate\(([-\d.]+)/)[1])).toBeLessThan(0);
    const wings = [...flight.querySelectorAll('[data-finish-part=butterfly-upper]')];
    expect(wings[0].getAttribute('transform')).toBe(wings[1].getAttribute('transform'));
    expect(wings[0].getAttribute('transform')).toContain('scale(1 ');
    controller.stop(); expect(svg.innerHTML).toBe(original);
    controller.play(); advance(5000); expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0);
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
  it('adds rising bubbles during the finale without generating extra plants', () => {
    expect(svg.querySelector('[data-finale-scenery]')).toBeNull();
    controller.play(); advance(1200);
    const layer = svg.querySelector('[data-finale]');
    expect(svg.lastElementChild).toBe(layer);
    expect(layer.getAttribute('pointer-events')).toBe('none');
    const leaves = [...layer.querySelectorAll('[data-finale-leaf]')];
    expect(leaves).toHaveLength(0);
    const bubble = layer.querySelector('[data-finale-bubble]');
    expect(layer.querySelectorAll('[data-finale-bubble]')).toHaveLength(6);
    expect(Number(bubble.getAttribute('opacity'))).toBeGreaterThan(0);
    const height = Number(bubble.getAttribute('cy'));
    advance(500); expect(Number(bubble.getAttribute('cy'))).toBeLessThan(height);
    advance(4600);
    expect(Number(layer.querySelector('[data-finale-scenery]').getAttribute('opacity'))).toBe(0);
    controller.stop();
    expect(svg.querySelector('[data-finale-leaf]')).toBeNull();
    expect(svg.querySelector('[data-finale-bubble]')).toBeNull();
  });
  it('moves the drawn leaves in front for the swim, then restores their layer and drawing', () => {
    controller.dispose();
    const names = ['seaweed-1', 'seaweed-2', 'seaweed-3'];
    svg.insertAdjacentHTML('afterbegin', `<g data-layer="background">${names.map(name => `<path data-finish-part="${name}"/><g data-finish-part="${name}"/>`).join('')}</g>`);
    const background = svg.firstElementChild, original = background.innerHTML;
    controller = createDrawingFinale(svg, { finale: { type: 'striped-fish', tail: [470, 150], seaweedForeground: true, seaweed: names.map(part => ({ part, root: [40, 252] })) } });
    expect(controller.play()).toBe(true); advance(1500);
    expect(svg.querySelector('[data-finale]').previousElementSibling).toBe(background);
    for (const name of names) {
      const pair = [...background.querySelectorAll(`[data-finish-part="${name}"]`)];
      expect(pair[0].getAttribute('transform')).toContain('rotate(');
      expect(pair[0].getAttribute('transform')).toBe(pair[1].getAttribute('transform'));
    }
    controller.stop(); expect(background.innerHTML).toBe(original);
    expect(svg.firstElementChild).toBe(background);
    expect(background.children).toHaveLength(6);
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
  it('keeps each coloured stripe inside its own moving outline and restores both layers', () => {
    controller.dispose();
    svg.querySelectorAll('[data-finish-part="stripes"]').forEach(node => node.remove());
    const names = Array.from({ length: 13 }, (_, i) => `stripe-${i+1}`);
    svg.innerHTML += names.map(name => `<path data-finish-part="${name}"/><g data-finish-part="${name}" clip-path="url(#${name})"><defs><clipPath id="${name}"><path/></clipPath></defs><path/></g>`).join('');
    const nodes = [...svg.children];
    controller = createDrawingFinale(svg, { finale: { type: 'striped-fish', tail: [470, 150], stripes: names } });
    expect(controller.play()).toBe(true); advance(1800);
    for (const name of names) {
      const pair = [...svg.querySelectorAll(`[data-finish-part="${name}"]`)];
      expect(pair[0].getAttribute('transform')).toBe(pair[1].getAttribute('transform'));
      expect(pair[1].getAttribute('clip-path')).toBe(`url(#${name})`);
    }
    controller.stop();
    expect([...svg.children]).toEqual(nodes);
    expect(nodes.slice(1).every(node => !node.hasAttribute('transform'))).toBe(true);
  });
});
