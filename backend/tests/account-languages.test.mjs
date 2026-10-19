import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initDb } from "../lib/db.mjs";
import { patchAccountLanguages, readAccountLanguages } from "../lib/account-languages.mjs";
import { createAccount, updateAccountSettings, upsertStudent, getStudents } from "../lib/account-repository.mjs";
import { buildBootstrap } from "../lib/snapshot-builder.mjs";

function fixture() {
  const db = initDb(":memory:");
  const account = createAccount(db, { email: "language@example.test", passwordHash: "test" });
  const other = createAccount(db, { email: "other-language@example.test", passwordHash: "test" });
  const patch = (operationId, expectedRevision, values, initializeOnly = false, id = account.id) =>
    patchAccountLanguages(db, id, { operationId, expectedRevision, patch: values, initializeOnly });
  return { db, account, other, patch };
}

test("language CAS and retries preserve unrelated settings and other accounts", () => {
  const { db, account, other, patch } = fixture();
  updateAccountSettings(db, account.id, { adult_pin_hash: "keep-pin", push_reminders: 1 });
  const first = patch("first", 0, { uiLanguage: "sl" });
  assert.equal(first.languageRevision, 1);
  assert.equal(patch("first", 0, { uiLanguage: "sl" }).languageRevision, 1);
  assert.equal(patch("second", 0, { cardLanguage: "en" }).conflict, true);
  assert.equal(patch("second", 1, { cardLanguage: "en" }).languageRevision, 2);
  // Replaying an older acknowledged operation must not overwrite a later one.
  assert.equal(patch("first", 0, { uiLanguage: "sl" }).languageRevision, 2);
  assert.equal(readAccountLanguages(db, other.id).uiLanguage, "ru");
  const settings = db.prepare("SELECT * FROM account_settings WHERE account_id=?").get(account.id);
  assert.equal(settings.adult_pin_hash, "keep-pin");
  assert.equal(settings.push_reminders, 1);
  assert.equal(settings.card_language, "en");
  assert.equal(buildBootstrap(db, account.id).settings.languageRevision, 2);
  db.close();
});

test("guest initialization never changes a previously explicit account", () => {
  const { db, patch } = fixture();
  patch("manual", 0, { uiLanguage: "ru" });
  const result = patch("guest", 0, { uiLanguage: "sl" }, true);
  assert.equal(result.conflict, false);
  assert.equal(result.uiLanguage, "ru");
  assert.equal(result.languageRevision, 1);
  db.close();
});

test("API rejects unsupported codes, fields and revisions before writing", () => {
  const { db, account, patch } = fixture();
  for (const values of [{ uiLanguage: "en" }, { uiLanguage: "sl-SI" }, { cardLanguage: "xx" }, { adultPinHash: "overwrite" }, {}]) {
    assert.throws(() => patch("bad", 0, values), error => error.status === 400);
  }
  assert.throws(() => patch("bad", -1, { uiLanguage: "sl" }), error => error.status === 400);
  assert.equal(readAccountLanguages(db, account.id).languageRevision, 0);
  db.close();
});

test("student lesson preference round trips separately, preserves missing legacy fields and allows inheritance", () => {
  const { db, account } = fixture();
  upsertStudent(db, account.id, { id: "S", name: "Student", primaryLanguage: "ru", preferredLessonLanguage: "sl" });
  upsertStudent(db, account.id, { id: "T", name: "Other", primaryLanguage: "sl", preferredLessonLanguage: "en" });
  // An older client does not know the new field.
  upsertStudent(db, account.id, { id: "S", name: "Edited by old client", primaryLanguage: "ru" });
  let students = buildBootstrap(db, account.id).students;
  assert.equal(students.find(s => s.id === "S").preferredLessonLanguage, "sl");
  assert.equal(students.find(s => s.id === "S").primaryLanguage, "ru");
  assert.equal(students.find(s => s.id === "T").preferredLessonLanguage, "en");
  upsertStudent(db, account.id, { id: "S", name: "Inherited", preferredLessonLanguage: null });
  assert.equal(getStudents(db, account.id).find(s => s.id === "S").preferred_lesson_language, null);
  assert.throws(() => upsertStudent(db, account.id, { id: "X", name: "Invalid", preferredLessonLanguage: "xx" }), error => error.status === 400);
  db.close();
});

test("additive migration preserves legacy preferences and is idempotent across restarts", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "mirocard-language-migration-"));
  const file = path.join(directory, "db.sqlite");
  try {
    let db = initDb(file);
    const account = createAccount(db, { email: "migration@example.test", passwordHash: "test" });
    db.prepare("UPDATE account_settings SET ui_language='sl', adult_pin_hash='preserve' WHERE account_id=?").run(account.id);
    db.exec("DROP TABLE account_language_operations");
    db.exec("ALTER TABLE account_settings DROP COLUMN language_revision");
    db.exec("ALTER TABLE students DROP COLUMN preferred_lesson_language");
    db.close();
    db = initDb(file);
    assert.equal(readAccountLanguages(db, account.id).languageRevision, 1);
    patchAccountLanguages(db, account.id, { operationId: "migrated", expectedRevision: 1, patch: { cardLanguage: "sl" } });
    db.close();
    db = initDb(file);
    assert.equal(readAccountLanguages(db, account.id).languageRevision, 2);
    assert.equal(db.prepare("SELECT adult_pin_hash FROM account_settings WHERE account_id=?").get(account.id).adult_pin_hash, "preserve");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM account_language_operations").get().count, 1);
    db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
