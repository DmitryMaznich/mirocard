// The last step of every «Рисуем по шагам» drawing: the pencil signs the sheet, like a real artwork —
// the drawing's title and the date («16 ноября 2026») in the emptiest corner, written left to right
// with the pencil tip following, in the app's print font — children who only print or only read
// copy it too; a cursive one excluded them (owner, 2026-11-16). The child copies it on the paper.
const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const signatureDate = (date = new Date()) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
export const WRITE_MS = 2400;

const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); parent?.append(n); return n; };
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

// The four corners: the one the drawing covers least. Top corners first — the bottom ones sit under the
// lesson's round buttons (back on the left, the green primary on the right).
export function chooseCorner(view, box, size, margin, obstacles = []) {
  const corners = [['tr', 'end'], ['tl', 'start'], ['br', 'end'], ['bl', 'start']].map(([id, anchor]) => {
    const x = id[1] === 'r' ? view.x + view.width - margin - size.width : view.x + margin;
    const y = id[0] === 'b' ? view.y + view.height - margin - size.height : view.y + margin;
    return { id, anchor, rect: { x, y, width: size.width, height: size.height } };
  });
  // `box` is one box or a list (every part and label of the drawing): a single box around all of it
  // covers the whole sheet and makes every corner look equally taken.
  const parts = Array.isArray(box) ? box : [box];
  const cost = c => parts.reduce((sum, b) => sum + overlap(c.rect, b), 0) + obstacles.reduce((sum, o) => sum + overlap(c.rect, o) * 4, 0);
  return corners.reduce((best, c) => cost(c) < cost(best) - 1e-6 ? c : best);
}

export function writeSignature(svg, title, { date = new Date(), reduced = false } = {}) {
  if (!svg || typeof svg.getBBox !== 'function') return () => {};
  svg.querySelector('[data-layer=signature]')?.remove();
  // Sized from the long side, and never under 16 screen px (a wide sheet on a phone is drawn small).
  const sheet = svg.viewBox.baseVal, unit = Math.max(sheet.width, sheet.height), ctm = svg.getScreenCTM?.(), scale = ctm?.a || 1;
  const toSheet = ctm ? (x, y) => new DOMPoint(x, y).matrixTransform(ctm.inverse()) : null;
  // The corner of the whole visible board, not of the sheet: on a tall phone a wide sheet leaves free room
  // above and below it, and the sheet's own corner would sit on the drawing.
  const box0 = svg.getBoundingClientRect?.(), a0 = toSheet && box0 ? toSheet(box0.left, box0.top) : null, c0 = toSheet && box0 ? toSheet(box0.right, box0.bottom) : null;
  const view = a0 && c0 && c0.x > a0.x ? { x: a0.x, y: a0.y, width: c0.x - a0.x, height: c0.y - a0.y } : sheet;
  const size = Math.max(unit * .036, 16 / scale), margin = unit * .025;
  // The lesson's round buttons (back, primary) float over the sheet: keep the signature off them.
  const obstacles = toSheet ? [...document.querySelectorAll('.drawing-primary, .drawing-back, .drawing-show')].map(b => {
    const r = b.getBoundingClientRect(), pad = 28, a = toSheet(r.left - pad, r.top - pad), c = toSheet(r.right + pad, r.bottom + pad);
    return { x: a.x, y: a.y, width: c.x - a.x, height: c.y - a.y };
  }) : [];
  const layers = [...svg.querySelectorAll('[data-layer=colors],[data-layer=drawing],[data-layer=accents],[data-layer=labels]')];
  const box = layers.flatMap(n => [...n.children]).map(n => { try { return n.getBBox(); } catch { return null; } }).filter(b => b && b.width && b.height);
  const g = el('g', { 'data-layer': 'signature', 'pointer-events': 'none', 'aria-hidden': 'true' }, svg);
  const defs = el('defs', {}, g);
  const lines = [title, signatureDate(date)].map((text, i) => {
    const node = el('text', { x: 0, y: i * size * 1.25, 'font-family': "'Nunito', sans-serif", 'font-weight': 600, 'font-size': (i ? size * .85 : size).toFixed(2), fill: '#3b3f3a' }, g);
    node.textContent = text; return node;
  });
  // Measure, then place the block in the chosen corner.
  const widths = lines.map(n => n.getBBox().width), block = { width: Math.max(...widths), height: size * 2.25 };
  const corner = chooseCorner(view, box, block, margin, obstacles);
  lines.forEach((n, i) => {
    n.setAttribute('text-anchor', corner.anchor);
    n.setAttribute('x', (corner.anchor === 'end' ? corner.rect.x + block.width : corner.rect.x).toFixed(2));
    n.setAttribute('y', (corner.rect.y + size * .95 + i * size * 1.25).toFixed(2));
  });
  g.dataset.corner = corner.id;
  // Each line is revealed left to right by its own clip; the pencil tip follows the edge.
  const clips = lines.map((n, i) => {
    const b = n.getBBox(), clip = el('clipPath', { id: `drawing-signature-${i}-${Math.random().toString(36).slice(2)}` }, defs);
    const rect = el('rect', { x: b.x - 2, y: b.y - size * .3, width: 0, height: b.height + size * .6 }, clip);
    n.setAttribute('clip-path', `url(#${clip.id})`);
    return { b, rect };
  });
  const tip = el('circle', { r: (size * .14).toFixed(2), fill: '#3b3f3a', visibility: 'hidden' }, g);
  const show = t => {
    clips.forEach(({ b, rect }, i) => {
      // The title takes the first 58% of the time, the date the rest.
      const share = i === 0 ? Math.min(1, t / .58) : Math.max(0, Math.min(1, (t - .58) / .42));
      rect.setAttribute('width', ((b.width + 4) * share).toFixed(2));
      if (share > 0 && share < 1) { tip.setAttribute('cx', (b.x + b.width * share).toFixed(2)); tip.setAttribute('cy', (b.y + b.height * .75).toFixed(2)); tip.setAttribute('visibility', 'visible'); }
    });
    if (t >= 1) tip.setAttribute('visibility', 'hidden');
  };
  if (reduced) { show(1); return () => g.remove(); }
  let frame, start;
  const tick = now => { start ??= now; const t = Math.min(1, (now - start) / WRITE_MS); show(t); if (t < 1) frame = requestAnimationFrame(tick); };
  show(0); frame = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(frame); g.remove(); };
}
