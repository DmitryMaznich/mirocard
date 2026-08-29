import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, getStudents, getAllSessions, getAccountTopics, getConceptProgress } from "../lib/account-repository.mjs";
import { processSync } from "../lib/sync-processor.mjs";

function makeDb() { return initDb(":memory:"); }
function makeAcc(db) {
  return createAccount(db, { email: `u${Date.now()}${Math.random()}@x.com`, passwordHash: "h" });
}

test("student.upsert creates student", () => {
  const db = makeDb();
  const acc = makeAcc(db);
  processSync(db, acc.id, [
    { type: "student.upsert", data: { id: "s1", name: "Маша", comment: "" } },
  ]);
  assert.equal(getStudents(db, acc.id).length, 1);
});

test("student.videos.upsert sets reward_videos, and a later unrelated student.upsert does not wipe it", () => {
  const db = makeDb();
  const acc = makeAcc(db);
  processSync(db, acc.id, [{ type: "student.upsert", data: { id: "s1", name: "Миня" } }]);
  processSync(db, acc.id, [{
    type: "student.videos.upsert",
    data: { studentId: "s1", rewardVideos: ["https://youtu.be/a", "https://youtu.be/b"], updatedAt: "2026-08-01T00:00:00.000Z" },
  }]);
  assert.deepEqual(JSON.parse(getStudents(db, acc.id)[0].reward_videos), ["https://youtu.be/a", "https://youtu.be/b"]);

  // A stale device pushes an unrelated edit (e.g. comment) with no knowledge of the videos.
  processSync(db, acc.id, [{
    type: "student.upsert",
    data: { id: "s1", name: "Миня", comment: "стало интереснее", rewardVideos: [] },
  }]);
  const after = getStudents(db, acc.id)[0];
  assert.equal(after.comment, "стало интереснее");
  assert.deepEqual(JSON.parse(after.reward_videos), ["https://youtu.be/a", "https://youtu.be/b"]);
});

test("student.adults.upsert sets close_adults independently of student.upsert", () => {
  const db = makeDb();
  const acc = makeAcc(db);
  processSync(db, acc.id, [{ type: "student.upsert", data: { id: "s1", name: "Миня" } }]);
  processSync(db, acc.id, [{
    type: "student.adults.upsert",
    data: { studentId: "s1", closeAdults: [{ id: "a1", name: "Мама", photo: null }], updatedAt: "2026-08-01T00:00:00.000Z" },
  }]);
  processSync(db, acc.id, [{ type: "student.upsert", data: { id: "s1", name: "Миня", closeAdults: [] } }]);
  const after = getStudents(db, acc.id)[0];
  assert.deepEqual(JSON.parse(after.close_adults), [{ id: "a1", name: "Мама", photo: null }]);
});

test("student.delete soft-deletes student", () => {
  const db = makeDb();
  const acc = makeAcc(db);
  processSync(db, acc.id, [{ type: "student.upsert", data: { id: "s1", name: "Маша" } }]);
  processSync(db, acc.id, [{ type: "student.delete", data: { id: "s1" } }]);
  assert.equal(getStudents(db, acc.id).length, 0);
});

test("session.append creates session", () => {
  const db = makeDb();
  const acc = makeAcc(db);
  processSync(db, acc.id, [{
    type: "session.append",
    data: {
      id: "sess1", studentId: "s1", topicId: "t1", topicVersion: "1.0.0",
      mode: "yes_no", startedAt: "2026-04-28T10:00:00Z", completedAt: "2026-04-28T10:05:00Z",
      correctCount: 5, incorrectCount: 1, percentCorrect: 83, mistakes: [],
    },
  }]);
  assert.equal(getAllSessions(db, acc.id).length, 1);
});

test("topic.acquire adds to account_topics", () => {
  const db = makeDb();
  const acc = makeAcc(db);
  processSync(db, acc.id, [{
    type: "topic.acquire",
    data: { id: "ot1", topicId: "clothes", topicVersion: "2.0.0", source: "download" },
  }]);
  assert.equal(getAccountTopics(db, acc.id).length, 1);
});

test("concept_progress.upsert writes progress", () => {
  const db = makeDb();
  const acc = makeAcc(db);
  processSync(db, acc.id, [{
    type: "concept_progress.upsert",
    data: { studentId: "s1", topicId: "t1", conceptId: "hat", level: 2 },
  }]);
  assert.equal(getConceptProgress(db, "s1", "t1")[0].level, 2);
});

test("unknown op type is ignored without error", () => {
  const db = makeDb();
  const acc = makeAcc(db);
  assert.doesNotThrow(() =>
    processSync(db, acc.id, [{ type: "unknown.op", data: {} }])
  );
});
