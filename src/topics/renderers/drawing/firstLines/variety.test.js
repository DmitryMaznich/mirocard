import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHAPE_KINDS, PRACTICE_SETS, shapeDefinition, transformPoint, partPoint, demonstrationFrame } from './shapes.js';
import { createShapeAttempt, restoreShape } from './shapeAttempt.js';
import { trackProfile } from './trackProfile.js';
import { generateTasks } from '../engine.js';
import { checkpointKey, readCheckpoint, saveCheckpoint, readSheet, saveSheet } from './checkpoint.js';
const bank = [{ id: 'first_lines:short_line', conceptId: 'line', firstLines: { kind: 'short_line' } }];
const mode = { type: 'drawing_first_lines', params: { practiceSet: { default: 'mixed' } } };
const point = (part, fraction) => transformPoint(partPoint(part, fraction), part.frame);
function drawPart(a, i) {
  const part = a.shape.parts[i]; expect(a.begin(point(part, 0))).toBe(true);
  for (let n = 1; n <= 200; n++) a.move(point(part, n / 200), n * 20);
  return a.end();
}
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
describe('varied paths, sizes and input profiles', () => {
  for (const input of ['pen', 'touch']) for (const variant of [{ scale: .62, angle: 15, aspect: .9 }, { scale: 1.05, angle: -15, aspect: 1.08 }]) {
    for (const kind of SHAPE_KINDS) it(`${input} ${kind} ${variant.scale}: follows the actual transformed target`, () => {
      const a = createShapeAttempt(kind, undefined, trackProfile('normal', input), variant);
      for (let i = 0; i < a.shape.parts.length; i++) expect(drawPart(a, i)).toBe(i === a.shape.parts.length - 1);
      expect(a.state.done).toBe(true); expect(a.state.hadError).toBe(false);
      const local = { x: 412, y: 507 }, part = a.shape.parts[0];
      const inverse = transformPoint(transformPoint(local, part.frame), part.frame, true);
      expect(inverse.x).toBeCloseTo(local.x, 8); expect(inverse.y).toBeCloseTo(local.y, 8);
    });
  }
  for (const scale of [.62, 1.05]) it(`a deviation of 30 is an error for a stylus and allowed for a finger, size ${scale}`, () => {
    for (const input of ['pen', 'touch']) {
      const a = createShapeAttempt('short_line', undefined, trackProfile('normal', input), { scale, angle: 17 });
      const part = a.shape.parts[0], world = p => transformPoint(p, part.frame); let mistakes = 0;
      a.begin(world({ x: 320, y: 500 }));
      for (const p of [{x:450,y:500},{x:450,y:500+30/scale},{x:600,y:500+30/scale},{x:680,y:500}]) if (a.move(world(p), 500).mistake) mistakes++;
      expect(a.end()).toBe(input === 'touch'); expect(mistakes).toBe(input === 'pen' ? 1 : 0);
    }
  });
  for (const width of ['wide','normal','narrow']) it(`${width}: stylus width and tolerance are much smaller than finger settings`, () => {
    const pen = trackProfile(width,'pen'), finger = trackProfile(width,'touch');
    expect(finger.width / pen.width).toBeGreaterThan(3);
    expect(finger.width / 2 + finger.extra).toBeGreaterThan(3 * (pen.width / 2 + pen.extra));
  });
  for (const kind of ['arc','semicircle']) it(`${kind}: an open curve completes, a chord through it does not`, () => {
    const a = createShapeAttempt(kind, undefined, trackProfile('normal','touch'));
    a.begin(point(a.shape.parts[0],0)); a.move(point(a.shape.parts[0],1),1000);
    expect(a.end()).toBe(false); expect(a.state.hadError).toBe(true);
  });
  it('a deliberate zigzag succeeds but a straight shortcut through it cannot earn credit, even with the wide finger road', () => {
    const valid = createShapeAttempt('zigzag', undefined, trackProfile('wide','touch'));
    expect(drawPart(valid,0)).toBe(true); expect(valid.state.hadError).toBe(false);
    const flat = createShapeAttempt('zigzag', undefined, trackProfile('wide','touch'));
    flat.begin({x:250,y:500}); flat.move({x:750,y:500},1000);
    expect(flat.end()).toBe(false); expect(flat.state.hadError).toBe(true);
  });
  it('stores exact size, aspect, angle, strokes and current part across reload and on the sheet', () => {
    const variant = { scale: .73, angle: 13, aspect: 1 };
    const a = createShapeAttempt('parallelepiped', undefined, trackProfile('normal','pen'), variant);
    expect(drawPart(a,0)).toBe(false);
    const key = checkpointKey('kid','session','task'); saveCheckpoint(key,a.state);
    const restored = readCheckpoint(key,'parallelepiped',variant); expect(restored).toEqual(a.state);
    const b = createShapeAttempt('parallelepiped',restored,trackProfile('normal','pen'),variant);
    expect(b.state.part).toBe(1); for (let i=1;i<b.shape.parts.length;i++) expect(drawPart(b,i)).toBe(i===b.shape.parts.length-1);
    saveSheet('drawing-sheet:test',2,b.state); expect(readSheet('drawing-sheet:test')[2]).toEqual(b.state);
    expect(restoreShape({version:3,attempt:b.state},'parallelepiped',{...variant,scale:.95}).done).toBe(false);
  });
  it('models every part of compounds, including separate edges of the 3D box', () => {
    for (const kind of ['rectangle','rhombus','parallelepiped','zigzag_arc','arc_zigzag']) {
      const shape = shapeDefinition(kind); let elapsed=0;
      shape.parts.forEach((_,i) => { const frame=demonstrationFrame(shape,elapsed+shape.steps[i]+200); expect(frame.lift).toBe(shape.parts.length > 1 ? i : null); elapsed+=shape.steps[i]+400; });
      expect(demonstrationFrame(shape,shape.motionMs).progress).toBeCloseTo(1,10);
    }
  });
});
function seeded(seed) {
  return () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
}
it('random selection varies figures and dimensions, saves plain geometry, and respects focused practice', () => {
  vi.spyOn(Math,'random').mockImplementation(seeded(123));
  const tasks = generateTasks(mode,bank,15,{workSurface:'sheet'});
  expect(new Set(tasks.map(t=>t.exerciseKind)).size).toBe(15);
  expect(new Set(tasks.map(t=>t.variant.scale)).size).toBeGreaterThan(5);
  expect(tasks.filter(t=>t.breakBefore).map(t=>t.number)).toEqual([5,9,13]);
  expect(JSON.parse(JSON.stringify(tasks))).toEqual(tasks);
  vi.mocked(Math.random).mockImplementation(seeded(456));
  expect(generateTasks(mode,bank,15,{})).not.toEqual(tasks);
  for (const [practiceSet,kinds] of Object.entries(PRACTICE_SETS)) {
    const lesson=generateTasks(mode,bank,15,{practiceSet});
    expect(lesson.every(t=>kinds.includes(t.exerciseKind))).toBe(true);
    expect(new Set(lesson.slice(0,Math.min(15,kinds.length)).map(t=>t.exerciseKind)).size).toBe(Math.min(15,kinds.length));
    for(let i=1;i<lesson.length;i++) expect(lesson[i].exerciseKind).not.toBe(lesson[i-1].exerciseKind);
  }
  const focused=generateTasks(mode,bank,15,{preciseSelection:true,exercises:['circle']});
  expect(focused.every(t=>t.exerciseKind==='circle')).toBe(true);
  expect(new Set(focused.map(t=>t.variant.scale)).size).toBeGreaterThan(5);
  // Old saved exact-selection values must not silently disable the new mixed default.
  expect(new Set(generateTasks(mode,bank,15,{exercises:['short_line']}).map(t=>t.exerciseKind)).size).toBe(15);
});

it('resumes a continuous zigzag/arc/zigzag after reload without forgetting visited corners or joining across a lift', () => {
  const variant={scale:.68,angle:90,aspect:1}, profile=trackProfile('normal','pen');
  const a=createShapeAttempt('zigzag_arc_zigzag',undefined,profile,variant),part=a.shape.parts[0];
  a.begin(point(part,0));for(let i=1;i<=90;i++)a.move(point(part,i/200),i*20);
  expect(a.end()).toBe(false);expect(a.state.hadError).toBe(false);
  const count=a.state.parts[0].corner;expect(count).toBeGreaterThan(0);
  const key=checkpointKey('kid','session','continuous');saveCheckpoint(key,a.state);
  const b=createShapeAttempt('zigzag_arc_zigzag',readCheckpoint(key,'zigzag_arc_zigzag',variant),profile,variant);
  expect(b.state.parts[0].corner).toBe(count);
  expect(b.begin(transformPoint(b.state.parts[0].anchor,part.frame))).toBe(true);
  for(let i=90;i<=200;i++)b.move(point(part,i/200),i*20);
  expect(b.end()).toBe(true);expect(b.state.hadError).toBe(false);expect(b.state.parts[0].strokes).toHaveLength(2);
});

it('keeps older installed drawing ZIPs compatible until the topic is updated', () => {
  const old={type:'drawing_first_lines',params:{exercises:{values:SHAPE_KINDS.slice(0,6).concat('square')}}};
  const tasks=generateTasks(old,bank,15,{exercises:[],workSurface:'sheet'});
  expect(tasks.every(t=>old.params.exercises.values.includes(t.exerciseKind))).toBe(true);
  expect(tasks.every(t=>t.variant===undefined)).toBe(true);
  expect(tasks.slice(0,7).map(t=>t.exerciseKind)).toEqual(old.params.exercises.values);
  expect(tasks.filter(t=>t.breakBefore).map(t=>t.number)).toEqual([5,9,13]);
  expect(generateTasks({type:'drawing_first_lines'},bank,15,{}).every(t=>t.exerciseKind==='short_line'&&t.variant===undefined)).toBe(true);
});

it('never stretches an old fixed-line checkpoint into a newly randomized figure', () => {
  const a=createShapeAttempt('short_line');drawPart(a,0);
  const old={version:1,attempt:a.state.parts[0]};
  expect(restoreShape(old,'short_line').done).toBe(true);
  expect(restoreShape(old,'short_line',{scale:.7,angle:12,aspect:1}).done).toBe(false);
});

it('varies the actual angle and length of straight lines, not only task metadata', () => {
  vi.spyOn(Math,'random').mockImplementation(seeded(789));
  const lesson=generateTasks(mode,bank,15,{preciseSelection:true,exercises:['short_line']});
  expect(new Set(lesson.map(t=>t.variant.angle)).size).toBeGreaterThan(3);
  expect(new Set(lesson.map(t=>t.variant.scale)).size).toBeGreaterThan(5);
  for(const task of lesson) {
    const part=shapeDefinition(task.exerciseKind,task.variant).parts[0],a=point(part,0),b=point(part,1);
    expect(Math.hypot(b.x-a.x,b.y-a.y)).toBeCloseTo(360*task.variant.scale,8);
    expect(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI).toBeCloseTo(task.variant.angle,8);
  }
});
