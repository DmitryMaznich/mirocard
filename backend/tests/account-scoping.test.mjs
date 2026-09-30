import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, getStudents, getSessions, getAccountTopics, getStudentTopicLinks, getConceptProgress } from "../lib/account-repository.mjs";
import { processSync } from "../lib/sync-processor.mjs";

// Sync ops name rows by client-sent ids. None of them may reach into another
// account's rows, even with a correct id.
function setup() {
  const db = initDb(":memory:");
  const victim = createAccount(db, { email: "victim@example.com", passwordHash: "x" });
  const attacker = createAccount(db, { email: "attacker@example.com", passwordHash: "x" });
  processSync(db, victim.id, [
    { type: "student.upsert", data: { id: "kid", name: "Маша", comment: "аллергия", healthDataConsent: true } },
    { type: "topic.acquire", data: { id: "own1", topicId: "clothes", topicVersion: "1.0.0", source: "purchase", licenseToken: "LT" } },
    { type: "student_topic_link.upsert", data: { id: "link1", studentId: "kid", topicId: "clothes", repsPerConcept: 3 } },
    { type: "concept_progress.upsert", data: { studentId: "kid", topicId: "clothes", conceptId: "hat", level: 4 } },
  ]);
  return { db, victim, attacker };
}

test("another account cannot rename, relabel or delete a student it doesn't own", () => {
  const { db, victim, attacker } = setup();
  processSync(db, attacker.id, [
    { type: "student.upsert", data: { id: "kid", name: "HACKED", comment: "", healthDataConsent: false } },
    { type: "student.delete", data: { id: "kid" } },
  ]);
  const [kid] = getStudents(db, victim.id);
  assert.equal(kid?.name, "Маша");
  assert.equal(kid.comment, "аллергия");
  assert.equal(kid.health_data_consent, 1);
  assert.deepEqual(getStudents(db, attacker.id), []);
});

test("another account cannot touch topic ownership, links or progress", () => {
  const { db, victim, attacker } = setup();
  processSync(db, attacker.id, [
    { type: "topic.acquire", data: { id: "own1", topicId: "clothes", topicVersion: "9.9.9", source: "free", licenseToken: null } },
    { type: "topic.delete", data: { id: "own1" } },
    { type: "student_topic_link.upsert", data: { id: "link1", studentId: "kid", topicId: "clothes", repsPerConcept: 99 } },
    { type: "concept_progress.upsert", data: { studentId: "kid", topicId: "clothes", conceptId: "hat", level: 0 } },
    { type: "session.append", data: { id: "sx", studentId: "kid", topicId: "clothes", mode: "m", completedAt: "2026-09-30T00:00:00Z" } },
  ]);
  const [owned] = getAccountTopics(db, victim.id);
  assert.equal(owned.license_token, "LT");
  assert.equal(owned.topic_version, "1.0.0");
  assert.equal(getStudentTopicLinks(db, victim.id)[0].reps_per_concept, 3);
  assert.equal(getConceptProgress(db, "kid", "clothes")[0].level, 4);
  assert.deepEqual(getSessions(db, attacker.id, { limit: 10 }), []);
});

test("the owner's own ops still work", () => {
  const { db, victim } = setup();
  processSync(db, victim.id, [
    { type: "student.upsert", data: { id: "kid", name: "Мария" } },
    { type: "concept_progress.upsert", data: { studentId: "kid", topicId: "clothes", conceptId: "hat", level: 5 } },
    { type: "topic.delete", data: { id: "own1" } },
    { type: "student.delete", data: { id: "kid" } },
  ]);
  assert.equal(getConceptProgress(db, "kid", "clothes")[0].level, 5);
  assert.deepEqual(getAccountTopics(db, victim.id), []);
  assert.deepEqual(getStudents(db, victim.id), []);
});
