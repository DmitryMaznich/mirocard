import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FirstLines from './FirstLines.jsx';
import { createSessionState, handleStreakReset, handleAnswer, handleAdvance } from '@/features/session/sessionEngine.js';
import { generateTasks } from '../engine.js';
import { checkpointKey, saveCheckpoint,readSheet,sheetKey } from './checkpoint.js';
import { createLineAttempt } from './lineAttempt.js';
import { partPoint, transformPoint, shapeDefinition, SHAPE_KINDS } from './shapes.js';
import { freshShape } from './shapeAttempt.js';
import { recordingContext } from './canvasTestContext.js';
import { drawingMarkers } from './canvasDrawing.js';
import { SCREENSHOT_ZIGZAG } from './testPaths.js';

const tasks = generateTasks({ type: 'drawing_first_lines' }, [{ id: 'line', conceptId: 'line', firstLines: { kind: 'short_line' } }], 15, { preciseSelection: true, exercises: ['short_line'] }).map(t => ({ ...t, variant: undefined }));
let root, host, latest, errors, successes;
function Harness({ advance = 'tap', strict = true, loss = 'one', perStar = 1, disabled = false, input = 'pen', width = 'normal', surface = 'single', initial, feedback }) {
  const [state, setState] = useState(() => initial ?? {
    ...createSessionState(tasks, { evaluation: 'auto' }, 'kid', 'drawing', '0.15.0', ['line'], null, false, perStar, strict, { version: 2, lossMode: loss }),
    id: 'session-test', streakCount: 3 * perStar,
  });
  useEffect(() => { latest = state; }, [state]);
  return <FirstLines key={state.taskIndex} task={state.tasks[state.taskIndex]} student={{ id: 'kid' }} sessionId={state.id}
    sessionParams={{ inputMode: input, trackWidth: width, workSurface: surface, advance }} interactionDisabled={disabled} sessionStatus={state.status} rewardAttemptBlocked={state.rewardAttemptBlocked}
    playFeedback={feedback} onStreakReset={(concept, card) => { errors(); setState(s => handleStreakReset(s, concept, card)); }}
    onCorrect={(concept, card, options) => { successes(options); setState(s => handleAnswer(s, true, concept, card)); }}
    onAdvance={() => setState(handleAdvance)} />;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); errors = vi.fn(); successes = vi.fn();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 1000 });
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(function(){return recordingContext(this);});
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function send(type, x, y = 500, pointerType = 'pen', id = 1) {
  await act(async () => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: pointerType } });
    host.querySelector('.first-lines__board').dispatchEvent(event);
  });
}
function saved(){const task=latest.tasks[latest.taskIndex];return JSON.parse(localStorage.getItem(checkpointKey('kid',latest.id,task.id)))?.attempt??freshShape(task.exerciseKind,task.variant);}
function strokes(){return saved().parts.flatMap(p=>[...(p.history??[]).flatMap(h=>h.strokes),...p.strokes]);}
function trace(){return JSON.stringify(strokes());}
function markers(){const a=saved(),shape=shapeDefinition(a.kind,a.variant),profile=a.profile??{width:24,ink:6};return drawingMarkers(a,shape,profile);}
async function draw() { await send('pointerdown', 320); await send('pointermove', 680); await send('pointerup', 680); }
async function fail() { await send('pointerdown', 320); await send('pointermove', 450); await send('pointermove', 450, 650); await send('pointerup', 450, 650); }

describe('First Lines and the real session reward policy', () => {
  for (const strict of [true, false]) it(`registers a zigzag once and never rewards its correction (strict=${strict})`, async () => {
    await act(async () => root.render(<Harness strict={strict} input="touch" />));
    await send('pointerdown', ...SCREENSHOT_ZIGZAG[0]);
    for (const xy of SCREENSHOT_ZIGZAG.slice(1)) await send('pointermove', ...xy);
    await send('pointerup', ...SCREENSHOT_ZIGZAG.at(-1));
    expect(errors).toHaveBeenCalledTimes(1); expect(successes).not.toHaveBeenCalled();
    expect(latest.status).toBe('task_active'); expect(latest.rewardAttemptBlocked).toBe(true);
    expect(host.textContent).toContain('Повтори от точки');
    const remaining = strict ? 2 : 3;
    expect(latest.streakCount).toBe(remaining);
    await draw();
    expect(latest.streakCount).toBe(remaining); expect(successes).toHaveBeenCalledTimes(1);
    expect(saved().hadError).toBe(true);expect(strokes().some(s=>s.failedFrom!==null)).toBe(true);
    await act(async () => host.querySelector('.first-lines__next').click());
    await draw(); expect(latest.streakCount).toBe(remaining + 1);
  });
  for (const [width, size, mistakes] of [['wide', 36, 0], ['normal', 24, 0], ['narrow', 16, 1]]) {
    it(`${width}: renders and evaluates the same width`, async () => {
      await act(async () => root.render(<Harness width={width} />));
      expect(host.querySelector('.first-lines__board').getAttribute('data-logical-track-width')).toBe(String(size));
      await send('pointerdown', 320); await send('pointermove', 450); await send('pointermove', 450, 514);
      await send('pointermove', 520, 514); await send('pointermove', 680); await send('pointerup', 680);
      expect(errors).toHaveBeenCalledTimes(mistakes);
      expect(successes).toHaveBeenCalledTimes(mistakes ? 0 : 1);
    });
  }
  it('shows the current part, keeps old ink as a ghost and lets the child interrupt the model by drawing', async () => {
    await act(async () => root.render(<Harness />));
    await send('pointerdown',320); await send('pointermove',450); await send('pointerup',450);
    await act(async () => host.querySelector('[aria-label="Показать движение"]').click());
    expect(host.querySelector('.first-lines__board').dataset.demo).toBe('true');
    expect(saved().parts[0].history[0].strokes[0].points.some(p=>p.x===450&&p.y===500)).toBe(true);
    expect(successes).not.toHaveBeenCalled();
    await draw();
    expect(host.querySelector('.first-lines__board').dataset.demo).toBeUndefined();
    expect(successes).toHaveBeenCalledTimes(1); expect(errors).not.toHaveBeenCalled();
  });
  for (const strict of [true, false]) for (const loss of ['one', 'all']) for (const perStar of [1, 2, 3]) {
    it(`keeps correction blocked and next card eligible: strict=${strict}, loss=${loss}, perStar=${perStar}`, async () => {
      await act(async () => root.render(<Harness strict={strict} loss={loss} perStar={perStar} />));
      await fail();
      const expected = strict ? loss === 'all' ? 0 : 2 * perStar : 3 * perStar;
      expect(latest.streakCount).toBe(expected); expect(errors).toHaveBeenCalledTimes(1);
      const before = strokes().length;
      await send('pointerdown', 320); await send('pointermove', 470, 700); await send('pointerup', 470, 700);
      expect(errors).toHaveBeenCalledTimes(1);
      await send('pointerdown', 320); await send('pointermove', 680); await send('pointerup', 680);
      expect(successes).toHaveBeenCalledTimes(1); expect(latest.streakCount).toBe(expected);
      expect(strokes().length).toBeGreaterThan(before);
      await send('pointerup', 680); expect(successes).toHaveBeenCalledTimes(1);
      await act(async () => host.querySelector('.first-lines__next').click());
      await draw(); expect(latest.streakCount).toBe(expected + 1);
    });
  }
  it('moves on by itself by default: no «Готово», no text, the app engine advances after a fixed pause', async () => {
    await act(async () => root.render(<Harness advance="auto" />));
    await draw();
    expect(successes).toHaveBeenCalledWith({ autoAdvance: true, autoAdvanceDelayMs: 900 });
    expect(host.querySelector('.first-lines__next')).toBeNull();
    expect(host.querySelector('.first-lines__live').textContent).toBe('Готово!');
    expect([...host.querySelectorAll('button')].every(b => !b.textContent.trim())).toBe(true);
  });
  it('rejects palm touches and concurrent pointers, allows passive stylus only when selected', async () => {
    await act(async () => root.render(<Harness />));
    await send('pointerdown', 320, 500, 'touch'); await send('pointermove', 680, 500, 'touch'); await send('pointerup', 680, 500, 'touch');
    expect(strokes()).toHaveLength(0);
    await send('pointerdown', 320); await send('pointermove', 450);
    await send('pointerdown', 450, 700, 'touch', 2); await send('pointermove', 680, 700, 'touch', 2);
    await send('pointermove', 680); await send('pointerup', 680);
    expect(errors).not.toHaveBeenCalled(); expect(successes).toHaveBeenCalledTimes(1);
  });
  it('does not draw or credit while the standard prize or exit prompt disables input', async () => {
    await act(async () => root.render(<Harness disabled />)); await draw();
    expect(successes).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
    expect(strokes()).toHaveLength(0);
  });
  it('reconciles a newer failed local checkpoint before crediting its completion after reload', async () => {
    const a = createLineAttempt(); a.begin({ x: 320, y: 500 }); a.move({ x: 450, y: 650 }); a.end();
    a.begin(a.state.anchor); a.move({ x: 680, y: 500 }); a.end();
    saveCheckpoint(checkpointKey('kid', 'session-test', tasks[0].id), a.state);
    await act(async () => root.render(<Harness />));
    expect(errors).toHaveBeenCalledTimes(1); expect(successes).toHaveBeenCalledTimes(1);
    expect(latest.streakCount).toBe(2); expect(latest.rewardAttemptBlocked).toBe(true);
  });
});

for (const strict of [true, false]) it(`square rewards once for four sides, correction remains blocked (strict=${strict})`, async () => {
  const squareTasks = tasks.map(t => ({ ...t, exerciseKind: 'square' }));
  const initial = { ...createSessionState(squareTasks, { evaluation: 'auto' }, 'kid', 'drawing', '0.16.0', ['line'], null, false, 1, strict, { version: 2, lossMode: 'one' }), id: 'session-test', streakCount: 3 };
  await act(async () => root.render(<Harness initial={initial} strict={strict} />));
  const sides = shapeDefinition('square').parts;
  const side = async i => {
    const from = transformPoint(partPoint(sides[i], 0), sides[i].frame), to = transformPoint(partPoint(sides[i], 1), sides[i].frame);
    await send('pointerdown', from.x, from.y); await send('pointermove', to.x, to.y); await send('pointerup', to.x, to.y);
  };
  await side(0); expect(successes).not.toHaveBeenCalled();
  expect(host.querySelector('.first-lines__board').tagName).toBe('CANVAS');expect(strokes()).toHaveLength(1);
  // Error on the right side, then lift and return to its checkpoint.
  await send('pointerdown', 680, 320); await send('pointermove', 850, 450); await send('pointerup', 850, 450);
  expect(errors).toHaveBeenCalledTimes(1);
  const anchor=markers().start;
  await send('pointerdown', anchor.x, anchor.y); await send('pointermove', 680, 680); await send('pointerup', 680, 680);
  await side(2); expect(successes).not.toHaveBeenCalled(); await side(3);
  expect(successes).toHaveBeenCalledTimes(1); expect(errors).toHaveBeenCalledTimes(1);
  expect(latest.streakCount).toBe(strict ? 2 : 3);
});

it('keeps previous actual drawings on a sheet after advancing and after reload', async () => {
  await act(async () => root.render(<Harness surface="sheet" />));
  // First slot uses the common worksheet transform in the logical 1000x1000 page.
  await send('pointerdown', 115, 250); await send('pointermove', 385, 250); await send('pointerup', 385, 250);
  expect(successes).toHaveBeenCalledTimes(1);
  await act(async () => host.querySelector('.first-lines__next').click());
  const previous=JSON.stringify(readSheet(sheetKey('kid',latest.id,0))[0].parts[0].strokes);
  expect(previous).toContain('320');expect(previous).toContain('680');
  // Tapping the completed cell must not draw or reward the new card.
  await send('pointerdown', 115, 250); await send('pointermove', 385, 250); await send('pointerup', 385, 250);
  expect(successes).toHaveBeenCalledTimes(1);
  const snapshot = latest;
  await act(async () => root.unmount()); root = createRoot(host);
  await act(async () => root.render(<Harness initial={snapshot} surface="sheet" />));
  expect(JSON.stringify(readSheet(sheetKey('kid',latest.id,0))[0].parts[0].strokes)).toBe(previous);
  await send('pointerdown', 615, 250); await send('pointermove', 885, 250); await send('pointerup', 885, 250);
  expect(successes).toHaveBeenCalledTimes(2); expect(errors).not.toHaveBeenCalled();
});

it('registers a curve shape error discovered on lift before allowing its correction', async () => {
  const ovalTasks = tasks.map(t => ({ ...t, exerciseKind: 'oval' }));
  const initial = { ...createSessionState(ovalTasks, { evaluation: 'auto' }, 'kid', 'drawing', '0.16.0', ['line'], null, false, 1, true, { version: 2, lossMode: 'one' }), id: 'session-test', streakCount: 3 };
  await act(async () => root.render(<Harness initial={initial} width="wide" input="touch" />));
  await send('pointerdown', 500, 380);
  for (let i = 1; i <= 80; i++) { const angle = -Math.PI / 2 + 2 * Math.PI * i / 80; await send('pointermove', 500 + 150 * Math.cos(angle), 530 + 150 * Math.sin(angle)); }
  expect(errors).not.toHaveBeenCalled();
  await send('pointerup', 500, 380);
  expect(errors).toHaveBeenCalledTimes(1); expect(successes).not.toHaveBeenCalled(); expect(latest.rewardAttemptBlocked).toBe(true);
  const part = shapeDefinition('oval').parts[0];
  await send('pointerdown', 500, 380);
  for (let i = 1; i <= 80; i++) { const p = partPoint(part, i / 80); await send('pointermove', p.x, p.y); }
  await send('pointerup', 500, 380);
  expect(successes).toHaveBeenCalledTimes(1); expect(latest.streakCount).toBe(2);
});

it('passive stylus accepts touch events with the narrow stylus profile', async () => {
  await act(async () => root.render(<Harness input="passive_pen" />));
  expect(host.querySelector('.first-lines__board').getAttribute('data-logical-track-width')).toBe('24');
  await send('pointerdown',320,500,'touch'); await send('pointermove',680,500,'touch'); await send('pointerup',680,500,'touch');
  expect(successes).toHaveBeenCalledTimes(1); expect(errors).not.toHaveBeenCalled();
});

it('stops ink at an error, waits for lift and visibly restarts only that part; repeated failures do not burn another star', async () => {
  const feedback=vi.fn(); await act(async()=>root.render(<Harness feedback={feedback}/>));
  await send('pointerdown',320);await send('pointermove',450);await send('pointermove',450,650);
  expect(host.querySelector('.first-lines').getAttribute('data-phase')).toBe('error');
  const stopped=trace();
  await send('pointermove',650,750);await send('pointermove',680,300);
  expect(trace()).toBe(stopped);
  expect(errors).toHaveBeenCalledTimes(1);
  await send('pointerup',680,300);
  expect(host.querySelector('.first-lines').getAttribute('data-phase')).toBe('retry');
  expect(markers().start.x).toBe(320);
  await fail(); expect(errors).toHaveBeenCalledTimes(1);expect(feedback).toHaveBeenCalledTimes(1);
  await act(async()=>host.querySelector('[aria-label="Показать движение"]').click());
  await draw();expect(successes).toHaveBeenCalledTimes(1);expect(latest.streakCount).toBe(2);
});

it('after finishing one side the model shows the next side, which can be copied immediately', async () => {
  const squareTasks=tasks.map(t=>({...t,exerciseKind:'square'}));
  const initial={...createSessionState(squareTasks,{evaluation:'auto'},'kid','drawing','0.17.0',['line'],null,false,1,true,{version:2,lossMode:'one'}),id:'session-test'};
  await act(async()=>root.render(<Harness initial={initial}/>));
  const sides=shapeDefinition('square').parts;
  for(let i=0;i<4;i++) {
    await act(async()=>host.querySelector('[aria-label="Показать движение"]').click());
    expect(host.querySelector('.first-lines__board').dataset.demo).toBe('true');
    expect(host.querySelector('.first-lines__board').dataset.part).toBe(String(i));
    const a=transformPoint(partPoint(sides[i],0),sides[i].frame),b=transformPoint(partPoint(sides[i],1),sides[i].frame);
    await send('pointerdown',a.x,a.y);await send('pointermove',b.x,b.y);await send('pointerup',b.x,b.y);
  }
  expect(successes).toHaveBeenCalledTimes(1);expect(errors).not.toHaveBeenCalled();
});

it('restoring an error at a paper-break card opens the correction point, without another paper interruption', async () => {
  const a=createLineAttempt();a.begin({x:320,y:500});a.move({x:450,y:650});a.end();
  saveCheckpoint(checkpointKey('kid','session-test',tasks[5].id),a.state);
  const initial={...createSessionState(tasks,{evaluation:'auto'},'kid','drawing','0.17.1',['line'],null,false,1,true,{version:2,lossMode:'one'}),id:'session-test',taskIndex:5};
  await act(async()=>root.render(<Harness initial={initial}/>));
  expect(host.querySelector('.first-lines__pause')).toBeNull();expect(host.querySelector('.first-lines').getAttribute('data-phase')).toBe('retry');
  await draw();expect(successes).toHaveBeenCalledTimes(1);expect(errors).toHaveBeenCalledTimes(1);
});

it('uses the same green start and hollow purple finish on every kind, including concentric markers for closed loops', async () => {
  for(const kind of SHAPE_KINDS) {
    const lesson=tasks.map(t=>({...t,exerciseKind:kind}));
    const initial={...createSessionState(lesson,{evaluation:'auto'},'kid','drawing','0.17.2',['line'],null,false,1,true,{version:2,lossMode:'one'}),id:'markers-'+kind};
    await act(async()=>root.render(<Harness key={kind} initial={initial}/>));
    expect(host.querySelector('.first-lines__board').tagName).toBe('CANVAS');
    const m=markers();expect(m.radius).toBeGreaterThan(0);expect(m.goalRadius).toBeGreaterThan(m.radius);
    if(['circle','oval','tilted_oval'].includes(kind)){expect(m.start.x).toBeCloseTo(m.finish.x,8);expect(m.start.y).toBeCloseTo(m.finish.y,8);}
    const part=shapeDefinition(kind).parts[0],p=transformPoint(partPoint(part,0),part.frame);
    await send('pointerdown',p.x,p.y);expect(markers().start.x).toBeCloseTo(p.x,8);expect(markers().start.y).toBeCloseTo(p.y,8);
  }
});

it('has no paper control or automatic paper break, while keeping the screen sheet', async () => {
  const initial={...createSessionState(tasks,{evaluation:'auto'},'kid','drawing','0.18.0',['line'],null,false,1,true,{version:2,lossMode:'one'}),id:'screen-only',taskIndex:5};
  await act(async()=>root.render(<Harness initial={initial} surface="sheet"/>));
  expect(host.querySelector('[aria-label="Повторить на бумаге"]')).toBeNull();expect(host.querySelector('.first-lines__pause')).toBeNull();
  expect(host.querySelectorAll('.first-lines__sheet>path')).toHaveLength(0);
});
