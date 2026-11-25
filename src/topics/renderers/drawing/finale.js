// Optional, finite celebration. It moves the finished drawing's own parts;
// no audio, looping, or changes to the lesson's step count.
const ns = 'http://www.w3.org/2000/svg';
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t*t*(3-2*t); };
export function createDrawingFinale(svg, lesson) {
  let frame = null, cleanup = null;
  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; cleanup?.(); cleanup = null;
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
    if (document.hidden || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
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
  return { play, stop, dispose() { stop(); document.removeEventListener('visibilitychange', onVisibility); } };
}
