import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../lib/db.mjs';
import { createAccount, upsertStudent, upsertStudentMyPeople, getStudents, upsertAccountKv, getAllAccountKv, appendSession, getSessions } from '../lib/account-repository.mjs';
import { sessionToApi } from '../lib/session-statistics.mjs';
test('scoped plans reject stale offline versions and cross-account student writes, other KV unchanged', () => {
  const db = initDb(':memory:');
  try {
    const a = createAccount(db, { email: 'people@example.test', passwordHash: 'x' }), b = createAccount(db, { email: 'otherpeople@example.test', passwordHash: 'x' });
    upsertStudent(db, a.id, { id: 'kid', name: 'Мирон' });
    const key = 'my_people:v2:kid:plan:self';
    upsertAccountKv(db, a.id, key, { schemaVersion: 2, studentId: 'kid', revision: 3, id: 'new', fieldSize: 6 });
    upsertAccountKv(db, a.id, key, { schemaVersion: 2, studentId: 'kid', revision: 1, id: 'old', fieldSize: 2 });
    assert.equal(getAllAccountKv(db, a.id)[0].value.fieldSize, 6);
    upsertAccountKv(db, b.id, key, { schemaVersion: 2, studentId: 'kid', revision: 5, id: 'foreign' });
    assert.equal(getAllAccountKv(db, b.id).length, 0);
    upsertAccountKv(db, a.id, 'other-topic', { revision: 3 }); upsertAccountKv(db, a.id, 'other-topic', { revision: 1 });
    assert.equal(getAllAccountKv(db, a.id).find(r => r.key === 'other-topic').value.revision, 1);
  } finally { db.close(); }
});
test('old-style person writes preserve additional roles and variants; new journals round trip', () => {
  const db = initDb(':memory:');
  try {
    const a = createAccount(db, { email: 'roundtrip@example.test', passwordHash: 'x' });
    upsertStudent(db, a.id, { id: 'kid', name: 'Мирон' });
    const person = { id: 'sasha', name: 'Саша', relation: 'подруга', relations: [{ key: 'classmate_f', label: 'одноклассница' }], nameVariants: ['Сашенька'], photos: [], updatedAt: '2026-11-04T10:00:00Z' };
    upsertStudentMyPeople(db, a.id, { studentId: 'kid', people: [person], updatedAt: person.updatedAt });
    upsertStudentMyPeople(db, a.id, { studentId: 'kid', people: [{ id: 'sasha', relation: 'подруга', updatedAt: '2026-11-04T11:00:00Z' }], updatedAt: '2026-11-04T11:00:00Z' });
    const saved = JSON.parse(getStudents(db, a.id)[0].my_people)[0];
    assert.deepEqual(saved.relations, person.relations); assert.deepEqual(saved.nameVariants, person.nameVariants);
    const statistics = { myPeople: { schemaVersion: 2, trials: [{ trialId: 't1', kind: 'main', outcome: 'practice', acceptedRelationKeys: ['friend_f', 'classmate_f'], targetRelationKey: null }] } };
    appendSession(db, a.id, { id: 'session-v2', studentId: 'kid', topicId: 'my_people', topicVersion: '2', modeId: 'people_learning_v2', startedAt: '2026-11-04T11:00:00Z', completedAt: '2026-11-04T11:01:00Z', statistics, percentCorrect: null, paramsSnapshot: { goal: 'relation', activity: 'recall', context: 'self', revision: 3 } });
    const record = sessionToApi(getSessions(db, a.id)[0]);
    assert.deepEqual(record.statistics, statistics); assert.equal(record.percentCorrect, null); assert.equal(record.paramsSnapshot.revision, 3);
  } finally { db.close(); }
});
