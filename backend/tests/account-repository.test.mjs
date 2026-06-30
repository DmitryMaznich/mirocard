import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import {
  createAccount,
  findAccountByEmail,
  findAccountByEmailAny,
  findAccountById,
  updateAccount,
  deleteAccount,
  activateAccount,
  storeAuthToken,
  findAccountByToken,
  deleteAuthToken,
  createPasswordResetToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
  serializeAccount,
} from "../lib/account-repository.mjs";

function makeDb() { return initDb(":memory:"); }

test("createAccount and findAccountByEmail", () => {
  const db = makeDb();
  const acc = createAccount(db, {
    email: "test@example.com",
    passwordHash: "hash123",
    displayName: "Tester",
  });
  assert.ok(acc.id);
  assert.equal(acc.email, "test@example.com");
  assert.equal(acc.status, "pending"); // new accounts start as pending

  // findAccountByEmail only returns active — use findAccountByEmailAny for pending
  const found = findAccountByEmailAny(db, "test@example.com");
  assert.equal(found.id, acc.id);
  assert.equal(found.display_name, "Tester");
});

test("createAccount rejects duplicate email", () => {
  const db = makeDb();
  createAccount(db, { email: "dupe@example.com", passwordHash: "h" });
  assert.throws(
    () => createAccount(db, { email: "dupe@example.com", passwordHash: "h" }),
    /UNIQUE constraint failed/
  );
});

test("findAccountByEmail returns null for unknown email", () => {
  const db = makeDb();
  assert.equal(findAccountByEmail(db, "nope@example.com"), null);
});

test("updateAccount recomputes display_name from first/last name", () => {
  const db = makeDb();
  const acc = createAccount(db, { email: "upd@example.com", passwordHash: "h" });
  activateAccount(db, acc.id);
  updateAccount(db, acc.id, { firstName: "Анна", lastName: "Петрова" });
  const found = findAccountById(db, acc.id);
  assert.equal(found.first_name, "Анна");
  assert.equal(found.last_name, "Петрова");
  assert.equal(found.display_name, "Анна Петрова");
});

test("updateAccount updates role and preserves untouched fields", () => {
  const db = makeDb();
  const acc = createAccount(db, { email: "role@example.com", passwordHash: "h", firstName: "Олег" });
  activateAccount(db, acc.id);
  updateAccount(db, acc.id, { role: "specialist" });
  const found = findAccountById(db, acc.id);
  assert.equal(found.role, "specialist");
  assert.equal(found.first_name, "Олег"); // untouched field preserved
});

test("storeAuthToken and findAccountByToken", () => {
  const db = makeDb();
  const acc = createAccount(db, { email: "tok@example.com", passwordHash: "h" });
  activateAccount(db, acc.id);
  const expiresAt = new Date(Date.now() + 1000 * 60).toISOString();
  storeAuthToken(db, { tokenHash: "hash_abc", accountId: acc.id, expiresAt });

  const found = findAccountByToken(db, "hash_abc");
  assert.equal(found.id, acc.id);
});

test("findAccountByToken returns null for unknown or expired token", () => {
  const db = makeDb();
  assert.equal(findAccountByToken(db, "unknown"), null);
});

test("deleteAuthToken removes token", () => {
  const db = makeDb();
  const acc = createAccount(db, { email: "del@example.com", passwordHash: "h" });
  activateAccount(db, acc.id);
  const expiresAt = new Date(Date.now() + 1000 * 60).toISOString();
  storeAuthToken(db, { tokenHash: "del_tok", accountId: acc.id, expiresAt });
  deleteAuthToken(db, "del_tok");
  assert.equal(findAccountByToken(db, "del_tok"), null);
});

test("createPasswordResetToken and consumePasswordResetToken", () => {
  const db = makeDb();
  const acc = createAccount(db, { email: "reset@example.com", passwordHash: "old" });
  activateAccount(db, acc.id);
  createPasswordResetToken(db, { tokenHash: "reset_hash", accountId: acc.id });
  const accountId = consumePasswordResetToken(db, "reset_hash");
  assert.equal(accountId, acc.id);
  // Second use returns null (token is used)
  assert.equal(consumePasswordResetToken(db, "reset_hash"), null);
});

// ─── Students ─────────────────────────────────────────────────────────────────
import {
  upsertStudent,
  getStudents,
  softDeleteStudent,
  appendSession,
  getSessions,
  getAllSessions,
  upsertAccountTopic,
  getAccountTopics,
  upsertStudentTopicLink,
  getStudentTopicLinks,
  upsertConceptProgress,
  getConceptProgress,
} from "../lib/account-repository.mjs";

function makeAccount(db) {
  const acc = createAccount(db, { email: `u${Date.now()}${Math.random()}@x.com`, passwordHash: "h" });
  activateAccount(db, acc.id);
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(acc.id);
}

test("upsertStudent creates and getStudents returns it", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  upsertStudent(db, acc.id, {
    id: "s1", name: "Маша", comment: "заметка", primaryLanguage: "ru",
    rewardVideos: ["https://youtu.be/example1", "https://youtu.be/example2"],
  });
  const students = getStudents(db, acc.id);
  assert.equal(students.length, 1);
  assert.equal(students[0].name, "Маша");
  assert.equal(students[0].reward_videos, JSON.stringify(["https://youtu.be/example1", "https://youtu.be/example2"]));
});

test("softDeleteStudent marks deleted_at", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  upsertStudent(db, acc.id, { id: "s2", name: "Вася" });
  softDeleteStudent(db, "s2");
  const students = getStudents(db, acc.id);
  assert.equal(students.length, 0);
});

test("appendSession and getSessions", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  appendSession(db, acc.id, {
    id: "sess1", studentId: "s1", topicId: "clothes_basic",
    topicVersion: "2.0.0", mode: "yes_no",
    startedAt: "2026-04-28T10:00:00Z", completedAt: "2026-04-28T10:05:00Z",
    correctCount: 8, incorrectCount: 2, percentCorrect: 80,
    mistakes: [{ conceptId: "hat", cardId: "hat_1" }],
  });
  const sessions = getSessions(db, acc.id, { studentId: "s1" });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].percent_correct, 80);
});

test("getAllSessions returns all without pagination", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  for (let i = 0; i < 5; i++) {
    appendSession(db, acc.id, {
      id: `s${i}`, studentId: "st1", topicId: "t1", topicVersion: "1.0.0",
      mode: "intro", startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-01T00:01:00Z",
      correctCount: 0, incorrectCount: 0, percentCorrect: 0, mistakes: [],
    });
  }
  assert.equal(getAllSessions(db, acc.id).length, 5);
});

test("upsertAccountTopic and getAccountTopics", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  upsertAccountTopic(db, acc.id, {
    id: "ot1", topicId: "clothes_basic", topicVersion: "2.0.0", source: "download",
  });
  const topics = getAccountTopics(db, acc.id);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].topic_id, "clothes_basic");
});

test("upsertConceptProgress levels", () => {
  const db = makeDb();
  upsertConceptProgress(db, {
    studentId: "st1", topicId: "t1", conceptId: "hat", level: 2,
  });
  const progress = getConceptProgress(db, "st1", "t1");
  assert.equal(progress.length, 1);
  assert.equal(progress[0].level, 2);

  upsertConceptProgress(db, {
    studentId: "st1", topicId: "t1", conceptId: "hat", level: 3,
  });
  const updated = getConceptProgress(db, "st1", "t1");
  assert.equal(updated[0].level, 3);
});

// ─── Extended registration & email verification ───────────────────────────────

function makeFullAccount(db) {
  return createAccount(db, {
    email: `full${Date.now()}${Math.random()}@x.com`,
    passwordHash: "h",
    firstName: "Мария",
    lastName: "Иванова",
    role: "parent",
    referralSource: "friend",
    consentPersonalDataAt: "2026-06-30T10:00:00.000Z",
  });
}

test("createAccount stores new fields and status=pending", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  assert.equal(acc.status, "pending");
  assert.equal(acc.first_name, "Мария");
  assert.equal(acc.last_name, "Иванова");
  assert.equal(acc.role, "parent");
  assert.equal(acc.referral_source, "friend");
  assert.ok(acc.consent_personal_data_at);
  assert.equal(acc.display_name, "Мария Иванова");
});

test("findAccountByEmail does NOT return pending account", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  const found = findAccountByEmail(db, acc.email);
  assert.equal(found, null);
});

test("findAccountByEmailAny returns pending account", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  const found = findAccountByEmailAny(db, acc.email);
  assert.ok(found);
  assert.equal(found.status, "pending");
});

test("activateAccount sets status to active", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  assert.equal(acc.status, "pending");
  activateAccount(db, acc.id);
  const activated = findAccountByEmail(db, acc.email);
  assert.ok(activated);
  assert.equal(activated.status, "active");
});

test("createEmailVerificationToken and consumeEmailVerificationToken", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  createEmailVerificationToken(db, { tokenHash: "vhash1", accountId: acc.id });
  const accountId = consumeEmailVerificationToken(db, "vhash1");
  assert.equal(accountId, acc.id);
  // Consumed — second call returns null
  assert.equal(consumeEmailVerificationToken(db, "vhash1"), null);
});

test("consumeEmailVerificationToken returns null for expired token", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  db.prepare(
    "INSERT INTO email_verification_tokens (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).run("expired_hash", acc.id, "2000-01-01T00:00:00.000Z", new Date().toISOString());
  assert.equal(consumeEmailVerificationToken(db, "expired_hash"), null);
});

test("serializeAccount exposes camelCase fields and hides password_hash", () => {
  const db = makeDb();
  const acc = makeFullAccount(db);
  const serialized = serializeAccount(acc);
  assert.equal(serialized.id, acc.id);
  assert.equal(serialized.email, acc.email);
  assert.equal(serialized.firstName, "Мария");
  assert.equal(serialized.lastName, "Иванова");
  assert.equal(serialized.role, "parent");
  assert.ok(serialized.createdAt);
  assert.equal(serialized.password_hash, undefined);
  assert.equal(serialized.passwordHash, undefined);
});

test("serializeAccount returns null for null input", () => {
  assert.equal(serializeAccount(null), null);
});
