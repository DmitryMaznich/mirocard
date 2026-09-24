// Sync operations carry client-generated ids. None of them may touch a row
// that belongs to a different account, even if the id is known/guessed.
import { test } from "node:test";
import assert from "node:assert/strict";

const { initDb } = await import("../lib/db.mjs");
const {
  createAccount, activateAccount, upsertStudent, getStudents, upsertAccountTopic, getAccountTopics,
  upsertStudentTopicLink, getStudentTopicLinks, getConceptProgress, upsertConceptProgress,
} = await import("../lib/account-repository.mjs");
const { processSync } = await import("../lib/sync-processor.mjs");

let n = 0;
function account(db) {
  n += 1;
  const acc = createAccount(db, { email: `xacc${n}@x.test`, passwordHash: "h" });
  activateAccount(db, acc.id);
  return acc;
}

function setup() {
  const db = initDb(":memory:");
  const victim = account(db);
  const attacker = account(db);
  upsertStudent(db, victim.id, { id: "kid-1", name: "Настоящее имя", comment: "заметка" });
  upsertAccountTopic(db, victim.id, { id: "vt-1", topicId: "clothes", topicVersion: "1.0.0" });
  upsertStudentTopicLink(db, victim.id, { id: "link-1", studentId: "kid-1", topicId: "clothes", repsPerConcept: 3 });
  upsertConceptProgress(db, victim.id, { studentId: "kid-1", topicId: "clothes", conceptId: "hat", level: 2 });
  return { db, victim, attacker };
}

test("student.upsert with another account's student id does not overwrite it", () => {
  const { db, victim, attacker } = setup();
  processSync(db, attacker.id, [{ type: "student.upsert", data: { id: "kid-1", name: "hacked", comment: "x" } }]);
  const kid = getStudents(db, victim.id).find((s) => s.id === "kid-1");
  assert.equal(kid.name, "Настоящее имя");
  assert.equal(kid.comment, "заметка");
  assert.equal(getStudents(db, attacker.id).length, 0, "and the attacker doesn't get it either");
});

test("student.delete cannot delete another account's student", () => {
  const { db, victim, attacker } = setup();
  processSync(db, attacker.id, [{ type: "student.delete", data: { id: "kid-1" } }]);
  assert.equal(getStudents(db, victim.id).length, 1);
});

test("topic.delete cannot remove another account's acquired topic", () => {
  const { db, victim, attacker } = setup();
  processSync(db, attacker.id, [{ type: "topic.delete", data: { id: "vt-1" } }]);
  assert.equal(getAccountTopics(db, victim.id).length, 1);
});

test("student_topic_link.upsert cannot rewrite another account's link", () => {
  const { db, victim, attacker } = setup();
  processSync(db, attacker.id, [{ type: "student_topic_link.upsert", data: { id: "link-1", studentId: "kid-1", topicId: "clothes", repsPerConcept: 99 } }]);
  assert.equal(getStudentTopicLinks(db, victim.id)[0].reps_per_concept, 3);
});

test("concept_progress.upsert cannot write progress for another account's student", () => {
  const { db, attacker } = setup();
  processSync(db, attacker.id, [{ type: "concept_progress.upsert", data: { studentId: "kid-1", topicId: "clothes", conceptId: "hat", level: 5 } }]);
  assert.equal(getConceptProgress(db, "kid-1", "clothes")[0].level, 2);
});

test("the owner's own writes still work", () => {
  const { db, victim } = setup();
  processSync(db, victim.id, [
    { type: "student.upsert", data: { id: "kid-1", name: "Новое имя" } },
    { type: "concept_progress.upsert", data: { studentId: "kid-1", topicId: "clothes", conceptId: "hat", level: 4 } },
    { type: "topic.delete", data: { id: "vt-1" } },
  ]);
  assert.equal(getStudents(db, victim.id)[0].name, "Новое имя");
  assert.equal(getConceptProgress(db, "kid-1", "clothes")[0].level, 4);
  assert.equal(getAccountTopics(db, victim.id).length, 0);
});
