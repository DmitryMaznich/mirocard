import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { resolveModeSelection } from './useSessionEngine';
import { buildRewardProgress } from './rewardProgress';
const topic = JSON.parse(await readFile('tools/drawing/topic.json', 'utf8'));
const mode = topic.modes[0];
it('keeps the adult end bonus separate from the disabled cumulative video prize', () => {
  expect(mode).toMatchObject({ evaluation: 'none', adultVideoReward: true, hideVideoReward: true });
  expect(mode.params.videoRewardEnabled.default).toBe(false);
  const selection = resolveModeSelection(topic, mode, {
    videoRewardEnabled: false,
    params: { byMode: { drawing_steps: { videoRewardEnabled: true } } },
  }, false, null);
  expect(selection.sessionParams.videoRewardEnabled).toBe(true);
  expect(buildRewardProgress({ sessionState: { tasks: [1], correctCount: 50 }, mode,
    videoRewardEnabled: true, hasRewardVideos: true }).available).toBe(false);
});
