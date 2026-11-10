import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ParamsScreen from './ParamsScreen';
import { useAppStore } from '@/core/store';
import { setUiLanguage } from '@/shared/i18n/uiLanguage';
const mocks = vi.hoisted(() => ({ persist: vi.fn(), start: vi.fn() }));
vi.mock('@/core/linkUtils', () => ({ persistStudentTopicLink: mocks.persist }));
vi.mock('@/features/timer/TimerContext', () => ({ useTimer: () => ({ markSessionStart: mocks.start }) }));
const topic = JSON.parse(await readFile('tools/drawing/topic.json', 'utf8'));
const initial = useAppStore.getState();
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); setUiLanguage('ru');
  useAppStore.setState({ activeStudentId: 'kid', activeTopicId: 'drawing', activeModeId: 'drawing_steps', activeTextId: null,
    students: [{ id: 'kid', name: 'Миша', rewardVideos: ['https://youtu.be/aaaaaaaaaaa'] }], topicRecords: [structuredClone(topic)], sessions: [],
    // Legacy cumulative reward was on. The topic must hide and disable it.
    studentTopicLinks: { kid_drawing: { params: {}, videoRewardEnabled: true } }, screen: 'params', sessionReturnScreen: null });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(initial, true); });
it('shows an off-by-default end-bonus switch and launches without the cumulative reward or a start PIN', async () => {
  await act(async () => root.render(<ParamsScreen />));
  const toggle = host.querySelector('[role=switch][aria-label="Видеобонус в конце рисования"]');
  expect(toggle).toBeTruthy(); expect(toggle.getAttribute('aria-checked')).toBe('false');
  expect(host.querySelector('.reward-config')).toBeNull();
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  const start = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === 'Начать занятие');
  await act(async () => start.click());
  expect(host.querySelector('.pin-gate-overlay')).toBeNull();
  expect(mocks.persist).toHaveBeenCalledWith('kid', 'drawing', expect.objectContaining({
    videoRewardEnabled: false,
    params: expect.objectContaining({ byMode: expect.objectContaining({ drawing_steps: expect.objectContaining({ videoRewardEnabled: true }) }) }),
  }));
  expect(mocks.start).toHaveBeenCalledOnce();
});
