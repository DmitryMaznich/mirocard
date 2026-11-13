export const SHAPE_TITLES = Object.freeze({
  short_line: 'Горизонтальная прямая', vertical_line: 'Вертикальная прямая', diagonal_up: 'Наклонная вверх', diagonal_down: 'Наклонная вниз',
  circle: 'Круг', oval: 'Овал', tilted_oval: 'Наклонный овал', square: 'Квадрат', rectangle: 'Прямоугольник', rhombus: 'Ромб',
  arc: 'Дуга', semicircle: 'Полуокружность', parallelepiped: 'Параллелепипед', zigzag: 'Зигзаг', wave: 'Волна',
  zigzag_arc: 'Зигзаг и дуга', arc_zigzag: 'Дуга и зигзаг', zigzag_arc_zigzag: 'Зигзаг, дуга и зигзаг', fence: 'Заборчик',
});
export const SHAPE_KINDS = Object.keys(SHAPE_TITLES);
export const PRACTICE_SETS = Object.freeze({
  mixed: SHAPE_KINDS,
  lines: ['short_line', 'vertical_line', 'diagonal_up', 'diagonal_down', 'arc', 'semicircle'],
  shapes: ['circle', 'oval', 'tilted_oval', 'square', 'rectangle', 'rhombus', 'parallelepiped'],
  patterns: ['zigzag', 'wave', 'fence', 'zigzag_arc', 'arc_zigzag', 'zigzag_arc_zigzag'],
});
export const knownShape = kind => Object.hasOwn(SHAPE_TITLES, kind);
const identity = { angle: 0, tx: 0, ty: 0, scale: 1 };
export function normalizeVariant(raw) {
  const legacy = { scale: Number.isFinite(raw?.scale) ? Math.max(.55, Math.min(1.1, raw.scale)) : 1,
    angle: Number.isFinite(raw?.angle) ? Math.max(-180, Math.min(180, raw.angle)) : 0,
    aspect: Number.isFinite(raw?.aspect) ? Math.max(.9, Math.min(1.08, raw.aspect)) : 1 };
  if (![4,5].includes(raw?.schema)) return legacy;
  const unit = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : .5;
  return { ...legacy, scale: 1, schema: raw.schema, seed: Number.isSafeInteger(raw.seed) ? raw.seed >>> 0 : 1,
    size: unit(raw.size), positionX: unit(raw.positionX), positionY: unit(raw.positionY) };
}
export function transformPoint(p, frame, inverse = false) {
  const angle = frame.angle * Math.PI / 180 * (inverse ? -1 : 1), scale = frame.scale ?? 1;
  const x = (p.x - 500 - (inverse ? frame.tx : 0)) * (inverse ? 1 : scale);
  const y = (p.y - 500 - (inverse ? frame.ty : 0)) * (inverse ? 1 : scale);
  return { x: 500 + (x * Math.cos(angle) - y * Math.sin(angle)) / (inverse ? scale : 1) + (inverse ? 0 : frame.tx),
    y: 500 + (x * Math.sin(angle) + y * Math.cos(angle)) / (inverse ? scale : 1) + (inverse ? 0 : frame.ty) };
}
export const frameTransform = frame => `translate(${frame.tx} ${frame.ty}) rotate(${frame.angle} 500 500) translate(500 500) scale(${frame.scale ?? 1}) translate(-500 -500)`;
function combineFrame(frame, variant) {
  const centre = transformPoint({ x: 500 + frame.tx, y: 500 + frame.ty }, { ...identity, ...variant });
  return { angle: frame.angle + variant.angle, scale: (frame.scale ?? 1) * variant.scale, tx: centre.x - 500, ty: centre.y - 500 };
}
function sampled(points, { closed = false, aspect = null, waypoints = [] } = {}) {
  let length = 0;
  const samples = points.map((p, i) => {
    if (i) length += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    return { ...p, s: length };
  });
  const end = samples.at(-1), baseLength = length;
  if (closed) for (const p of samples.slice(1)) { if (p.s > 80) break; samples.push({ ...p, s: baseLength + p.s }); }
  return { type: 'curve', frame: identity, points: samples, length: baseLength, closed, aspect, end,
    waypoints: waypoints.map(index => samples[index]), d: points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('') };
}
function ellipse(rx, ry, start = -Math.PI / 2, sweep = Math.PI * 2, cx = 500, cy = 500, aspect = null) {
  const closed = Math.abs(sweep - Math.PI * 2) < .001;
  const points = Array.from({ length: 361 }, (_, i) => ({ x: cx + rx * Math.cos(start + sweep * i / 360), y: cy + ry * Math.sin(start + sweep * i / 360) }));
  return sampled(points, { closed, aspect });
}
function polyline(vertices) {
  const points = [], waypoints = [];
  vertices.forEach(([x, y], i) => {
    if (!i) { points.push({ x, y }); return; }
    const a = vertices[i - 1], count = Math.ceil(Math.hypot(x - a[0], y - a[1]) / 3);
    for (let n = 1; n <= count; n++) points.push({ x: a[0] + (x - a[0]) * n / count, y: a[1] + (y - a[1]) * n / count });
    if (i < vertices.length - 1) waypoints.push(points.length - 1);
  });
  return sampled(points, { waypoints });
}
function joinPaths(parts) {
  const points = [], waypoints = [];
  parts.forEach((part, i) => {
    const offset = points.length ? points.length - 1 : 0;
    if (i) waypoints.push(offset);
    for (const corner of part.waypoints) waypoints.push(offset + part.points.indexOf(corner));
    points.push(...part.points.slice(i ? 1 : 0).map(p => ({ x: p.x, y: p.y })));
  });
  return sampled(points, { waypoints: [...new Set(waypoints)].sort((a,b)=>a-b) });
}
const straight = frame => ({ type: 'line', frame: { ...identity, ...frame }, length: 360, d: 'M320 500H680' });
function segment(a, b) {
  return straight({ angle: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI,
    tx: (a[0] + b[0]) / 2 - 500, ty: (a[1] + b[1]) / 2 - 500, scale: Math.hypot(b[0] - a[0], b[1] - a[1]) / 360 });
}
const polygon = vertices => vertices.map((p, i) => segment(p, vertices[(i + 1) % vertices.length]));
const square = polygon([[320,320],[680,320],[680,680],[320,680]]);
const definitions = {
  short_line: [straight(identity)], vertical_line: [straight({ angle: 90 })], diagonal_up: [straight({ angle: -45 })], diagonal_down: [straight({ angle: 45 })],
  circle: [ellipse(180,180, undefined, undefined, undefined, undefined, [.72,1.4])],
  oval: [ellipse(220,120, undefined, undefined, undefined, undefined, [1.35,3])],
  tilted_oval: [{ ...ellipse(220,120, undefined, undefined, undefined, undefined, [1.35,3]), frame: { ...identity, angle: -45 } }],
  square, rectangle: polygon([[270,360],[730,360],[730,640],[270,640]]),
  rhombus: polygon([[500,270],[690,500],[500,730],[310,500]]),
  arc: [ellipse(220,140, Math.PI, Math.PI, 500,570)],
  semicircle: [ellipse(200,200, Math.PI, Math.PI, 500,600)],
  zigzag: [polyline([[250,500],[350,420],[450,580],[550,420],[650,580],[750,500]])],
  fence: [polyline([[260,560],[260,440],[380,440],[380,560],[500,560],[500,440],[620,440],[620,560],[740,560]])],
  wave: [sampled(Array.from({ length: 361 }, (_, i) => ({ x: 250 + 500 * i / 360, y: 500 - 100 * Math.sin(i / 360 * Math.PI * 2) })))],
  zigzag_arc: [joinPaths([polyline([[250,500],[300,420],[350,580],[400,420],[450,500]]), ellipse(150,140, Math.PI, Math.PI, 600,500)])],
  arc_zigzag: [joinPaths([ellipse(150,140, Math.PI, Math.PI, 400,500), polyline([[550,500],[600,420],[650,580],[700,420],[750,500]])])],
  zigzag_arc_zigzag: [joinPaths([polyline([[250,500],[287,420],[325,580],[362,420],[400,500]]), ellipse(100,120,Math.PI,Math.PI,500,500),polyline([[600,500],[637,420],[675,580],[712,420],[750,500]])])],
  parallelepiped: [segment([300,380],[600,380]),segment([600,380],[600,700]),segment([600,700],[300,700]),segment([300,700],[300,380]),
    segment([300,380],[400,280]),segment([400,280],[700,280]),segment([700,280],[700,600]),segment([700,600],[600,700]),segment([700,280],[600,380])],
};
// A stored seed describes a generated contour, including the number of visible sides.
function proceduralParts(kind, seed, version) {
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const between = (a,b) => a + random() * (b-a);
  const count = (a,b) => Math.floor(between(a,b+1));
  const halfW=between(135,260),halfH=between(100,230);
  if (['short_line','vertical_line','diagonal_up','diagonal_down'].includes(kind)) return [segment([500-halfW,500],[500+halfW,500])];
  if (kind==='circle') { const r=between(130,230);return [ellipse(r,r,undefined,undefined,undefined,undefined,[.72,1.4])]; }
  if (kind==='oval'||kind==='tilted_oval') { const rx=between(180,260),ry=between(100,140);return [ellipse(rx,ry,undefined,undefined,undefined,undefined,[1.15,3.2])]; }
  if (['square','rectangle','rhombus','parallelepiped'].includes(kind)) {
    let vertices;
    if(kind==='rhombus')vertices=[[500,500-halfH],[500+halfW,500],[500,500+halfH],[500-halfW,500]];
    else {const h=kind==='square'?halfW:halfH;vertices=[[500-halfW,500-h],[500+halfW,500-h],[500+halfW,500+h],[500-halfW,500+h]];}
    let edges=polygon(vertices);
    if(kind==='parallelepiped') {
      const depth=between(65,130),a=vertices[0],b=vertices[1],c=vertices[2];
      const aa=[a[0]+depth,a[1]-depth],bb=[b[0]+depth,b[1]-depth],cc=[c[0]+depth,c[1]-depth];
      edges=[...edges,segment(a,aa),segment(aa,bb),segment(bb,cc),segment(cc,c),segment(bb,b)];
    }
    const start=count(0,edges.length-1),visible=count(1,edges.length);
    return [...edges.slice(start),...edges.slice(0,start)].slice(0,visible);
  }
  if(kind==='fence') {
    const teeth=count(2,3),height=between(60,110),left=500-halfW,step=halfW/teeth,vertices=[[left,500+height]];
    for(let i=0;i<teeth;i++){const x=left+2*i*step;vertices.push([x,500-height],[x+step,500-height],[x+step,500+height],[x+2*step,500+height]);}
    return [polyline(vertices)];
  }
  if(kind==='arc'||kind==='semicircle') {
    const rx=between(140,250),ry=kind==='semicircle'?rx:between(90,220),sweep=kind==='semicircle'?Math.PI:between(Math.PI*.5,Math.PI*1.5);
    const start=between(-Math.PI,Math.PI),direction=version===5&&random()<.5?-1:1;
    return [ellipse(rx,ry,start,sweep*direction)];
  }
  const zig = (x0,x1,amplitude,turns) => polyline(Array.from({length:turns+2},(_,i)=>[x0+(x1-x0)*i/(turns+1),i===0||i===turns+1?500:500+(i%2?-1:1)*amplitude]));
  if(kind==='zigzag')return [zig(500-halfW,500+halfW,between(65,140),count(2,6))];
  if(kind==='wave') {const cycles=between(.7,version===5?2.5:2),amp=between(55,135);return [sampled(Array.from({length:481},(_,i)=>({x:500-halfW+2*halfW*i/480,y:500-amp*Math.sin(i/480*Math.PI*2*cycles)})))];}
  const amp=between(60,120),turns=count(2,4),arcH=between(85,180);
  if(kind==='zigzag_arc')return [joinPaths([zig(240,440,amp,turns),ellipse(160,arcH,Math.PI,Math.PI,600,500)])];
  if(kind==='arc_zigzag')return [joinPaths([ellipse(160,arcH,Math.PI,Math.PI,400,500),zig(560,760,amp,turns)])];
  return [joinPaths([zig(240,400,amp,turns),ellipse(100,arcH,Math.PI,Math.PI,500,500),zig(600,760,amp,turns)])];
}
export function shapeDefinition(kind = 'short_line', rawVariant) {
  const id = knownShape(kind) ? kind : 'short_line', variant = normalizeVariant(rawVariant);
  let base = definitions[id];
  if (![4,5].includes(variant.schema) && ['oval', 'tilted_oval'].includes(id)) base = [{ ...ellipse(220 * variant.aspect, 120 / variant.aspect, undefined, undefined, undefined, undefined, [1.35,3]), frame: { ...identity, angle: id === 'tilted_oval' ? -45 : 0 } }];
  if (![4,5].includes(variant.schema) && id === 'rectangle') base = polygon([[500 - 230 * variant.aspect,500 - 140 / variant.aspect],[500 + 230 * variant.aspect,500 - 140 / variant.aspect],[500 + 230 * variant.aspect,500 + 140 / variant.aspect],[500 - 230 * variant.aspect,500 + 140 / variant.aspect]]);
  if ([4,5].includes(variant.schema)) base = proceduralParts(id, variant.seed, variant.schema);
  const parts = base.map(part => {
    const frame = combineFrame(part.frame, variant);
    return { ...part, frame, travelLength: part.length * frame.scale };
  });
  const steps = parts.map(p => p.type === 'line' ? 800 : Math.max(800, Math.min(2400, p.length * 2)));
  return { id, variant, title: [4,5].includes(variant.schema) && ['short_line','vertical_line','diagonal_up','diagonal_down'].includes(id) ? 'Прямая' : SHAPE_TITLES[id], parts, closed: ['circle','oval','tilted_oval','square','rectangle','rhombus','parallelepiped'].includes(id),
    length: parts.reduce((sum, p) => sum + p.travelLength, 0), steps,
    motionMs: parts.length > 1 ? steps.reduce((sum, ms) => sum + ms + 400, 0) : parts[0].type === 'line' ? 1200 : steps[0] };
}
export function partPoint(part, fraction) {
  const t = Math.max(0, Math.min(1, fraction));
  if (part.type === 'line') return { x: 320 + 360 * t, y: 500 };
  const s = t * part.length, i = part.points.findIndex(p => p.s >= s);
  if (i <= 0) return part.points[0];
  const a = part.points[i - 1], b = part.points[i], f = (s - a.s) / (b.s - a.s);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
// Draw only the visible prefix. Avoid normalized SVG dashes: transformed paths can
// rasterize into large bands on some tablet GPU/browser combinations.
export function partPrefix(part, fraction) {
  const t=Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0));
  const start=partPoint(part,0);
  if(t===0)return `M${start.x} ${start.y}`;
  if(part.type==='line'){const end=partPoint(part,t);return `M${start.x} ${start.y}L${end.x} ${end.y}`;}
  const limit=t*part.length,points=part.points.filter(p=>p.s<limit);
  points.push(partPoint(part,t));
  return points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join('');
}
export function sheetCell(slot) { const x = (slot % 2) * 500, y = Math.floor(slot / 2) * 500; return { x, y, tx: x - 125, ty: y - 125, scale: .75 }; }
export const cellTransform = cell => `translate(${cell.tx} ${cell.ty}) scale(${cell.scale})`;
export function demonstrationFrame(shape, elapsed, linear = false) {
  const ease = t => linear ? t : t * t * (3 - 2 * t), time = Math.max(0, Math.min(shape.motionMs, elapsed));
  if (shape.parts.length === 1) return { progress: ease(time / shape.motionMs), lift: null };
  let passed = 0, travelled = 0;
  for (let i = 0; i < shape.parts.length; i++) {
    const duration = shape.steps[i], phase = time - passed;
    if (phase < duration + 400 || i === shape.parts.length - 1) return { progress: (travelled + shape.parts[i].travelLength * ease(Math.min(1, phase / duration))) / shape.length, lift: phase >= duration ? i : null };
    passed += duration + 400; travelled += shape.parts[i].travelLength;
  }
}
