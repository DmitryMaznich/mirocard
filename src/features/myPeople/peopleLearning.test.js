import { describe, it, expect } from 'vitest';
import { defaultPlan, planReadiness, generateLearningTasks, trialResult, learningSummary, insertLearningRetry, exposureKey, learningPhotoReferences, categoryPeople, chooseCategory, normalizePlan } from './peopleLearning';
import { personRelations, comparePeopleDocuments } from '../../../shared/my-people-v2.mjs';
import { mergePeopleCards, mergePeopleRecords } from '../../../shared/student-people.mjs';
const names = ['Анна', 'Иван', 'Саша', 'Ольга', 'Маша', 'Барсик'];
export const student = { id: 'kid', myPeople: names.map((name, i) => ({ id: `p${i}`, name, relation: ['мама', 'папа', 'подруга', 'учительница', 'сестра', 'кот'][i], type: i === 5 ? 'pet' : 'person', photos: [`photo${i}`, `photo${i}b`], enabled: true })) };
const plan = patch => ({ ...defaultPlan(student), introMode: 'off', ...patch });
describe('personal learning contracts', () => {
  it('filters target categories without restricting the separate distractor pool', () => {
    const s = structuredClone(student);
    s.myPeople.forEach((p, i) => { p.contexts = [i < 2 ? 'family' : i < 4 ? 'school' : 'friends']; });
    const original = plan({ fieldSize: 6 });
    const school = chooseCategory(s, original, 'school');
    expect(school.targetPersonIds).toEqual(['p2', 'p3']);
    expect(school.distractorPoolIds).toEqual(original.distractorPoolIds);
    const tasks = generateLearningTasks(s, school);
    expect(tasks).toHaveLength(6);
    expect(tasks.every(t => ['p2', 'p3'].includes(t.targetPersonId) && t.choices.length === 6)).toBe(true);
    expect(categoryPeople(s, 'pets').map(p => p.id)).toEqual(['p5']);
    expect(categoryPeople(s, 'pets', 'relation')).toEqual([]);
  });
  it('keeps old plan selections and refuses empty or stale category membership', () => {
    const old = plan({ targetPersonIds: ['p0'] });
    expect(normalizePlan(old, student)).toMatchObject({ category: 'all', targetPersonIds: ['p0'] });
    expect(planReadiness(student, { ...old, category: 'school' }).ready).toBe(false);
    expect(chooseCategory(student, old, 'school').targetPersonIds).toEqual([]);
    expect(generateLearningTasks(student, chooseCategory(student, old, 'school'))).toEqual([]);
  });

  it.each([2, 3, 4, 6])('generates exactly %i distinct choices for every target', fieldSize => {
    const tasks = generateLearningTasks(student, plan({ fieldSize, questionCount: 8 }));
    expect(tasks).toHaveLength(8);
    for (const task of tasks) { expect(task.choices).toHaveLength(fieldSize); expect(new Set(task.choices.map(c => c.personId)).size).toBe(fieldSize); }
    expect(new Set(tasks.map(t => t.trialId)).size).toBe(8);
  });
  it('refuses insufficient unambiguous distractors without lowering the field', () => {
    const duplicate = { ...student, myPeople: student.myPeople.map(p => ({ ...p, name: 'Саша' })) };
    expect(planReadiness(duplicate, plan({ fieldSize: 6 })).ready).toBe(false);
    expect(generateLearningTasks(duplicate, plan({ fieldSize: 6 }))).toEqual([]);
  });
  it('excludes aliases of the requested name and all true relationships', () => {
    const s = structuredClone(student); s.myPeople[2].nameVariants = ['Анна'];
    s.myPeople[0].relations = [{ key: 'friend_f', label: 'подруга' }];
    const tasks = generateLearningTasks(s, plan({ targetPersonIds: ['p0'], fieldSize: 4 }));
    expect(tasks.every(t => !t.choices.some(c => c.personId === 'p2'))).toBe(true);
    const relations = generateLearningTasks(s, plan({ goal: 'relation', targetPersonIds: ['p0'], questionCount: 4 }));
    const friend = relations.find(t => t.targetRelationKey === 'friend_f');
    expect(friend.choices.some(c => c.personId === 'p2')).toBe(false);
  });
  it('keeps the single legacy role, and multiple open roles are allowed without claiming all were spoken', () => {
    const s = structuredClone(student); s.myPeople[2].relations = [{ key: 'classmate_f', label: 'одноклассница' }];
    expect(personRelations(s.myPeople[2]).map(r => r.label)).toEqual(['подруга', 'одноклассница']);
    const [task] = generateLearningTasks(s, plan({ goal: 'relation', activity: 'recall', context: 'adult', targetPersonIds: ['p2'] }));
    const result = trialResult(task, {}, 'independent');
    expect(result.targetRelationKey).toBeNull(); expect(result.acceptedRelationKeys).toHaveLength(2);
  });
  it('pets can be name targets, never relationship targets', () => {
    expect(planReadiness(student, plan({ targetPersonIds: ['p5'] })).ready).toBe(true);
    expect(planReadiness(student, plan({ goal: 'relation', targetPersonIds: ['p5'] })).ready).toBe(false);
  });
  it('models are unscored presentations and precise exposure changes when the word changes', () => {
    const tasks = generateLearningTasks(student, plan({ introMode: 'new' }));
    const intro = tasks.find(t => t.kind === 'intro');
    expect(trialResult(intro, {}, 'independent').outcome).toBe('presented');
    expect(learningSummary([trialResult(intro, {}, 'presented')]).percentCorrect).toBeNull();
    const seen = Object.fromEntries(tasks.filter(t => t.kind === 'intro').map(t => [exposureKey(t), true]));
    expect(generateLearningTasks(student, plan({ introMode: 'new' }), seen).some(t => t.kind === 'intro')).toBe(false);
    const renamed = structuredClone(student); renamed.myPeople[0].name = 'Аня';
    expect(generateLearningTasks(renamed, plan({ introMode: 'new' }), seen).filter(t => t.kind === 'intro')).toHaveLength(1);
  });
  it('initial and requested assistance cannot become an independent answer', () => {
    const [task] = generateLearningTasks(student, plan({ activity: 'recall', context: 'adult', initialHint: 'prefix' }));
    expect(trialResult(task, {}, 'independent').outcome).toBe('prompted');
    expect(trialResult({ ...task, initialHint: 'none' }, { assistanceUsed: ['model'] }, 'independent').outcome).toBe('prompted');
  });
  it('self recall has no accuracy and skip stays distinct', () => {
    const [task] = generateLearningTasks(student, plan({ activity: 'recall' }));
    const result = trialResult(task, {}, 'independent'); expect(result.outcome).toBe('practice');
    expect(learningSummary([result]).percentCorrect).toBeNull(); expect(trialResult(task, {}, 'skipped').outcome).toBe('skipped');
  });
  it('retries retain source and move answer position, without retry chains', () => {
    const tasks = generateLearningTasks(student, plan({ fieldSize: 4 }));
    const next = insertLearningRetry(tasks, 0), retryIndex = next.findIndex(t => t.kind === 'retry');
    expect(retryIndex).toBeGreaterThanOrEqual(3);
    expect(next[retryIndex].sourceTrialId).toBe(tasks[0].trialId);
    expect(next[retryIndex].choices).not.toEqual(tasks[0].choices);
    expect(insertLearningRetry(next, retryIndex)).toEqual(next);
    expect(insertLearningRetry(next, 0)).toEqual(next);
  });
  it('stores real alternate photos separately and leaves main score unchanged by retries', () => {
    const tasks = generateLearningTasks(student, plan({ photoMode: 'available' }));
    expect(tasks.some(t => t.photoIndex === 1)).toBe(true);
    const result = trialResult(tasks[0], {}, 'prompted');
    const summary = learningSummary([result, { ...result, trialId: 'retry', kind: 'retry', outcome: 'independent' }]);
    expect(summary.checked).toBe(1); expect(summary.percentCorrect).toBe(0);
  });
  it('preserves v2 data after legacy edits and union-merges relationships and aliases', () => {
    const old = { ...student.myPeople[0], relations: [{ key: 'friend_f', label: 'подруга' }], nameVariants: ['Аня'], updatedAt: '2026-11-01' };
    const merged = mergePeopleRecords([old], [{ id: old.id, relation: 'мама', updatedAt: '2026-11-02' }]);
    expect(merged[0].relations).toEqual(old.relations);
    const cards = mergePeopleCards([old, { ...student.myPeople[2], nameVariants: ['Сашенька'] }], 'p2', 'p0', '2026-11-03');
    expect(cards[0].relations.map(r => r.label)).toContain('подруга'); expect(cards[0].nameVariants).toContain('Сашенька');
  });
  it('does not copy offline photo bytes into trial results', async () => {
    const s = structuredClone(student); s.myPeople[0].photos = ['data:image/jpeg;base64,AAAA'];
    const refs = await learningPhotoReferences(s);
    expect(refs.p0[0]).toMatch(/^\/api\/photos\/[a-f0-9]{32}$/);
    const [task] = generateLearningTasks(s, plan({ targetPersonIds: ['p0'], photoReferences: refs }));
    expect(JSON.stringify(trialResult(task, {}, 'independent'))).not.toContain('data:image');
  });
  it('orders scoped documents by revision, including deterministic concurrent confirmations', () => {
    expect(comparePeopleDocuments({ revision: 1, id: 'z' }, { revision: 2, id: 'a' })).toBeLessThan(0);
    expect(comparePeopleDocuments({ revision: 2, id: 'z' }, { revision: 2, id: 'a' })).toBeGreaterThan(0);
  });
});
