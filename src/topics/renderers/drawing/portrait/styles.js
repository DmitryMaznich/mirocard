// «Портрет по кубику» styles. A style is a list of steps; each step has six variants (one per die face),
// a transform that puts its artwork on the face, a crop for the variant cards and dashed placement hints.
//   simple  — «Простое лицо»: only dots, circles, straight lines and arcs (what «Первые линии» teach);
//             paired parts (eyes, ears) are one step, drawn in face coordinates around the chosen face.
//   picasso — the original prototype (docs/mockups/drawing-portrait-dice/), parts drawn in 0 0 180 160.
import { FACES, HAIR_TRANSFORMS, PART_FILLS, PART_LABELS, PART_NAMES, PART_TRANSFORMS, PARTS, PLACEMENTS } from './parts.js';

export const STYLE_IDS = ['simple', 'picasso'];
export const FACE_VIEWBOX = '0 -28 220 268';
// «Простое лицо» has a neck and shoulders, so its sheet is taller and a little wider.
const SIMPLE_VIEWBOX = '-24 -30 268 312';

// ---- «Простое лицо» ----------------------------------------------------------------------------
// Faces are superellipses: n = 2 is an ellipse, a larger n is a rounded square.
const SIMPLE_FACES = [
  { name: 'Круглое', cx: 110, cy: 112, rx: 90, ry: 90, n: 2 },
  { name: 'Овальное', cx: 110, cy: 116, rx: 76, ry: 100, n: 2 },
  { name: 'Квадратное', cx: 110, cy: 114, rx: 84, ry: 92, n: 5 },
];
const f = value => Math.round(value * 10) / 10;
const at = (face, degrees, grow = 0) => {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), e = 2 / face.n;
  return { x: face.cx + (face.rx + grow) * Math.sign(c) * Math.abs(c) ** e, y: face.cy + (face.ry + grow) * Math.sign(s) * Math.abs(s) ** e };
};
// Angles spread evenly along the outline (by length), so hair looks the same on a round and a square face.
function evenAngles(face, from, to, count) {
  const fine = Array.from({ length: 721 }, (_, i) => from + (to - from) * i / 720);
  const lengths = [0];
  for (let i = 1; i < fine.length; i++) { const a = at(face, fine[i - 1]), b = at(face, fine[i]); lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y)); }
  const total = lengths.at(-1);
  return Array.from({ length: count }, (_, k) => { const goal = total * k / (count - 1), i = lengths.findIndex(l => l >= goal); return fine[Math.max(0, i)]; });
}
const outline = face => `M${Array.from({ length: 96 }, (_, i) => { const p = at(face, i * 3.75); return `${f(p.x)} ${f(p.y)}`; }).join(' L')}Z`;
const circle = (x, y, r) => `M${f(x + r)} ${f(y)} A${f(r)} ${f(r)} 0 1 0 ${f(x - r)} ${f(y)} A${f(r)} ${f(r)} 0 1 0 ${f(x + r)} ${f(y)}`;
const ellipse = (x, y, rx, ry) => `M${f(x + rx)} ${f(y)} A${f(rx)} ${f(ry)} 0 1 0 ${f(x - rx)} ${f(y)} A${f(rx)} ${f(ry)} 0 1 0 ${f(x + rx)} ${f(y)}`;
const line = (a, b) => `M${f(a.x)} ${f(a.y)} L${f(b.x)} ${f(b.y)}`;
const pair = (draw, left, right) => `${draw(left, -1)} ${draw(right, 1)}`;

function simpleSteps(face) {
  const u = face.rx / 84, eyeY = face.cy - face.ry * .22, browY = eyeY - 24 * u, eyeDX = face.rx * .4, noseY = face.cy + face.ry * .12, mouthY = face.cy + face.ry * .48;
  const eyes = [{ x: face.cx - eyeDX, y: eyeY }, { x: face.cx + eyeDX, y: eyeY }];
  const both = draw => `${draw(eyes[0], -1)} ${draw(eyes[1], 1)}`;
  const ears = [at(face, 180), at(face, 0)];
  const ear = draw => pair(draw, ears[0], ears[1]);
  const top = (from, to, count) => evenAngles(face, from, to, count);
  const n = { x: face.cx, y: noseY }, m = { x: face.cx, y: mouthY }, w = 24 * u;
  return [
    { name: 'Глаза', icon: [face.cx - face.rx * .78, eyeY - 24, face.rx * 1.56, 48], places: eyes.map(e => [e.x, e.y, 15 * u, 12 * u]), variants: [
      { label: 'Точки', d: both(e => circle(e.x, e.y, 5 * u)), fill: both(e => circle(e.x, e.y, 5 * u)) },
      { label: 'Кружки', d: both(e => circle(e.x, e.y, 11 * u)) },
      { label: 'Кружки с точкой', d: both(e => circle(e.x, e.y, 12 * u)), fill: both(e => circle(e.x, e.y, 4.5 * u)) },
      { label: 'Дуги', d: both(e => `M${f(e.x - 12 * u)} ${f(e.y)} Q${f(e.x)} ${f(e.y + 11 * u)} ${f(e.x + 12 * u)} ${f(e.y)}`) },
      { label: 'Чёрточки', d: both(e => line({ x: e.x - 11 * u, y: e.y }, { x: e.x + 11 * u, y: e.y })) },
      { label: 'Овалы с точкой', d: both(e => ellipse(e.x, e.y, 14 * u, 9 * u)), fill: both(e => circle(e.x, e.y, 4.5 * u)) },
    ] },
    // Brows: lines and arcs only, always level — a slant would read as anger or sadness (no emotions here).
    { name: 'Брови', icon: [face.cx - face.rx * .78, browY - 22, face.rx * 1.56, 40], places: eyes.map(e => [e.x, browY, 16 * u, 8 * u]), variants: [
      { label: 'Дуги', d: both(e => `M${f(e.x - 13 * u)} ${f(browY + 3 * u)} Q${f(e.x)} ${f(browY - 7 * u)} ${f(e.x + 13 * u)} ${f(browY + 3 * u)}`) },
      { label: 'Прямые', d: both(e => line({ x: e.x - 13 * u, y: browY }, { x: e.x + 13 * u, y: browY })) },
      { label: 'Короткие', d: both(e => line({ x: e.x - 6 * u, y: browY }, { x: e.x + 6 * u, y: browY })) },
      { label: 'Длинные дуги', d: both(e => `M${f(e.x - 18 * u)} ${f(browY + 5 * u)} Q${f(e.x)} ${f(browY - 8 * u)} ${f(e.x + 18 * u)} ${f(browY + 5 * u)}`) },
      { label: 'Высокие дуги', d: both(e => `M${f(e.x - 12 * u)} ${f(browY)} Q${f(e.x)} ${f(browY - 14 * u)} ${f(e.x + 12 * u)} ${f(browY)}`) },
      { label: 'Густые', d: both(e => `M${f(e.x - 14 * u)} ${f(browY + 2 * u)} Q${f(e.x)} ${f(browY - 8 * u)} ${f(e.x + 14 * u)} ${f(browY + 2 * u)} Q${f(e.x)} ${f(browY - 2 * u)} ${f(e.x - 14 * u)} ${f(browY + 2 * u)}Z`),
        fill: both(e => `M${f(e.x - 14 * u)} ${f(browY + 2 * u)} Q${f(e.x)} ${f(browY - 8 * u)} ${f(e.x + 14 * u)} ${f(browY + 2 * u)} Q${f(e.x)} ${f(browY - 2 * u)} ${f(e.x - 14 * u)} ${f(browY + 2 * u)}Z`) },
    ] },
    { name: 'Нос', icon: [face.cx - 30, noseY - 26, 60, 50], places: [[n.x, n.y, 14 * u, 16 * u]], variants: [
      { label: 'Точка', d: circle(n.x, n.y, 4.5 * u), fill: circle(n.x, n.y, 4.5 * u) },
      { label: 'Кружок', d: circle(n.x, n.y, 9 * u) },
      { label: 'Чёрточка', d: line({ x: n.x, y: n.y - 14 * u }, { x: n.x, y: n.y + 10 * u }) },
      { label: 'Уголок', d: `M${f(n.x + 2 * u)} ${f(n.y - 15 * u)} L${f(n.x - 7 * u)} ${f(n.y + 9 * u)} L${f(n.x + 7 * u)} ${f(n.y + 9 * u)}` },
      { label: 'Треугольник', d: `M${f(n.x)} ${f(n.y - 14 * u)} L${f(n.x - 10 * u)} ${f(n.y + 9 * u)} L${f(n.x + 10 * u)} ${f(n.y + 9 * u)}Z` },
      { label: 'Дуга', d: `M${f(n.x - 9 * u)} ${f(n.y)} Q${f(n.x)} ${f(n.y + 13 * u)} ${f(n.x + 9 * u)} ${f(n.y)}` },
    ] },
    { name: 'Рот', icon: [face.cx - 38, mouthY - 24, 76, 48], places: [[m.x, m.y, 30 * u, 13 * u]], variants: [
      { label: 'Прямая', d: line({ x: m.x - w, y: m.y }, { x: m.x + w, y: m.y }) },
      { label: 'Улыбка', d: `M${f(m.x - w)} ${f(m.y - 4 * u)} Q${f(m.x)} ${f(m.y + 16 * u)} ${f(m.x + w)} ${f(m.y - 4 * u)}` },
      { label: 'Кружок', d: circle(m.x, m.y, 9 * u) },
      { label: 'Овал', d: ellipse(m.x, m.y, 18 * u, 8 * u) },
      { label: 'Полукруг', d: `M${f(m.x - 20 * u)} ${f(m.y - 5 * u)} L${f(m.x + 20 * u)} ${f(m.y - 5 * u)} A${f(20 * u)} ${f(18 * u)} 0 0 1 ${f(m.x - 20 * u)} ${f(m.y - 5 * u)}Z` },
      { label: 'Лодочка', d: `M${f(m.x - 22 * u)} ${f(m.y)} Q${f(m.x)} ${f(m.y - 11 * u)} ${f(m.x + 22 * u)} ${f(m.y)} Q${f(m.x)} ${f(m.y + 11 * u)} ${f(m.x - 22 * u)} ${f(m.y)}Z` },
    ] },
    { name: 'Уши', icon: [face.cx - face.rx - 34, face.cy - 40, face.rx * 2 + 68, 80], ghost: true, places: ears.map(e => [e.x, e.y, 16 * u, 22 * u]), variants: [
      { label: 'Полукруги', d: ear((e, s) => `M${f(e.x)} ${f(e.y - 16 * u)} A${f(16 * u)} ${f(16 * u)} 0 0 ${s > 0 ? 1 : 0} ${f(e.x)} ${f(e.y + 16 * u)}`) },
      { label: 'Кружки', d: ear((e, s) => circle(e.x + s * 12 * u, e.y, 12 * u)) },
      { label: 'Овалы', d: ear((e, s) => ellipse(e.x + s * 9 * u, e.y, 9 * u, 17 * u)) },
      { label: 'Маленькие дуги', d: ear((e, s) => `M${f(e.x)} ${f(e.y - 10 * u)} A${f(10 * u)} ${f(10 * u)} 0 0 ${s > 0 ? 1 : 0} ${f(e.x)} ${f(e.y + 10 * u)}`) },
      { label: 'Уголки', d: ear((e, s) => `M${f(e.x)} ${f(e.y - 14 * u)} L${f(e.x + s * 17 * u)} ${f(e.y - 4 * u)} L${f(e.x)} ${f(e.y + 12 * u)}`) },
      { label: 'Дуга в дуге', d: ear((e, s) => `M${f(e.x)} ${f(e.y - 17 * u)} A${f(17 * u)} ${f(17 * u)} 0 0 ${s > 0 ? 1 : 0} ${f(e.x)} ${f(e.y + 17 * u)} M${f(e.x)} ${f(e.y - 7 * u)} A${f(7 * u)} ${f(7 * u)} 0 0 ${s > 0 ? 1 : 0} ${f(e.x)} ${f(e.y + 7 * u)}`) },
    ] },
    { name: 'Волосы', icon: [face.cx - face.rx - 30, face.cy - face.ry - 40, face.rx * 2 + 60, face.ry * 1.85], ghost: true,
      places: [[face.cx, face.cy - face.ry - 4, face.rx * .8, 24 * u]], variants: [
      { label: 'Ёжик', d: top(205, 335, 11).map(a => line(at(face, a), at(face, a, 17 * u))).join(' ') },
      { label: 'Шапочка', d: (() => { const a = top(190, 350, 21).map(deg => at(face, deg, 13 * u)), s = at(face, 190), e = at(face, 350);
        return `M${f(s.x)} ${f(s.y)} L${a.map(p => `${f(p.x)} ${f(p.y)}`).join(' L')} L${f(e.x)} ${f(e.y)}`; })() },
      { label: 'Кудряшки', d: top(208, 332, 7).map(a => { const p = at(face, a, 4 * u); return circle(p.x, p.y, 9 * u); }).join(' ') },
      { label: 'Зигзаг', d: (() => { const a = top(200, 340, 15).map((deg, i) => at(face, deg, i % 2 ? 16 * u : 0)); return `M${a.map(p => `${f(p.x)} ${f(p.y)}`).join(' L')}`; })() },
      // One line: down the left side, over the head, down the right side.
      { label: 'Длинные', d: (() => { const cap = top(180, 360, 25).map(deg => at(face, deg, 12 * u)), low = face.cy + face.ry * .7;
        return `M${f(cap[0].x)} ${f(low)} L${cap.map(p => `${f(p.x)} ${f(p.y)}`).join(' L')} L${f(cap.at(-1).x)} ${f(low)}`; })() },
      // A fringe of arcs hanging onto the forehead, one continuous line.
      { label: 'Чёлка', d: (() => { const p = top(218, 322, 6).map(deg => at(face, deg));
        return `M${f(p[0].x)} ${f(p[0].y)} ${p.slice(1).map((q, k) => { const a = p[k]; return `Q${f((a.x + q.x) / 2)} ${f(Math.max(a.y, q.y) + 22 * u)} ${f(q.x)} ${f(q.y)}`; }).join(' ')}`; })() },
    ] },
    neckStep(face, u),
  ];
}
// Neck (and shoulders): two straight lines from the chin, then what the child likes around them.
function neckStep(face, u) {
  const left = at(face, 108), right = at(face, 72), base = face.cy + face.ry + 34 * u, sx = face.rx * 1.12, sy = base + 30 * u;
  const neck = `M${f(left.x)} ${f(left.y)} L${f(left.x)} ${f(base)} M${f(right.x)} ${f(right.y)} L${f(right.x)} ${f(base)}`;
  const shoulders = `M${f(left.x)} ${f(base)} Q${f(face.cx - sx)} ${f(base)} ${f(face.cx - sx)} ${f(sy)} M${f(right.x)} ${f(base)} Q${f(face.cx + sx)} ${f(base)} ${f(face.cx + sx)} ${f(sy)}`;
  const mid = { x: face.cx, y: base };
  return { name: 'Шея', icon: [face.cx - sx - 12, face.cy + face.ry * .45, sx * 2 + 24, sy - face.cy - face.ry * .45 + 10], ghost: true,
    places: [[face.cx, base, sx * .75, 22 * u]], variants: [
      { label: 'Шея', d: neck },
      { label: 'Шея и плечи', d: `${neck} ${shoulders}` },
      { label: 'Воротник', d: `${neck} ${shoulders} M${f(left.x - 10 * u)} ${f(base - 2 * u)} L${f(mid.x)} ${f(base + 16 * u)} L${f(right.x + 10 * u)} ${f(base - 2 * u)}` },
      { label: 'Бусы', d: `${neck} ${shoulders} ${[-2, -1, 0, 1, 2].map(k => circle(mid.x + k * 9 * u, base - 6 * u + Math.abs(k) * -2 * u + 4 * u, 3.6 * u)).join(' ')}` },
      { label: 'Круглый вырез', d: `${neck} ${shoulders} M${f(left.x - 12 * u)} ${f(base)} Q${f(mid.x)} ${f(base + 24 * u)} ${f(right.x + 12 * u)} ${f(base)}` },
      { label: 'Бантик', d: `${neck} ${shoulders} M${f(mid.x)} ${f(base + 4 * u)} L${f(mid.x - 13 * u)} ${f(base - 4 * u)} L${f(mid.x - 13 * u)} ${f(base + 12 * u)}Z M${f(mid.x)} ${f(base + 4 * u)} L${f(mid.x + 13 * u)} ${f(base - 4 * u)} L${f(mid.x + 13 * u)} ${f(base + 12 * u)}Z` },
    ] };
}

// ---- «Пикассо» ---------------------------------------------------------------------------------
function picassoSteps(shape) {
  return PART_NAMES.map((name, part) => {
    const transform = part === 6 ? HAIR_TRANSFORMS[shape] : PART_TRANSFORMS[part];
    // Card icons are drawn in the part's own 0 0 180 160 space; only the face uses the transform.
    return { name, transform, icon: [0, 0, 180, 160], ownSpace: true, places: [PLACEMENTS[part]],
      variants: PARTS[part].map((d, i) => ({ label: PART_LABELS[part][i], d, fill: part < 2 ? PART_FILLS[part][i] || undefined : undefined })) };
  });
}

export const STYLES = {
  simple: { title: 'Простое лицо', viewBox: SIMPLE_VIEWBOX, faces: SIMPLE_FACES.map(face => ({ name: face.name, path: outline(face) })), stepCount: 7 },
  picasso: { title: 'Пикассо', viewBox: FACE_VIEWBOX, faces: FACES, stepCount: PART_NAMES.length },
};
// Steps depend on the chosen face: simple parts follow its outline, Picasso hair has a per-face transform.
export function styleSteps(style, shape) {
  return style === 'picasso' ? picassoSteps(shape ?? 0) : simpleSteps(SIMPLE_FACES[shape ?? 0]);
}
export const normalizeStyle = value => STYLE_IDS.includes(value) ? value : 'simple';
