// «Портрет по кубику» colouring: what is coloured, in which order and with which pencils.
// Order is a painter's: big and light first, small and dark last — skin, hair (+ brows), clothes,
// eyes (only the iris), lips. Skin is the child's own choice; the other colours come from the die.
// The finished portrait becomes a lesson for the «Рисуем по шагам» player (player.js): one stroke step
// with the whole outline, then colour steps (pencil hatching) and traced lines in colour.
import { STYLES, styleSteps } from './styles.js';
import { splitSubpaths } from './drawPath.js';

const P = {
  black: ['Чёрный', '#151917'], brown: ['Коричневый', '#6f3324'], yellow: ['Жёлтый', '#efdd05'], orange: ['Оранжевый', '#efaa12'],
  red: ['Красный', '#b73316'], gray: ['Серый', '#777b7c'], light_blue: ['Голубой', '#34c6e8'], blue: ['Синий', '#0866d1'],
  green: ['Зелёный', '#30bb05'], light_green: ['Салатовый', '#75d816'], pink: ['Розовый', '#de64a5'], purple: ['Фиолетовый', '#923bc0'],
  beige: ['Бежевый', '#f2d69a'],
  // Skin tones for «Простое лицо» — the child picks one.
  skin_1: ['Светлый', '#f7e0c8'], skin_2: ['Бежевый', '#efc9a0'], skin_3: ['Персиковый', '#e8a87c'],
  skin_4: ['Смуглый', '#c68b59'], skin_5: ['Коричневый', '#8d5a3b'], skin_6: ['Тёмно-коричневый', '#5b3a29'],
};
const tool = id => ({ id, name: P[id][0], color: P[id][1] });
const PALETTES = {
  simple: { skin: ['skin_1', 'skin_2', 'skin_3', 'skin_4', 'skin_5', 'skin_6'], hair: ['black', 'brown', 'yellow', 'orange', 'gray', 'red'],
    clothes: ['red', 'blue', 'green', 'yellow', 'purple', 'orange'], eyes: ['light_blue', 'blue', 'green', 'brown', 'gray', 'light_green'],
    lips: ['pink', 'red', 'orange', 'purple', 'brown', 'beige'] },
  // Picasso's own faces are blue, pink, yellow, green — the colours are part of the style.
  picasso: { skin: ['light_blue', 'pink', 'yellow', 'light_green', 'orange', 'beige'], hair: ['blue', 'purple', 'red', 'green', 'black', 'orange'],
    clothes: ['red', 'blue', 'green', 'yellow', 'purple', 'orange'], eyes: ['blue', 'green', 'purple', 'red', 'orange', 'brown'],
    lips: ['red', 'pink', 'purple', 'orange', 'blue', 'green'] },
};
export const COLOR_STEPS = [
  { group: 'skin', name: 'Лицо', choice: 'pick' },
  { group: 'hair', name: 'Волосы', choice: 'die' },
  { group: 'clothes', name: 'Одежда', choice: 'die' },
  { group: 'eyes', name: 'Глаза', choice: 'die' },
  { group: 'lips', name: 'Губы', choice: 'die' },
];
export const paletteFor = (style, group) => PALETTES[style][group].map(tool);

// ---- Picasso parts live in their own 0 0 180 160 space: bring them onto the sheet. ----
function parseTransform(value = '') {
  const t = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(value), s = /scale\(([-\d.]+)(?:[ ,]+([-\d.]+))?\)/.exec(value);
  return { tx: t ? +t[1] : 0, ty: t ? +t[2] : 0, sx: s ? +s[1] : 1, sy: s ? +(s[2] ?? s[1]) : 1 };
}
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
// translate + scale only (that is all the prototype uses); relative commands scale without moving.
export function transformPath(d, transform) {
  if (!transform) return d;
  const { tx, ty, sx, sy } = parseTransform(transform), r = n => Math.round(n * 100) / 100;
  const out = [];
  for (const [, cmd, body] of d.matchAll(/([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g)) {
    const up = cmd.toUpperCase(), rel = cmd !== up, n = (body.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number), size = ARGS[up];
    if (!size) { out.push(cmd); continue; }
    const next = up === 'M' ? (rel ? 'l' : 'L') : cmd; // extra M pairs are implicit L/l
    for (let i = 0; i < n.length; i += size) {
      const a = n.slice(i, i + size), X = v => r(rel ? v * sx : tx + v * sx), Y = v => r(rel ? v * sy : ty + v * sy);
      let res;
      if (up === 'H') res = [X(a[0])];
      else if (up === 'V') res = [Y(a[0])];
      else if (up === 'A') res = [r(a[0] * Math.abs(sx)), r(a[1] * Math.abs(sy)), a[2], a[3], a[4], X(a[5]), Y(a[6])];
      else res = a.map((v, k) => k % 2 ? Y(v) : X(v));
      out.push(`${i === 0 ? cmd : next}${res.join(' ')}`);
    }
  }
  return out.join(' ');
}
const closed = d => /z\s*$/i.test(d.trim());

// Everything one finished portrait is made of, on the sheet: outlines, fills and what each colour group paints.
export function portraitPaint(styleId, shape, results) {
  const style = STYLES[styleId], steps = styleSteps(styleId, shape);
  const outline = [{ d: style.faces[shape].path }], paint = { skin: [{ d: style.faces[shape].path }], hair: [], clothes: [], eyes: [], lips: [] };
  results.forEach((value, part) => {
    const step = steps[part], v = step.variants[value - 1], move = d => step.ownSpace ? transformPath(d, step.transform) : d;
    for (const d of splitSubpaths(v.d)) outline.push({ d: move(d) });
    if (v.fill) for (const d of splitSubpaths(v.fill)) outline.push({ d: move(d), fill: '#26352d' });
    if (v.paint) for (const item of v.paint) paint[item.group].push(item.line ? { line: item.line } : { d: item.d, clip: item.clip });
    else if (step.ownSpace) {
      // Picasso: eyes 0–1, mouth 3, ears 4–5, hair 6. A closed first shape is filled, an open one traced in colour.
      const group = part < 2 ? 'eyes' : part === 3 ? 'lips' : part === 4 || part === 5 ? 'skin' : part === 6 ? 'hair' : null;
      if (!group) return;
      const first = splitSubpaths(v.d)[0];
      if (closed(first)) paint[group].push({ d: move(first) });
      else if (group === 'hair') paint.hair.push({ line: move(v.d) });
    }
  });
  return { outline, paint, viewBox: style.viewBox };
}
// Colour steps this portrait needs (a group with nothing to paint is skipped).
export const colorSteps = (styleId, shape, results) => {
  const { paint } = portraitPaint(styleId, shape, results);
  return COLOR_STEPS.filter(step => paint[step.group].length);
};
// A «Рисуем по шагам» lesson: the outline, then one or more player steps per chosen colour.
// `ends[k]` is how many player steps exist once colour step k is done.
export function paintLesson(styleId, shape, results, colors) {
  const { outline, paint, viewBox } = portraitPaint(styleId, shape, results), steps = colorSteps(styleId, shape, results);
  const palette = [{ id: 'black', name: 'Чёрный', color: '#151917' }], lesson = [{ kind: 'stroke', tool: 'black', paths: outline }], ends = [1];
  colors.forEach((value, k) => {
    const pencil = paletteFor(styleId, steps[k].group)[value - 1], id = `${steps[k].group}-${pencil.id}`;
    palette.push({ ...pencil, id });
    const items = paint[steps[k].group], lines = items.filter(i => i.line), regions = items.filter(i => i.d);
    for (const region of regions) lesson.push({ kind: 'color', tool: id, fill: pencil.color, d: region.d, ...(region.clip ? { clip: region.clip } : {}) });
    if (lines.length) lesson.push({ kind: 'stroke', tool: id, paths: lines.map(i => i.line) });
    ends.push(lesson.length);
  });
  return { lesson: { id: 'portrait', title: 'Портрет', viewBox, palette, steps: lesson }, ends };
}
