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
  function play() {
    stop();
    const config = lesson.finale;
    if (config?.type !== 'fish' || document.hidden || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
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
