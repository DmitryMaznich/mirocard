import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, upsertStudent, upsertStudentLessonFlow, upsertStudentTopicLink, initializeTopicLanguage, softDeleteStudent } from "../lib/account-repository.mjs";
import { buildBootstrap } from "../lib/snapshot-builder.mjs";
import { processSync } from "../lib/sync-processor.mjs";

test("pacing sync is per student, independent of profile edits and protected from stale initialization", () => {
  const db = initDb(":memory:");
  try {
    const account = createAccount(db, { email: "flow@test.test", passwordHash: "test" });
    upsertStudent(db, account.id, { id: "one", name: "One", primaryLanguage: "en", preferredLessonLanguage: "sl" });
    upsertStudent(db, account.id, { id: "two", name: "Two" });
    processSync(db, account.id, [{ type: "student.lesson_flow.upsert", data: { studentId: "one", settings: { advance: "auto", delaySeconds: 6 }, updatedAt: "2026-11-03T12:00:00Z" } }]);
    upsertStudent(db, account.id, { id: "one", name: "Renamed", lessonFlow: { advance: "tap" } });
    upsertStudentLessonFlow(db, account.id, { studentId: "one", settings: { advance: "tap" }, updatedAt: "2099-01-01T00:00:00Z", initialize: true });
    upsertStudentLessonFlow(db, account.id, { studentId: "one", settings: { advance: "tap" }, updatedAt: "2026-11-01T00:00:00Z" });
    const students = buildBootstrap(db, account.id).students;
    assert.deepEqual(students.find(s => s.id === "one").lessonFlow, { advance: "auto", delaySeconds: 6 });
    assert.equal(students.find(s => s.id === "one").primaryLanguage, "en");
    assert.equal(students.find(s => s.id === "one").preferredLessonLanguage, "sl");
    assert.deepEqual(students.find(s => s.id === "two").lessonFlow, {});
  } finally { db.close(); }
});
test("pacing rejects writes from another account and to a deleted student", () => {
  const db = initDb(":memory:");
  try {
    const owner = createAccount(db, { email: "owner-flow@test.test", passwordHash: "test" });
    const other = createAccount(db, { email: "other-flow@test.test", passwordHash: "test" });
    upsertStudent(db, owner.id, { id: "one", name: "One" });
    const data = { studentId: "one", settings: { advance: "auto", delaySeconds: 7 }, updatedAt: "2026-11-03T12:00:00Z" };
    upsertStudentLessonFlow(db, other.id, data);
    assert.deepEqual(buildBootstrap(db, owner.id).students[0].lessonFlow, {});
    softDeleteStudent(db, owner.id, "one");
    upsertStudentLessonFlow(db, owner.id, data);
    assert.equal(db.prepare("SELECT lesson_flow FROM students WHERE id='one'").get().lesson_flow, '{}');
  } finally { db.close(); }
});
test("material initialization changes only the language and never replaces an explicit remote choice", () => {
  const db = initDb(":memory:");
  try {
    const account = createAccount(db, { email: "material@test.test", passwordHash: "test" });
    upsertStudent(db, account.id, { id: "s", name: "One" });
    upsertStudentTopicLink(db, account.id, { id: "link", studentId: "s", topicId: "topic", params: { level: 3 }, videoRewardEnabled: false, answersPerStar: 3 });
    initializeTopicLanguage(db, account.id, { studentId: "s", topicId: "topic", language: "sl" });
    initializeTopicLanguage(db, account.id, { studentId: "s", topicId: "topic", language: "ru" });
    const row = db.prepare("SELECT * FROM student_topic_links WHERE id='link'").get();
    assert.deepEqual(JSON.parse(row.params), { level: 3, topicContentLanguage: "sl" });
    assert.equal(row.video_reward_enabled, 0);
    assert.equal(row.answers_per_star, 3);
  } finally { db.close(); }
});
