export const SHAPE_TITLES = Object.freeze({
  short_line: 'Горизонтальная прямая', vertical_line: 'Вертикальная прямая',
  diagonal_up: 'Наклонная вверх', diagonal_down: 'Наклонная вниз',
  circle: 'Круг', oval: 'Овал', square: 'Квадрат',
});
export const SHAPE_KINDS = Object.keys(SHAPE_TITLES);
export const knownShape = kind => Object.hasOwn(SHAPE_TITLES, kind);
const identity = { angle: 0, tx: 0, ty: 0 };

export function transformPoint(p, frame, inverse = false) {
  const angle = frame.angle * Math.PI / 180 * (inverse ? -1 : 1);
  const x = p.x - 500 - (inverse ? frame.tx : 0), y = p.y - 500 - (inverse ? frame.ty : 0);
  return { x: 500 + x * Math.cos(angle) - y * Math.sin(angle) + (inverse ? 0 : frame.tx),
    y: 500 + x * Math.sin(angle) + y * Math.cos(angle) + (inverse ? 0 : frame.ty) };
}
export const frameTransform = frame => `translate(${frame.tx} ${frame.ty}) rotate(${frame.angle} 500 500)`;

function curve(rx, ry) {
  const points = [];
  let length = 0;
  for (let i = 0; i <= 720; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 360;
    const p = { x: 500 + rx * Math.cos(angle), y: 500 + ry * Math.sin(angle) };
    if (i) length += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    points.push({ ...p, s: length });
  }
  const baseLength = length;
  // A start slightly past the dot can still close its own contour after one full turn.
  for (const p of points.slice(1)) {
    if (p.s > 80) break;
    points.push({ ...p, s: baseLength + p.s });
  }
  return { type: 'curve', frame: identity, points, length: baseLength,
    d: `M500 ${500 - ry}A${rx} ${ry} 0 1 1 500 ${500 + ry}A${rx} ${ry} 0 1 1 500 ${500 - ry}` };
}
const straight = frame => ({ type: 'line', frame, length: 360, d: 'M320 500H680' });
const definitions = {
  short_line: [straight(identity)],
  vertical_line: [straight({ ...identity, angle: 90 })],
  diagonal_up: [straight({ ...identity, angle: -45 })],
  diagonal_down: [straight({ ...identity, angle: 45 })],
  circle: [curve(180, 180)], oval: [curve(220, 120)],
  square: [straight({ angle: 0, tx: 0, ty: -180 }), straight({ angle: 90, tx: 180, ty: 0 }),
    straight({ angle: 180, tx: 0, ty: 180 }), straight({ angle: 270, tx: -180, ty: 0 })],
};
export function shapeDefinition(kind = 'short_line') {
  const id = knownShape(kind) ? kind : 'short_line';
  const parts = definitions[id];
  return { id, title: SHAPE_TITLES[id], parts, closed: ['circle', 'oval', 'square'].includes(id),
    length: parts.reduce((sum, p) => sum + p.length, 0), motionMs: id === 'square' ? 3200 : parts[0].type === 'curve' ? 2400 : 1200 };
}
export function partPoint(part, fraction) {
  const t = Math.max(0, Math.min(1, fraction));
  if (part.type === 'line') return { x: 320 + 360 * t, y: 500 };
  const s = t * part.length;
  const i = part.points.findIndex(p => p.s >= s);
  if (i <= 0) return part.points[0];
  const a = part.points[i - 1], b = part.points[i], f = (s - a.s) / (b.s - a.s);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
export function sheetCell(slot) {
  const x = (slot % 2) * 500, y = Math.floor(slot / 2) * 500;
  return { x, y, tx: x - 125, ty: y - 125, scale: .75 };
}
export function cellTransform(cell) { return `translate(${cell.tx} ${cell.ty}) scale(${cell.scale})`; }
