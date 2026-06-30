import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount, upsertStudent, appendSession, upsertAccountTopic, upsertConceptProgress } from "../lib/account-repository.mjs";
import { buildBootstrap } from "../lib/snapshot-builder.mjs";

function makeDb() { return initDb(":memory:"); }

test("buildBootstrap returns expected shape", () => {
  const db = makeDb();
  const acc = createAccount(db, { email: "b@test.com", passwordHash: "hash" });
  activateAccount(db, acc.id);
  upsertStudent(db, acc.id, { id: "s1", name: "Маша", rewardVideos: ["https://youtu.be/example1"] });
  appendSession(db, acc.id, {
    id: "sess1", studentId: "s1", topicId: "clothes", topicVersion: "2.0.0",
    mode: "yes_no", startedAt: "2026-04-28T10:00:00Z", completedAt: "2026-04-28T10:05:00Z",
    correctCount: 8, incorrectCount: 2, percentCorrect: 80,
    mistakes: [{ conceptId: "hat", cardId: "hat_1" }],
  });
  upsertConceptProgress(db, { studentId: "s1", topicId: "clothes", conceptId: "hat", level: 2 });
  upsertAccountTopic(db, acc.id, { id: "ot1", topicId: "clothes", topicVersion: "2.0.0" });

  const snap = buildBootstrap(db, acc.id, 0);

  assert.ok(Array.isArray(snap.students));
  assert.equal(snap.students.length, 1);
  assert.equal(snap.students[0].id, "s1");
  assert.deepEqual(snap.students[0].rewardVideos, ["https://youtu.be/example1"]);

  assert.ok(Array.isArray(snap.ownedTopics));
  assert.equal(snap.ownedTopics.length, 1);

  assert.ok(Array.isArray(snap.conceptProgress));
  assert.equal(snap.conceptProgress.length, 1);
  assert.equal(snap.conceptProgress[0].level, 2);

  assert.ok(snap.settings);
  assert.ok(typeof snap.revision === "number");
});

test("buildBootstrap with empty account returns valid shape", () => {
  const db = makeDb();
  const acc = createAccount(db, { email: "c@test.com", passwordHash: "h" });
  activateAccount(db, acc.id);
  const snap = buildBootstrap(db, acc.id, 0);
  assert.ok(typeof snap.revision === "number");
  assert.ok(Array.isArray(snap.students));
  assert.equal(snap.students.length, 0);
});
