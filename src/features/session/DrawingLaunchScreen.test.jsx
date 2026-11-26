import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DrawingLaunchScreen from './DrawingLaunchScreen';
import { useAppStore } from '@/core/store';
import { setUiLanguage } from '@/shared/i18n/uiLanguage';
const mocks = vi.hoisted(() => ({ persist: vi.fn(), start: vi.fn() }));
vi.mock('@/core/linkUtils', () => ({ persistStudentTopicLink: mocks.persist }));
vi.mock('@/features/timer/TimerContext', () => ({ useTimer: () => ({ markSessionStart: mocks.start }) }));
vi.mock('@/shared/hooks/useTopicFile', () => ({ loadTopicFileUrl: vi.fn(async () => null) }));
const source = JSON.parse(await readFile('tools/drawing/topic.json', 'utf8'));
const cards = ['yellow_house', 'snowman_broom'].map((id, i) => ({ id, conceptId: id, primary: true, label: i ? 'Снеговик' : 'Домик', lesson: { id, title: i ? 'Снеговик' : 'Домик', viewBox: '0 0 200 200', steps: [{ kind: 'stroke', tool: 'black', paths: ['M10 10L90 90'] }] } }));
const topic = { ...source, cards };
const initial = useAppStore.getState();
let root, host;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); setUiLanguage('ru');
  useAppStore.setState({ activeStudentId: 'kid', activeTopicId: 'drawing', activeModeId: 'drawing_steps', activeTextId: null,
    students: [{ id: 'kid', name: 'Миша', rewardVideos: [] }], topicRecords: [topic], sessions: [],
    studentTopicLinks: { kid_drawing: { params: {}, videoRewardEnabled: false } }, screen: 'params', sessionReturnScreen: null, activeSessionSnapshot: null });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(initial, true); });
const click = async text => { const button = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === text); expect(button).toBeTruthy(); await act(async () => button.click()); };
it('chooses a drawing before settings and saves exactly the chosen card and settings at launch', async () => {
  await act(async () => root.render(<DrawingLaunchScreen />));
  expect(host.querySelector('h1').textContent).toBe('Выберите рисунок');
  expect(host.querySelectorAll('.drawing-card')).toHaveLength(2);
  expect(host.textContent).not.toContain('Начать занятие');
  await click('Снеговик'); expect(host.querySelector('h1').textContent).toBe('Снеговик');
  expect(host.textContent).not.toContain('Понятия');
  expect(host.querySelectorAll('.drawing-card')).toHaveLength(0);
  await click('Медленно');
  await click('Начать занятие');
  expect(mocks.persist).toHaveBeenCalledWith('kid', 'drawing', expect.objectContaining({ params: expect.objectContaining({ byMode: expect.objectContaining({ drawing_steps: expect.objectContaining({ drawingCardId: 'snowman_broom', speed: 'slow' }) }) }) }));
  expect(mocks.start).toHaveBeenCalledOnce(); expect(useAppStore.getState().screen).toBe('session');
});
it('returns from settings to the drawing gallery and can choose a different drawing', async () => {
  await act(async () => root.render(<DrawingLaunchScreen />)); await click('Домик');
  await act(async () => host.querySelector('.back-btn').click());
  expect(host.querySelector('h1').textContent).toBe('Выберите рисунок'); await click('Снеговик');
  expect(host.querySelector('h1').textContent).toBe('Снеговик');
  expect(mocks.persist).not.toHaveBeenCalled();
});
it('opens the current drawing settings directly only when returning from a running session', async () => {
  useAppStore.setState({ sessionReturnScreen: 'session', studentTopicLinks: { kid_drawing: { params: { byMode: { drawing_steps: { drawingCardId: 'yellow_house' } } } } } });
  await act(async () => root.render(<DrawingLaunchScreen />)); expect(host.querySelector('h1').textContent).toBe('Домик');
});
it('starts at the gallery for a new visit even when an older drawing is saved', async () => {
  useAppStore.setState({ studentTopicLinks: { kid_drawing: { params: { byMode: { drawing_steps: { drawingCardId: 'yellow_house' } } } } } });
  await act(async () => root.render(<DrawingLaunchScreen />)); expect(host.querySelectorAll('.drawing-card')).toHaveLength(2);
});
