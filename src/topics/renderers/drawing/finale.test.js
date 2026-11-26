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

describe('snowfall finale', () => {
  let lesson;
  beforeEach(() => {
    controller.dispose();
    svg.innerHTML = '<g data-layer="background-drawing"><path data-finish-part="snowflake-1" d="M10 20L30 20" style="stroke:rgb(52, 198, 232)"/><path data-finish-part="snowflake-1" d="M15 11L25 29"/><path data-finish-part="snowflake-1" d="M15 29L25 11"/></g><path data-finish-part="snowman" d="M100 100L200 200"/>';
    lesson = { viewBox: '0 0 800 500', finale: { type: 'snowfall', part: 'snowflake-1', centre: [20, 20] } };
    controller = createDrawingFinale(svg, lesson);
  });
  it('uses the drawn three-line flakes, falls downward once and restores the exact drawing', () => {
    const original = svg.innerHTML;
    expect(svg.querySelector('[data-finale]')).toBeNull(); expect(controller.play()).toBe(true);
    const flakes = svg.querySelectorAll('[data-falling-snowflake]'); expect(flakes).toHaveLength(20);
    for (const flake of flakes) expect(flake.querySelectorAll('path')).toHaveLength(3);
    expect(flakes[0].querySelector('path').style.stroke).toBe('rgb(52, 198, 232)');
    advance(1300);
    const firstY = Number(flakes[0].getAttribute('transform').match(/translate\([^ ]+ ([^)]+)/)[1]);
    expect(firstY).toBeGreaterThan(0); expect(Number(flakes[0].getAttribute('opacity'))).toBeGreaterThan(0);
    advance(1200);
    const secondY = Number(flakes[0].getAttribute('transform').match(/translate\([^ ]+ ([^)]+)/)[1]);
    expect(secondY).toBeGreaterThan(firstY);
    expect(svg.querySelectorAll('[data-finish-part="snowflake-1"]')).toHaveLength(3);
    advance(4400); expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0);
  });
  it('replays without overlap and cancels immediately on stopping or hiding', () => {
    const original = svg.innerHTML;
    controller.play(); advance(1000); controller.play();
    expect(svg.querySelectorAll('[data-finale]')).toHaveLength(1);
    controller.stop(); expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0);
    controller.play(); advance(700); vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0); expect(controller.play()).toBe(false);
  });
  it('keeps reduced-motion and incomplete lessons still', () => {
    const original = svg.innerHTML;
    vi.stubGlobal('matchMedia', () => ({ matches: true })); expect(controller.play()).toBe(false);
    expect(svg.innerHTML).toBe(original);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    svg.querySelector('path').remove(); const incomplete = svg.innerHTML;
    expect(controller.play()).toBe(false); expect(svg.innerHTML).toBe(incomplete); expect(queue.size).toBe(0);
  });
  it('moves the actual drawn flakes and squashes eye outlines and fills together for a blink', () => {
    controller.dispose();
    svg.insertAdjacentHTML('beforeend', '<g data-layer="colors"><g data-finish-part="eye-left"><path d="M100 90L104 90"/></g><g data-finish-part="eye-right"><path d="M120 90L124 90"/></g></g><g data-layer="drawing"><path data-finish-part="eye-left" d="M100 86Q108 90 100 94Q92 90 100 86Z"/><path data-finish-part="eye-right" d="M120 86Q128 90 120 94Q112 90 120 86Z"/></g>');
    lesson.finale.drawnFlakes = [{ part: 'snowflake-1', centre: [20, 20] }];
    lesson.finale.eyes = [{ part: 'eye-left', centre: [100, 90] }, { part: 'eye-right', centre: [120, 90] }];
    controller = createDrawingFinale(svg, lesson);
    const original = svg.innerHTML, actualFlake = svg.querySelector('path[data-finish-part="snowflake-1"]');
    controller.play(); advance(800);
    const moving = svg.querySelector('[data-drawn-snowflake="snowflake-1"]');
    expect(moving.contains(actualFlake)).toBe(true);
    expect(svg.querySelector('[data-layer="background-drawing"]').children).toHaveLength(0);
    expect(Number(moving.getAttribute('transform').match(/translate\([^ ]+ ([^)]+)/)[1])).toBeGreaterThan(0);
    for (const part of ['eye-left', 'eye-right']) {
      const pair = [...svg.querySelectorAll(`[data-finish-part="${part}"]`)];
      expect(pair).toHaveLength(2); expect(pair[0].getAttribute('transform')).toBe(pair[1].getAttribute('transform'));
      expect(Number(pair[0].getAttribute('transform').match(/scale\([^ ]+ ([^)]+)/)[1])).toBeLessThan(.15);
    }
    advance(500);
    expect(svg.querySelector('[data-finish-part="eye-left"]').getAttribute('transform')).toContain('scale(1 1)');
    advance(5600);
    expect(svg.innerHTML).toBe(original); expect(svg.querySelector('path[data-finish-part="snowflake-1"]')).toBe(actualFlake);
    expect(queue.size).toBe(0);
    controller.play(); advance(800); controller.stop(); expect(svg.innerHTML).toBe(original);
    controller.play(); advance(800); vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange')); expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0);
  });
});

describe('car departure finale', () => {
  let horn;
  beforeEach(() => {
    controller.dispose();
    svg.innerHTML = '<path data-finish-part="sun"/><g data-layer="drawing">'+
      ['body', 'wheel-1', 'hub-1', 'wheel-2', 'hub-2'].map(part => `<path data-finish-actor="car" data-finish-part="${part}"/>`).join('')+'</g><path data-finish-part="road"/>';
    horn = { play: vi.fn(), stop: vi.fn(), dispose: vi.fn(), setEnabled: vi.fn() };
    controller = createDrawingFinale(svg, { finale: { type: 'car-drive', track: [[235, 393], [575, 400], [1200, 340]],
      wheels: [{ rim: 'wheel-1', hub: 'hub-1', centre: [235, 393], radius: 29 }, { rim: 'wheel-2', hub: 'hub-2', centre: [575, 400], radius: 29 }] } }, { horn });
  });
  it('honks before moving right, turns both wheels and restores every original node', () => {
    const original = svg.innerHTML;
    expect(controller.play()).toBe(true); expect(horn.play).toHaveBeenCalledTimes(1);
    advance(400);
    const layer = svg.querySelector('[data-finale="car-drive"]');
    expect(layer.getAttribute('transform')).toContain('translate(0 0)');
    advance(1600);
    expect(Number(layer.getAttribute('transform').match(/translate\(([-\d.]+)/)[1])).toBeGreaterThan(0);
    expect(layer.contains(svg.querySelector('[data-finish-part="road"]'))).toBe(false);
    expect(layer.contains(svg.querySelector('[data-finish-part="sun"]'))).toBe(false);
    for (const number of [1, 2]) {
      const wheel = svg.querySelector(`[data-finish-part="wheel-${number}"]`);
      expect(wheel.getAttribute('transform')).toBe(svg.querySelector(`[data-finish-part="hub-${number}"]`).getAttribute('transform'));
      expect(wheel.getAttribute('transform')).toBe(svg.querySelector(`[data-car-spokes="wheel-${number}"]`).getAttribute('transform'));
    }
    advance(3400); expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0);
  });
  it('cancels sound and motion on hiding, and honours reduced motion and mute', () => {
    const original = svg.innerHTML;
    controller.setSoundEnabled(false); expect(horn.setEnabled).toHaveBeenCalledWith(false);
    controller.play(); advance(1400);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(svg.innerHTML).toBe(original); expect(horn.stop).toHaveBeenCalled(); expect(queue.size).toBe(0);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const count = horn.play.mock.calls.length;
    expect(controller.play()).toBe(false); expect(horn.play).toHaveBeenCalledTimes(count+1);
    expect(svg.innerHTML).toBe(original); expect(queue.size).toBe(0);
  });
});

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
