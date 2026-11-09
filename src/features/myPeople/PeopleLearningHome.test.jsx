import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useAppStore } from '@/core/store';
import { getDb, kv } from '@/core/db';
import PeopleLearningHome from './PeopleLearningHome';
const sync = vi.hoisted(() => ({ list: vi.fn(async () => []), flushQueue: vi.fn(async () => {}) }));
vi.mock('@/topics/accountKv', () => ({ accountKv: { list: sync.list } }));
vi.mock('@/core/syncApi', () => ({ flushQueue: sync.flushQueue }));
vi.mock('@/features/timer/TimerContext', () => ({ useTimer: () => ({ markSessionStart() {} }) }));
vi.mock('./PeopleLearningTask', () => ({ LearningPhoto: ({ src }) => <img src={src} alt="" /> }));
let root, container;
function LegacyList({ hiddenModeIds = [], onBack, topItem }) {
  return <div>{topItem}Старые упражнения {['match_same', 'show_me', 'who_is_this'].filter(id => !hiddenModeIds.includes(id)).join(' ')}{onBack && <button onClick={onBack}>К плану</button>}</div>;
}
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent === text || b.querySelector('.mode-item__title')?.textContent === text);
const waitFor = async predicate => vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 2)); }); expect(predicate()).toBeTruthy(); });
const click = async text => { await waitFor(() => button(text)); await act(async () => { button(text).click(); }); };
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await kv.del(await getDb(), 'peopleLearning:owner:kid');
  const s = useAppStore.getState();
  s.setAccount({ id: 'owner' }); s.setStudents([{ id: 'kid', name: 'Мирон', myPeople: ['Анна', 'Иван', 'Саша', 'Маша', 'Ольга', 'Барсик'].map((name, i) => ({ id: `p${i}`, name, relation: i === 0 ? 'мама' : 'друг', type: i === 5 ? 'pet' : 'person', contexts: [i < 2 ? 'family' : i === 2 ? 'school' : i === 4 ? 'home' : 'friends'], photos: [`photo${i}`] })) }]);
  s.setActiveStudentId('kid'); s.setActiveTopicId('my_people'); s.patchSettings({ adultPinHash: null });
  s.setMyPeopleLaunchPlan(null); s.setActiveSessionSnapshot(null);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root.render(<PeopleLearningHome legacy={<LegacyList />} />); });
  await waitFor(() => button('Занятия по плану'));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
it('keeps the original route until an adult selects the new mechanics', async () => {
  expect(container.textContent).toContain('Старые упражнения');
  await click('Занятия по плану');
  await waitFor(() => container.textContent.includes('Здесь будут твои люди'));
  expect(button('Начать')).toBeUndefined();
});
it('launches the confirmed plan and an unconfirmed draft cannot alter it', async () => {
  await click('Занятия по плану'); await click('Для взрослого'); await click('Все параметры');
  await click('4 фото · 3 отвлекающих'); await click('Подготовить ребёнку');
  await click('Для взрослого'); await click('Все параметры'); await click('6 фото · 5 отвлекающих');
  await click('Сохранить черновик');
  await waitFor(() => button('Все параметры'));
  await act(async () => { container.querySelector('[aria-label="Назад"]').click(); });
  await click('Начать');
  await waitFor(() => useAppStore.getState().screen === 'session');
  expect(useAppStore.getState().activeModeId).toBe('people_learning_v2');
  expect(useAppStore.getState().myPeopleLaunchPlan.fieldSize).toBe(4);
});
it('preserves scoped field size while changing goal and activity', async () => {
  await click('Занятия по плану'); await click('Для взрослого'); await click('Все параметры');
  await click('6 фото · 5 отвлекающих'); await click('Сохранить черновик');
  await click('Кто он мне'); await click('Все параметры');
  expect(button('2 фото · 1 отвлекающих').getAttribute('aria-pressed')).toBe('true');
  await click('Имена');
  expect(button('6 фото · 5 отвлекающих').getAttribute('aria-pressed')).toBe('true');
});

it('saves category in the confirmed plan while keeping all distractors available', async () => {
  await click('Занятия по плану'); await click('Для взрослого'); await click('Школа'); await click('Все параметры');
  const targets = [...container.querySelectorAll('fieldset')].find(f => f.querySelector('legend')?.textContent === 'Кого учим');
  expect([...targets.querySelectorAll('input')]).toHaveLength(1);
  const pool = [...container.querySelectorAll('fieldset')].find(f => f.querySelector('legend')?.textContent === 'Откуда брать отвлекающие варианты');
  expect(pool.querySelectorAll('input:checked')).toHaveLength(6);
  await click('Подготовить ребёнку'); await click('Для взрослого');
  expect(button('Школа').getAttribute('aria-pressed')).toBe('true');
  await click('Семья');
  await act(async () => { container.querySelector('[aria-label="Назад"]').click(); });
  await click('Начать'); await waitFor(() => useAppStore.getState().screen === 'session');
  expect(useAppStore.getState().myPeopleLaunchPlan).toMatchObject({ category: 'school', targetPersonIds: ['p2'] });
});

it('shows «Другие упражнения» without the modes the plan covers, and goes back to the plan', async () => {
  expect(container.textContent).toContain('match_same show_me who_is_this');
  await click('Занятия по плану'); await click('Для взрослого'); await click('Другие упражнения');
  await waitFor(() => container.textContent.includes('Старые упражнения'));
  expect(container.textContent).toContain('match_same');
  expect(container.textContent).not.toContain('show_me');
  expect(container.textContent).not.toContain('who_is_this');
  expect(button('Занятия по плану')).toBeUndefined();
  await click('К плану');
  await waitFor(() => button('Все параметры'));
});
