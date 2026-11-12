import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '@/core/store';
import { getDb, kv } from '@/core/db';
import { useSessionEngine } from './useSessionEngine';
import { createSessionState } from './sessionEngine';
import { createActiveSessionSnapshot } from './activeSession';
import { generateTasks } from '@/topics/renderers/drawing/engine';

vi.mock('@/core/syncApi', () => ({ flushQueue: vi.fn().mockResolvedValue(undefined), pushOp: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/topics/renderers/engineRegistry', async () => ({ ENGINE_REGISTRY: { drawing: (await import('@/topics/renderers/drawing/engine')).generateTasks } }));
const topic = JSON.parse(await readFile('tools/drawing/topic.json', 'utf8'));
const mode = topic.modes.find(m => m.id === 'drawing_first_lines');
let root, host, engine;
function Exercise() {
  const current = useSessionEngine();
  useEffect(() => { engine = current; });
  return null;
}
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await kv.set(await getDb(), 'sessions', []);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function start(index, video = true) {
  const tasks = generateTasks(mode, topic.cards);
  const state = { ...createSessionState(tasks, mode, 'kid', 'drawing', topic.meta.version, ['first_lines:short_line'], null, false, 1, true, { version: 2, lossMode: 'one' }),
    taskIndex: index, correctCount: index, streakCount: 4 };
  useAppStore.setState({ account: null, students: [{ id: 'kid', rewardVideos: ['https://youtu.be/aaaaaaaaaaa'], lessonFlow: { advance: 'auto', delaySeconds: 1 } }],
    activeStudentId: 'kid', activeTopicId: 'drawing', activeModeId: mode.id, activeTextId: null,
    topicRecords: [topic], sessions: [], studentTopicLinks: { kid_drawing: { videoRewardEnabled: video } },
    activeSessionSnapshot: createActiveSessionSnapshot({ studentId: 'kid', topicId: 'drawing', modeId: mode.id }, state) });
  await act(async () => root.render(<Exercise />));
  expect(engine.sessionState.taskIndex).toBe(index);
  // A zero-delay renderer request is the tightest race between showing a prize and advancing.
  await act(async () => engine.onCorrect('first_lines:short_line', 'first_lines:short_line', { autoAdvance: true, autoAdvanceDelayMs: 0 }));
  await act(async () => new Promise(resolve => setTimeout(resolve, 30)));
}

for (const index of [4, 14]) it(`holds automatic advance underneath the standard prize on card ${index + 1}`, async () => {
  await start(index);
  expect(engine.rewardPending).toBe(true);
  expect(engine.sessionState.taskIndex).toBe(index);
  expect(engine.completedRecord).toBeNull();
  await act(async () => engine.clearRewardPending());
  if (index === 14) {
    await act(async () => { await vi.waitFor(() => expect(engine.completedRecord).not.toBeNull()); });
    expect(engine.completedRecord.completionReason).toBe('series_completed');
  } else expect(engine.sessionState.taskIndex).toBe(5);
  expect(engine.rewardPending).toBe(false);
});

it('still finishes automatically when video rewards are disabled', async () => {
  await start(14, false);
  await act(async () => { await vi.waitFor(() => expect(engine.completedRecord).not.toBeNull()); });
  expect(engine.rewardPending).toBe(false);
});
