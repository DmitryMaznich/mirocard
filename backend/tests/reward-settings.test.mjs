import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, upsertStudent, upsertStudentRewardSettings, getStudents, softDeleteStudent } from "../lib/account-repository.mjs";
import { processSync } from "../lib/sync-processor.mjs";
import { buildBootstrap } from "../lib/snapshot-builder.mjs";

test("reward settings sync independently, survive stale profile edits and can roll back", () => {
  const db = initDb(":memory:");
  try {
    const account = createAccount(db, { email: "rewards@test.test", passwordHash: "test" });
    upsertStudent(db, account.id, { id: "s", name: "Миша" });
    assert.deepEqual(JSON.parse(getStudents(db, account.id)[0].reward_settings), {});
    const settings = { algorithm: "flexible", duration: "end", animation: "soft", sound: true, strictStars: false, lossMode: "all" };
    processSync(db, account.id, [{ type: "student.reward_settings.upsert", data: { studentId: "s", settings, updatedAt: "2026-10-23T12:00:00.000Z" } }]);
    upsertStudent(db, account.id, { id: "s", name: "Новое имя", rewardSettings: { algorithm: "legacy" } });
    upsertStudentRewardSettings(db, account.id, { studentId: "s", settings: { algorithm: "legacy" }, updatedAt: "2026-10-22T12:00:00.000Z" });
    let student = buildBootstrap(db, account.id).students[0];
    assert.deepEqual(student.rewardSettings, { ...settings, duration: "180" });
    assert.equal(student.rewardSettingsUpdatedAt, "2026-10-23T12:00:00.000Z");
    upsertStudentRewardSettings(db, account.id, { studentId: "s", settings: { ...settings, algorithm: "legacy" }, updatedAt: "2026-10-23T13:00:00.000Z" });
    student = buildBootstrap(db, account.id).students[0];
    assert.equal(student.rewardSettings.algorithm, "legacy");
    assert.equal(student.rewardSettings.duration, "180");
    // A previous application version knows only the original four fields.
    upsertStudentRewardSettings(db, account.id, { studentId: "s", settings: { algorithm: "flexible", duration: "60", animation: "normal", sound: false }, updatedAt: "2026-10-24T13:00:00.000Z" });
    student = buildBootstrap(db, account.id).students[0];
    assert.equal(student.rewardSettings.strictStars, false);
    assert.equal(student.rewardSettings.lossMode, "all");
  } finally { db.close(); }
});

test("reward settings respect ownership and deletion, and new profiles retain initial settings", () => {
  const db = initDb(":memory:");
  try {
    const owner = createAccount(db, { email: "owner@test.test", passwordHash: "test" });
    const other = createAccount(db, { email: "other@test.test", passwordHash: "test" });
    upsertStudent(db, owner.id, { id: "s", name: "Миша", rewardSettings: { algorithm: "flexible", duration: "60" } });
    upsertStudentRewardSettings(db, other.id, { studentId: "s", settings: {}, updatedAt: "2099-01-01T00:00:00Z" });
    assert.equal(JSON.parse(getStudents(db, owner.id)[0].reward_settings).duration, "60");
    softDeleteStudent(db, owner.id, "s");
    upsertStudentRewardSettings(db, owner.id, { studentId: "s", settings: {}, updatedAt: "2099-01-01T00:00:00Z" });
    assert.equal(JSON.parse(db.prepare("SELECT reward_settings FROM students WHERE id='s'").get().reward_settings).duration, "60");
  } finally { db.close(); }
});
