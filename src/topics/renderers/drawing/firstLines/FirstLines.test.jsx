import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FirstLines from './FirstLines.jsx';
import { createSessionState, handleStreakReset, handleAnswer, handleAdvance } from '@/features/session/sessionEngine.js';
import { generateTasks } from '../engine.js';
import { checkpointKey, saveCheckpoint } from './checkpoint.js';
import { createLineAttempt } from './lineAttempt.js';

const tasks = generateTasks({ type: 'drawing_first_lines' }, [{ id: 'line', conceptId: 'line', firstLines: { kind: 'short_line' } }]);
let root, host, latest, errors, successes;
function Harness({ strict = true, loss = 'one', perStar = 1, disabled = false, input = 'pen', initial }) {
  const [state, setState] = useState(() => initial ?? {
    ...createSessionState(tasks, { evaluation: 'auto' }, 'kid', 'drawing', '0.15.0', ['line'], null, false, perStar, strict, { version: 2, lossMode: loss }),
    id: 'session-test', streakCount: 3 * perStar,
  });
  useEffect(() => { latest = state; }, [state]);
  return <FirstLines key={state.taskIndex} task={state.tasks[state.taskIndex]} student={{ id: 'kid' }} sessionId={state.id}
    sessionParams={{ inputMode: input }} interactionDisabled={disabled} sessionStatus={state.status} rewardAttemptBlocked={state.rewardAttemptBlocked}
    onStreakReset={(concept, card) => { errors(); setState(s => handleStreakReset(s, concept, card)); }}
    onCorrect={(concept, card) => { successes(); setState(s => handleAnswer(s, true, concept, card)); }}
    onAdvance={() => setState(handleAdvance)} />;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); errors = vi.fn(); successes = vi.fn();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 1000 });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function send(type, x, y = 500, pointerType = 'pen', id = 1) {
  await act(async () => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: id }, pointerType: { value: pointerType } });
    host.querySelector('.first-lines__board').dispatchEvent(event);
  });
}
async function draw() { await send('pointerdown', 320); await send('pointermove', 680); await send('pointerup', 680); }
async function fail() { await send('pointerdown', 320); await send('pointermove', 450); await send('pointermove', 450, 650); await send('pointerup', 450, 650); }

describe('First Lines and the real session reward policy', () => {
  for (const strict of [true, false]) for (const loss of ['one', 'all']) for (const perStar of [1, 2, 3]) {
    it(`keeps correction blocked and next card eligible: strict=${strict}, loss=${loss}, perStar=${perStar}`, async () => {
      await act(async () => root.render(<Harness strict={strict} loss={loss} perStar={perStar} />));
      await fail();
      const expected = strict ? loss === 'all' ? 0 : 2 * perStar : 3 * perStar;
      expect(latest.streakCount).toBe(expected); expect(errors).toHaveBeenCalledTimes(1);
      const before = host.querySelectorAll('polyline').length;
      await send('pointerdown', 450, 540); await send('pointermove', 470, 700); await send('pointerup', 470, 700);
      expect(errors).toHaveBeenCalledTimes(1);
      await send('pointerdown', 450, 540); await send('pointermove', 680); await send('pointerup', 680);
      expect(successes).toHaveBeenCalledTimes(1); expect(latest.streakCount).toBe(expected);
      expect(host.querySelectorAll('polyline').length).toBeGreaterThan(before);
      await send('pointerup', 680); expect(successes).toHaveBeenCalledTimes(1);
      await act(async () => host.querySelector('.first-lines__footer button').click());
      await draw(); expect(latest.streakCount).toBe(expected + 1);
    });
  }
  it('rejects palm touches and concurrent pointers, allows passive stylus only when selected', async () => {
    await act(async () => root.render(<Harness />));
    await send('pointerdown', 320, 500, 'touch'); await send('pointermove', 680, 500, 'touch'); await send('pointerup', 680, 500, 'touch');
    expect(host.querySelectorAll('polyline')).toHaveLength(0);
    await send('pointerdown', 320); await send('pointermove', 450);
    await send('pointerdown', 450, 700, 'touch', 2); await send('pointermove', 680, 700, 'touch', 2);
    await send('pointermove', 680); await send('pointerup', 680);
    expect(errors).not.toHaveBeenCalled(); expect(successes).toHaveBeenCalledTimes(1);
  });
  it('does not draw or credit while the standard prize or exit prompt disables input', async () => {
    await act(async () => root.render(<Harness disabled />)); await draw();
    expect(successes).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
    expect(host.querySelectorAll('polyline')).toHaveLength(0);
  });
  it('cancels a captured gesture when paused and resumes without a connecting jump', async () => {
    await act(async () => root.render(<Harness />));
    await send('pointerdown', 320); await send('pointermove', 460);
    await act(async () => host.querySelector('[aria-label="Пауза"]').click());
    await send('pointermove', 680); expect(successes).not.toHaveBeenCalled();
    await act(async () => host.querySelector('.first-lines__pause button').click());
    await send('pointerdown', 460); await send('pointermove', 680); await send('pointerup', 680);
    expect(successes).toHaveBeenCalledTimes(1); expect(errors).not.toHaveBeenCalled();
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
