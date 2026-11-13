import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ParamsScreen from './ParamsScreen';
import { useAppStore } from '@/core/store';
import { setUiLanguage } from '@/shared/i18n/uiLanguage';
import { hashPin } from '@/shared/utils/pinHash';
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
  expect(host.querySelector('.video-prize-card')).toBeNull();
  expect(host.textContent).not.toContain('Ширина дорожки');
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

it('First Lines shows standard reward settings and keeps the paper bonus scoped to paper lessons', async () => {
  useAppStore.setState({ settings: { ...initial.settings, adultPinHash: await hashPin('1234') } });
  useAppStore.setState({ activeModeId: 'drawing_first_lines', studentTopicLinks: { kid_drawing: {
    videoRewardEnabled: true, answersPerStar: 3, strictStars: false,
    params: { byMode: { drawing_steps: { speed: 'slow', videoRewardEnabled: true } } },
  } } });
  await act(async () => root.render(<ParamsScreen />));
  expect(host.querySelector('.video-prize-card')).toBeTruthy();
  expect(host.querySelector('[aria-label="Видеобонус в конце рисования"]')).toBeNull();
  expect(host.textContent).not.toContain('Ширина дорожки');
  expect(host.textContent).toContain('Пассивным стилусом');
  expect(host.textContent).toContain('Рабочее поле');
  expect([...host.querySelectorAll('button')].find(button => button.textContent.trim() === 'Круг')).toBeUndefined();
  await act(async () => host.querySelector('[role=switch][aria-label="Выбрать отдельные упражнения"]').click());
  for (const label of ['Круг', 'Овал', 'Квадрат', 'Общий лист — автоматически']) {
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent.trim() === label).click());
  }
  const start = [...host.querySelectorAll('button')].find(button => button.textContent.trim() === 'Начать занятие');
  await act(async () => start.click());
  expect(host.querySelector('.pin-gate-overlay')).toBeTruthy();
  for (const digit of ['1', '2', '3', '4']) {
    await act(async () => [...host.querySelectorAll('.pin-key')].find(button => button.textContent === digit).click());
  }
  await vi.waitFor(() => expect(mocks.persist).toHaveBeenCalled());
  expect(mocks.persist).toHaveBeenCalledWith('kid', 'drawing', expect.objectContaining({
    videoRewardEnabled: true, answersPerStar: 3, strictStars: false,
    params: expect.objectContaining({ byMode: expect.objectContaining({
      drawing_steps: expect.objectContaining({ speed: 'slow', videoRewardEnabled: true }),
      drawing_first_lines: expect.objectContaining({ exercises: ['circle', 'oval', 'square'], preciseSelection: true, workSurface: 'sheet' }),
    }) }),
  }));
});

it('coloring hides concepts and saves the selected pen width in its own mode', async () => {
  useAppStore.setState({ activeModeId: 'drawing_coloring', studentTopicLinks: {kid_drawing:{params:{},videoRewardEnabled:false}},
    students:[{id:'kid',name:'Миша',rewardVideos:[]}] });
  await act(async()=>root.render(<ParamsScreen />));
  expect(host.querySelector('.param-concept-dots')).toBeNull();
  expect(host.textContent).not.toContain('Понятия');
  const row=[...host.querySelectorAll('.param-row')].find(n=>n.querySelector('.param-label')?.textContent==='Толщина пера');
  expect(row).toBeTruthy();
  const option=row.querySelector('input[type=range]');
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(option,'17');option.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(row.querySelector('output').textContent).toBe('17px');
  for(const [label,value] of [['Допустимый выход за контур',7],['Заполнить внутри фигуры',87]]) {
    const slider=[...host.querySelectorAll('input[type=range]')].find(n=>host.querySelector(`label[for="${n.id}"]`)?.textContent===label);
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,String(value));slider.dispatchEvent(new Event('input',{bubbles:true}));});
  }
  const start=[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='Начать занятие');
  await act(async()=>start.click());
  expect(mocks.persist).toHaveBeenCalledWith('kid','drawing',expect.objectContaining({params:expect.objectContaining({byMode:expect.objectContaining({drawing_coloring:expect.objectContaining({penWidth:17,outsideTolerance:7,fillTarget:87})})})}));
});
