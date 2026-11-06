import { describe, it, expect } from 'vitest';
import { createSessionState, computeSessionRecord, handleAdvance } from '@/features/session/sessionEngine';
import { generateLearningTasks, defaultPlan } from './peopleLearning';
import { applyLearningEvent } from './peopleLearningSession';
import { createActiveSessionSnapshot, restoreActiveSessionState } from '@/features/session/activeSession';
const student = { id: 'kid', myPeople: ['Анна', 'Иван', 'Саша'].map((name, i) => ({ id: `p${i}`, name, relation: ['мама', 'папа', 'брат'][i], photos: [`photo${i}`] })) };
function setup(patch = {}) {
  const params = { ...defaultPlan(student), introMode: 'off', ...patch };
  const tasks = generateLearningTasks(student, params);
  const mode = { id: 'people_learning_v2', type: 'people_learning_v2', finite: true, evaluation: 'adult' };
  const state = createSessionState(tasks, mode, 'kid', 'my_people', '2.0.0', params.targetPersonIds, null, false, 1, true, { version: 2, lossMode: 'one' });
  state.statistics.conditions = { params }; state.statistics.myPeople = { schemaVersion: 2, trials: [], progress: {} };
  return state;
}
function event(state, value) { return applyLearningEvent(state, { trialId: state.tasks[state.taskIndex].trialId, ...value }); }
describe('v2 session scoring and recovery', () => {
  it('records wrong choice and correction as one prompted trial, loses stars once', () => {
    let s = setup(); s.streakCount = 3;
    const task = s.tasks[0], wrong = task.choices.find(c => c.personId !== task.targetPersonId);
    s = event(s, { type: 'choice', personId: wrong.personId }); expect(s.streakCount).toBe(2);
    s = event(s, { type: 'choice', personId: wrong.personId }); expect(s.streakCount).toBe(2);
    s = event(s, { type: 'choice', personId: task.targetPersonId });
    expect(s.statistics.myPeople.trials).toHaveLength(1); expect(s.statistics.myPeople.trials[0]).toMatchObject({ outcome: 'prompted', firstChoiceCorrect: false });
    expect(s.streakCount).toBe(2); expect(s.tasks.some(t => t.kind === 'retry')).toBe(true);
    expect(event(s, { type: 'choice', personId: task.targetPersonId })).toBe(s);
  });
  it('requested hint does not count as mistake and cannot earn an independent star', () => {
    let s = setup({ context: 'adult', activity: 'recall' }); s.streakCount = 3;
    s = event(s, { type: 'hint', level: 'prefix' }); expect(s.streakCount).toBe(3);
    s = event(s, { type: 'complete', outcome: 'independent' });
    expect(s.statistics.myPeople.trials[0].outcome).toBe('prompted'); expect(s.streakCount).toBe(3);
  });
  it('recovers assistance after restart and rejects a changed plan revision', () => {
    let s = setup({ context: 'adult', activity: 'recall', revision: 1 });
    s = event(s, { type: 'hint', level: 'model' });
    const context = { studentId: 'kid', topicId: 'my_people', modeId: 'people_learning_v2', topicVersion: '2.0.0', conceptIds: s.conceptIds, params: s.statistics.conditions.params };
    const snapshot = createActiveSessionSnapshot(context, JSON.parse(JSON.stringify(s)));
    let restored = restoreActiveSessionState(snapshot, context);
    restored = event(restored, { type: 'complete', outcome: 'independent' });
    expect(restored.statistics.myPeople.trials[0].outcome).toBe('prompted');
    expect(restoreActiveSessionState(snapshot, { ...context, params: { ...context.params, revision: 2 } })).toBeNull();
  });
  it('self practice is saved with no accuracy and no adult assessment', () => {
    let s = setup({ activity: 'recall', context: 'self' });
    s = event(s, { type: 'hint', level: 'model' }); s = event(s, { type: 'complete', outcome: 'practice' });
    const record = computeSessionRecord(s, 'kid', 'my_people', '2.0.0');
    expect(record.percentCorrect).toBeNull(); expect(record.correctCount).toBeNull(); expect(record.assessments).toBeUndefined();
    expect(record.statistics.myPeople.trials[0].outcome).toBe('practice'); expect(s.streakCount).toBe(0);
  });
  it('stale callback cannot complete another trial and real independent answers use existing reward policy', () => {
    let s = setup(), first = s.tasks[0];
    s = event(s, { type: 'choice', personId: first.targetPersonId }); expect(s.streakCount).toBe(1);
    s = handleAdvance(s); const before = s;
    expect(applyLearningEvent(s, { trialId: first.trialId, type: 'complete', outcome: 'independent' })).toBe(before);
  });
  it('keeps main accuracy separate from corrected retry results', () => {
    let s = setup({ context: 'adult', activity: 'recall' });
    s = event(s, { type: 'complete', outcome: 'not_recalled' });
    s.statistics.myPeople.trials.push({ ...s.statistics.myPeople.trials[0], trialId: 'retry', kind: 'retry', outcome: 'independent' });
    const record = computeSessionRecord(s, 'kid', 'my_people', '2.0.0');
    expect(record.percentCorrect).toBe(0); expect(record.correctCount).toBe(0); expect(record.incorrectCount).toBe(1);
  });
});
