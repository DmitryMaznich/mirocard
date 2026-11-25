import { createCarHorn } from './hornSound.js';

// Optional, finite celebrations using the finished drawing's own parts.
// The car's brief horn plays only after explicit completion; nothing loops.
const ns = 'http://www.w3.org/2000/svg';
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t*t*(3-2*t); };
export function createDrawingFinale(svg, lesson, options = {}) {
  let frame = null, cleanup = null;
  const horn = lesson.finale?.type === 'car-drive' ? options.horn ?? createCarHorn() : null;
  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; horn?.stop(); cleanup?.(); cleanup = null;
  }
  function playCar(config, reducedMotion) {
    const actor = [...svg.querySelectorAll('[data-finish-actor="car"]')];
    const wheels = (config.wheels ?? []).map(wheel => ({ ...wheel,
      nodes: actor.filter(node => [wheel.rim, wheel.hub].includes(node.dataset.finishPart)) }));
    if (!actor.length || wheels.length !== 2 || wheels.some(wheel => !wheel.nodes.length) || !(config.track?.length >= 2)) return false;
    horn?.play();
    if (reducedMotion) return false;
    const positions = actor.map(node => [node, node.parentNode, node.nextSibling]);
    const originals = actor.map(node => [node, node.getAttribute('transform')]);
    const layer = document.createElementNS(ns, 'g');
    layer.dataset.finale = 'car-drive'; layer.setAttribute('aria-hidden', 'true'); layer.setAttribute('pointer-events', 'none');
    const shape = (tag, attrs, parent = layer) => {
      const node = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      parent.append(node); return node;
    };
    for (const d of config.silhouette ?? []) shape('path', { d, fill: '#fffefa', stroke: 'none' });
    for (const node of actor) layer.append(node);
    for (const wheel of wheels) {
      const [x, y] = wheel.centre;
      wheel.spokes = shape('g', { 'data-car-spokes': wheel.rim, stroke: '#c6ddd3', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: .85 });
      for (let i = 0; i < 3; i++) {
        const a = i*Math.PI*2/3;
        shape('path', { d: `M ${x+11*Math.cos(a)} ${y+11*Math.sin(a)} L ${x+24*Math.cos(a)} ${y+24*Math.sin(a)}` }, wheel.spokes);
      }
    }
    const honk = shape('g', { 'data-car-honk': '', stroke: '#dba143', 'stroke-width': 2.8, 'stroke-linecap': 'round', opacity: 0 });
    for (const d of ['M680 340L692 334', 'M683 351L699 351', 'M680 363L692 370']) shape('path', { d }, honk);
    svg.append(layer);
    cleanup = () => {
      for (const [node, transform] of originals) {
        if (transform === null) node.removeAttribute('transform'); else node.setAttribute('transform', transform);
      }
      for (const [node, parent, next] of positions.slice().reverse()) parent.insertBefore(node, next?.parentNode === parent ? next : null);
      layer.remove();
    };
    const track = x => {
      let i = 1;
      while (i < config.track.length-1 && config.track[i][0] < x) i++;
      const [a, b] = [config.track[i-1], config.track[i]];
      return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
    };
    const [[rx, ry], [fx, fy]] = wheels.map(wheel => wheel.centre);
    const baseAngle = Math.atan2(fy-ry, fx-rx);
    let elapsed = 0, last = performance.now();
    function tick(now) {
      elapsed += Math.min(64, now-last); last = now;
      const t = elapsed/1000, returning = t >= 4.45;
      const dx = returning ? 0 : 830*smooth((t-.85)/3.25);
      const dy = returning ? 0 : track(rx+dx)-ry;
      const angle = returning ? 0 : (Math.atan2(track(fx+dx)-track(rx+dx), fx-rx)-baseAngle)*180/Math.PI;
      layer.setAttribute('transform', `translate(${dx} ${dy}) translate(${rx} ${ry}) rotate(${angle}) translate(${-rx} ${-ry})`);
      layer.setAttribute('opacity', String(returning ? smooth((t-4.45)/.75) : 1));
      const pulse = smooth(t/.04)*(1-smooth((t-.48)/.12));
      honk.setAttribute('opacity', String(pulse));
      for (const wheel of wheels) {
        const [x, y] = wheel.centre;
        const transform = `rotate(${returning ? 0 : dx/wheel.radius*180/Math.PI} ${x} ${y})`;
        for (const node of wheel.nodes) node.setAttribute('transform', transform);
        wheel.spokes.setAttribute('transform', transform);
      }
      if (t >= 5.25) { stop(); return; }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick); return true;
  }
  function playZebra(config) {
    const actor = [...svg.querySelectorAll('[data-finish-actor="zebra"]')];
    const parts = name => actor.filter(node => node.dataset.finishPart === name);
    if (!actor.length || config.legs?.length !== 4 || !config.torso) return false;
    const legs = config.legs.map(leg => ({ ...leg, nodes: parts(leg.part), hooves: parts(leg.hoof) }));
    if (legs.some(leg => !leg.nodes.length || !leg.hooves.length || !leg.mask || !(leg.cap > leg.root))) return false;
    const butterfly = config.butterfly ? [...svg.querySelectorAll('[data-finish-actor="butterfly"]')] : [];
    const wings = (config.butterfly?.wings ?? []).map(wing => ({ ...wing, nodes: butterfly.filter(node => node.dataset.finishPart === wing.part) }));
    if (config.butterfly && (!butterfly.length || wings.length !== 2 || wings.some(wing => !wing.nodes.length))) return false;
    // Only the leg curves bend. Their roots stay fixed; each complete hoof
    // (outline, mask and pencil texture) translates as one rigid piece.
    const parse = d => (d.match(/[MCLZ][^MCLZ]*/gi) ?? []).map(command => ({
      type: command[0], values: (command.slice(1).match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number),
    }));
    const bend = (commands, root, cap, dx, dy) => commands.map(({ type, values }) => {
      const output = [];
      for (let i = 0; i < values.length; i += 2) {
        const weight = smooth((values[i+1]-root)/(cap-root));
        output.push((values[i]+dx*weight).toFixed(3), (values[i+1]+dy*weight).toFixed(3));
      }
      return type+' '+output.join(' ');
    }).join(' ');
    const moving = [...svg.querySelectorAll('[data-finish-actor]')].filter(node => actor.includes(node) || butterfly.includes(node));
    const positions = moving.map(node => [node, node.parentNode, node.nextSibling]);
    const transforms = moving.map(node => [node, node.getAttribute('transform')]);
    const originals = legs.flatMap(leg => leg.nodes.map(node => [node, node.getAttribute('d')]));
    const layer = document.createElementNS(ns, 'g');
    layer.dataset.finale = 'zebra-run'; layer.setAttribute('aria-hidden', 'true'); layer.setAttribute('pointer-events', 'none');
    const white = d => {
      const node = document.createElementNS(ns, 'path');
      node.setAttribute('d', d); node.setAttribute('fill', '#fffefa'); node.setAttribute('fill-rule', 'evenodd');
      node.setAttribute('stroke', 'none'); layer.append(node); return node;
    };
    white(config.torso); for (const d of config.extraBody ?? []) white(d);
    for (const leg of legs) {
      leg.curves = leg.nodes.map(node => [node, parse(leg.path ?? node.getAttribute('d'))]);
      leg.silhouette = white(leg.mask); leg.maskCurves = parse(leg.mask);
    }
    for (const node of actor) layer.append(node);
    svg.append(layer);
    const flight = butterfly.length ? document.createElementNS(ns, 'g') : null;
    if (flight) {
      flight.dataset.finaleFollower = 'butterfly'; flight.setAttribute('aria-hidden', 'true'); flight.setAttribute('pointer-events', 'none');
      for (const node of butterfly) flight.append(node);
      svg.append(flight);
    }
    cleanup = () => {
      for (const [node, d] of originals) node.setAttribute('d', d);
      for (const [node, transform] of transforms) {
        if (transform === null) node.removeAttribute('transform'); else node.setAttribute('transform', transform);
      }
      // Reverse insertion also restores consecutive siblings in their exact order.
      for (const [node, parent, next] of positions.slice().reverse()) parent.insertBefore(node, next?.parentNode === parent ? next : null);
      layer.remove(); flight?.remove();
    };
    const tail = [...parts('tail'), ...parts('tail-tuft')];
    const [tx, ty] = config.tail ?? [414, 320];
    let elapsed = 0, last = performance.now();
    function tick(now) {
      elapsed += Math.min(64, now-last); last = now;
      const t = elapsed/1000, returning = t >= 4;
      const energy = returning ? 0 : smooth((t-.3)/.3);
      const phase = (t-.4)*13;
      for (const leg of legs) {
        const stride = phase+leg.phase;
        const dx = 15*energy*Math.sin(stride), dy = -11*energy*Math.max(0, Math.cos(stride));
        for (const [node, commands] of leg.curves) node.setAttribute('d', bend(commands, leg.root, leg.cap, dx, dy));
        leg.silhouette.setAttribute('d', bend(leg.maskCurves, leg.root, leg.cap, dx, dy));
        for (const node of leg.hooves) node.setAttribute('transform', `translate(${dx} ${dy})`);
      }
      for (const node of tail) node.setAttribute('transform', `rotate(${5*energy*Math.sin(phase*.7)} ${tx} ${ty})`);
      const dx = returning ? 0 : -720*smooth((t-.45)/3.15);
      const dy = returning ? 0 : -4*energy*(.5+.5*Math.cos(phase*2));
      // The neck/front legs are already on the left and the tail on the right:
      // keep the original pose, rather than mirroring the animal tail-first.
      layer.setAttribute('transform', `translate(${dx} ${dy})`);
      // Once it has left the sheet, gently restore the completed paper model.
      layer.setAttribute('opacity', String(returning ? smooth((t-4)/.8) : 1));
      if (flight) {
        const flutter = returning ? 0 : smooth((t-.55)/.3);
        const flyX = returning ? 0 : -720*smooth((t-.95)/2.9);
        const flyY = returning ? 0 : flutter*(-9+8*Math.sin((t-.8)*5));
        const [ax, ay] = config.butterfly.anchor;
        const tilt = returning ? 0 : 3*flutter*Math.sin(t*6);
        flight.setAttribute('transform', `translate(${flyX} ${flyY}) rotate(${tilt} ${ax} ${ay})`);
        flight.setAttribute('opacity', String(returning ? smooth((t-4)/.8) : 1));
        for (const wing of wings) {
          const [x, y] = wing.hinge;
          const fold = 1-flutter*(.42-.38*Math.cos(t*21+wing.phase));
          const transform = `translate(${x} ${y}) rotate(${wing.angle}) scale(1 ${fold}) rotate(${-wing.angle}) translate(${-x} ${-y})`;
          for (const node of wing.nodes) node.setAttribute('transform', transform);
        }
      }
      if (t >= 4.8) { stop(); return; }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick); return true;
  }
  function playStripedFish(config) {
    const parts = name => [...svg.querySelectorAll(`[data-finish-part="${name}"]`)];
    const head = parts('head'), tail = parts('tail');
    // Older ZIPs contain single strokes; closed stripes pair their own outline
    // and pencil fill under one part name, even though they occupy different layers.
    const stripes = config.stripes ? config.stripes.map(parts) : parts('stripes').map(node => [node]);
    if (!head.length || !tail.length || stripes.length !== 13 || stripes.some(nodes => !nodes.length) || !config.tail?.every(Number.isFinite) || config.tail.length !== 2) return false;
    const original = [...head, ...tail, ...stripes.flat()].map(node => [node, node.getAttribute('transform')]);
    const layer = document.createElementNS(ns, 'g');
    layer.dataset.finale = 'striped-fish'; layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('pointer-events', 'none');
    const shape = (tag, attributes, parent) => {
      const node = document.createElementNS(ns, tag);
      for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
      parent.append(node); return node;
    };
    const scenery = shape('g', { 'data-finale-scenery': '', opacity: 0 }, layer);
    // These are the leaves the child drew. Bring their layer in front only
    // during the swim, then put it back at its exact original position.
    const leaves = (config.seaweed ?? []).map(({ part, root }) => ({ nodes: parts(part), root }));
    original.push(...leaves.flatMap(({ nodes }) => nodes.map(node => [node, node.getAttribute('transform')])));
    const foreground = config.seaweedForeground ? [...new Set(leaves.flatMap(({ nodes }) => nodes.map(node => node.closest('[data-layer="background"]'))).filter(Boolean))] : [];
    const positions = foreground.map(node => [node, node.parentNode, node.nextSibling]);
    for (const node of foreground) svg.append(node);
    const swimX = t => t < 1.2 ? 0 : t < 4.2 ? -650*smooth((t-1.2)/3) : 600*(1-smooth((t-4.2)/3));
    const bubbles = Array.from({ length: 6 }, (_, i) => {
      const delay = .5+i*.22;
      const circle = shape('circle', { 'data-finale-bubble': i, fill: '#d5f5f7', 'fill-opacity': .4,
        stroke: '#56b4c7', 'stroke-width': 1.3, opacity: 0 }, scenery);
      return { circle, delay, x: 73+swimX(delay), i };
    });
    svg.append(layer);
    cleanup = () => {
      for (const [node, transform] of original) {
        if (transform === null) node.removeAttribute('transform'); else node.setAttribute('transform', transform);
      }
      layer.remove();
      for (const [node, parent, next] of positions) parent.insertBefore(node, next?.parentNode === parent ? next : null);
    };
    const [tx, ty] = config.tail;
    let elapsed = 0, last = performance.now();
    function tick(now) {
      elapsed += Math.min(64, now-last); last = now;
      const t = elapsed/1000;
      const energy = smooth(t/.7)*(1-smooth((t-6.3)/.9));
      // Both sides of the wrap are entirely outside the 600-unit sheet.
      // The fish keeps facing its direction of travel, then settles at home.
      const dx = swimX(t);
      for (const node of head) node.setAttribute('transform', `translate(${dx} 0)`);
      stripes.forEach((nodes, i) => {
        const transform = `translate(${dx} ${5*energy*Math.sin(t*7-i*.48)})`;
        for (const node of nodes) node.setAttribute('transform', transform);
      });
      const angle = 9*energy*Math.sin(t*9);
      for (const node of tail) node.setAttribute('transform', `translate(${dx} 0) translate(${tx} ${ty}) rotate(${angle}) translate(${-tx} ${-ty})`);
      scenery.setAttribute('opacity', String(smooth((t-.2)/.6)*(1-smooth((t-5.1)/1))));
      leaves.forEach(({ nodes, root: [x, y] }, i) => {
        const transform = `rotate(${1.3*energy*Math.sin(t*2+i*.8)} ${x} ${y})`;
        for (const node of nodes) node.setAttribute('transform', transform);
      });
      for (const { circle, delay, x, i } of bubbles) {
        const u = (t-delay)/2.5, v = Math.max(0, Math.min(1, u));
        circle.setAttribute('cx', String(x+9*Math.sin(v*4+i)*v));
        circle.setAttribute('cy', String(148-(105+i*3)*v));
        circle.setAttribute('r', String((3+i%3)*(.8+.35*v)));
        circle.setAttribute('opacity', String(u < 0 || u > 1 ? 0 : smooth(u/.12)*(1-smooth((u-.75)/.25))));
      }
      if (t >= 7.2) { stop(); return; }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return true;
  }
  function play() {
    stop();
    const config = lesson.finale;
    if (document.hidden) return false;
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (config?.type === 'car-drive') return playCar(config, reducedMotion);
    if (reducedMotion) return false;
    if (config?.type === 'zebra-run') return playZebra(config);
    if (config?.type === 'striped-fish') return playStripedFish(config);
    if (config?.type !== 'fish') return false;
    const parts = name => [...svg.querySelectorAll(`[data-finish-part="${name}"]`)];
    const pupil = parts('pupil'), upper = parts('upper-lip'), lower = parts('lower-lip');
    if (!pupil.length || !upper.length || !lower.length) return false;
    const all = [...pupil, ...upper, ...lower];
    const original = all.map(node => [node, node.getAttribute('transform')]);
    const layer = document.createElementNS(ns, 'g');
    layer.dataset.finale = 'fish'; layer.setAttribute('aria-hidden', 'true');
    const mouth = document.createElementNS(ns, 'ellipse');
    const [mx, my] = config.mouth;
    mouth.setAttribute('cx', mx-14); mouth.setAttribute('cy', my);
    mouth.setAttribute('rx', '9'); mouth.setAttribute('ry', '0'); mouth.setAttribute('fill', '#26352d');
    const mouthLayer = document.createElementNS(ns, 'g'); mouthLayer.append(mouth);
    svg.insertBefore(mouthLayer, svg.firstChild);
    const bubbles = [0, .42, .86].map((delay, i) => {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('fill', '#d5f5f7'); circle.setAttribute('fill-opacity', '.35');
      circle.setAttribute('stroke', '#34b8cc'); circle.setAttribute('stroke-width', '2.5');
      circle.setAttribute('opacity', '0'); circle.dataset.finaleBubble = String(i);
      layer.append(circle); return { circle, delay, i };
    });
    svg.append(layer);
    cleanup = () => {
      for (const [node, transform] of original) {
        if (transform === null) node.removeAttribute('transform'); else node.setAttribute('transform', transform);
      }
      layer.remove(); mouthLayer.remove();
    };
    const rotate = (nodes, angle) => nodes.forEach(node => node.setAttribute('transform', `translate(${mx} ${my}) rotate(${angle}) translate(${-mx} ${-my})`));
    let elapsed = 0, last = performance.now();
    function tick(now) {
      elapsed += Math.min(64, now-last); last = now;
      const t = elapsed/1000;
      const gaze = smooth((t-.15)/.65)*(1-smooth((t-3.5)/.7));
      for (const node of pupil) node.setAttribute('transform', `translate(${-6*gaze} ${-2*gaze})`);
      const opening = smooth((t-.95)/.45)*(1-smooth((t-3.35)/.65));
      rotate(upper, 15*opening); rotate(lower, -15*opening);
      mouth.setAttribute('ry', String(5*opening));
      for (const { circle, delay, i } of bubbles) {
        const u = (t-1.4-delay)/1.95;
        const v = Math.max(0, Math.min(1, u));
        circle.setAttribute('cx', String(mx-23-55*v+Math.sin(v*Math.PI*1.3+i)*9*v));
        circle.setAttribute('cy', String(my-3-(105+i*15)*v));
        circle.setAttribute('r', String((7+i*2)*(0.7+.4*v)));
        circle.setAttribute('opacity', String(u < 0 || u > 1 ? 0 : smooth(u/.13)*(1-smooth((u-.75)/.25))));
      }
      if (t >= 4.5) { stop(); return; }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return true;
  }
  const onVisibility = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', onVisibility);
  return { play, stop, setSoundEnabled(value) { horn?.setEnabled(value); }, dispose() { stop(); horn?.dispose(); document.removeEventListener('visibilitychange', onVisibility); } };
}
