import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { generateTasks } from '../engine.js';
import { resolveModeSelection, buildGeneratedSessionState } from '@/features/session/useSessionEngine.js';
import { getConceptCards, readModeParams, writeModeParams, writeModeSelectedConceptIds } from '@/shared/utils/topicUtils.js';

const topic = JSON.parse(await readFile('tools/drawing/topic.json', 'utf8'));
const paper = topic.modes.find(m => m.id === 'drawing_steps');
const lines = topic.modes.find(m => m.id === 'drawing_first_lines');

it('keeps six paper lessons separate from the new evaluated mode and its normal rewards', () => {
  expect(getConceptCards(topic, paper)).toHaveLength(6);
  expect(getConceptCards(topic, lines).map(c => c.id)).toEqual(['first_lines:short_line']);
  expect(lines).toMatchObject({ evaluation: 'auto', finite: true, paramsScope: 'mode' });
  for (const flag of ['hideVideoReward', 'adultVideoReward', 'rewardPerBlock', 'loop']) expect(lines[flag]).toBeUndefined();
  expect(lines.params.videoRewardEnabled).toBeUndefined();
  const stored = writeModeParams({ byMode: { drawing_steps: { speed: 'slow', videoRewardEnabled: true } } }, lines, { inputMode: 'touch' });
  expect(readModeParams(stored, paper)).toMatchObject({ speed: 'slow', videoRewardEnabled: true });
  expect(readModeParams(stored, lines)).toEqual({ inputMode: 'touch' });
});

it('ignores a stale selection of paper drawings and preserves 1/2/3 cards per star', () => {
  for (const perStar of [1, 2, 3]) {
    const link = { selectedConceptIds: ['kompot'], answersPerStar: perStar, strictStars: true, params: {} };
    const selection = resolveModeSelection(topic, lines, link, false, null);
    expect(selection.selectedConceptIds).toEqual(['first_lines:short_line']);
    const state = buildGeneratedSessionState({ topicRecord: topic, mode: lines, activeStudentId: 'kid', activeTopicId: 'drawing',
      activeStudent: { id: 'kid' }, link, ...selection });
    expect(state.tasks).toHaveLength(15); expect(state.answersPerStar).toBe(perStar);
    expect(state.tasks.filter(t => t.breakBefore).map(t => t.number)).toEqual([6, 11]);
    expect(new Set(state.tasks.map(t => t.id)).size).toBe(15);
    expect(state.rewardPolicy).toEqual({ version: 2, lossMode: 'one' });
  }
  expect(generateTasks(lines, [{ id: 'kompot', lesson: { steps: [1] } }])).toEqual([]);
});

it('preserves an old paper selection when the topic gains a separate pool of screen cards', () => {
  const old = ['gonya', 'donkey'];
  expect(resolveModeSelection(topic, paper, { selectedConceptIds: old }, false, null).selectedConceptIds).toEqual(old);
  const withLines = writeModeSelectedConceptIds(topic, lines, old, ['first_lines:short_line']);
  expect(resolveModeSelection(topic, paper, { selectedConceptIds: withLines }, false, null).selectedConceptIds).toEqual(old);
  const changed = writeModeSelectedConceptIds(topic, paper, withLines, ['kompot']);
  expect(resolveModeSelection(topic, paper, { selectedConceptIds: changed }, false, null).selectedConceptIds).toEqual(['kompot']);
  expect(resolveModeSelection(topic, lines, { selectedConceptIds: changed }, false, null).selectedConceptIds).toEqual(['first_lines:short_line']);
});
