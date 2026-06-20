import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { initDb } from "../lib/db.mjs";
import {
  createStudentPortal,
  findPortalByTokenHash,
  listStudentPortals,
  revokeStudentPortal,
  updatePortalLastUsed,
  setPortalActiveTask,
} from "../lib/student-portal.mjs";

function makeDb() { return initDb(":memory:"); }
function hashToken(raw) { return createHash("sha256").update(raw).digest("hex"); }

function seedAccount(db) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO accounts (id, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, `u${id.slice(0, 6)}@x.com`, "hash", now, now);
  return id;
}

function seedStudent(db, accountId) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO students (id, account_id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, accountId, "Вася", now, now);
  return id;
}

// ── create + find ─────────────────────────────────────────────────────────────

test("createStudentPortal + findPortalByTokenHash: найден по токену", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  createStudentPortal(db, { accountId, studentId, tokenHash, label: "iPad Васи" });
  const portal = findPortalByTokenHash(db, tokenHash);
  assert.ok(portal, "portal должен найтись");
  assert.equal(portal.student_id, studentId);
  assert.equal(portal.label, "iPad Васи");
  assert.equal(portal.revoked_at, null);
  assert.equal(portal.active_topic_id, null);
});

test("findPortalByTokenHash: null для неизвестного токена", () => {
  const db = makeDb();
  assert.equal(findPortalByTokenHash(db, "nonexistent"), null);
});

// ── revoke ────────────────────────────────────────────────────────────────────

test("revokeStudentPortal: findPortalByTokenHash возвращает null после отзыва", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  const portalId = createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  revokeStudentPortal(db, { id: portalId, accountId });
  assert.equal(findPortalByTokenHash(db, tokenHash), null);
});

test("revokeStudentPortal: чужой account_id не отзывает", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const otherId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  const portalId = createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  revokeStudentPortal(db, { id: portalId, accountId: otherId });
  assert.ok(findPortalByTokenHash(db, tokenHash), "свой portal должен остаться активным");
});

// ── list ──────────────────────────────────────────────────────────────────────

test("listStudentPortals: только активные порталы ученика", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const h1 = hashToken(randomUUID());
  const h2 = hashToken(randomUUID());
  const id1 = createStudentPortal(db, { accountId, studentId, tokenHash: h1, label: "A" });
  createStudentPortal(db, { accountId, studentId, tokenHash: h2, label: "B" });
  revokeStudentPortal(db, { id: id1, accountId });
  const list = listStudentPortals(db, { accountId, studentId });
  assert.equal(list.length, 1);
  assert.equal(list[0].label, "B");
});

// ── last_used_at ──────────────────────────────────────────────────────────────

test("updatePortalLastUsed: устанавливает last_used_at", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  assert.equal(findPortalByTokenHash(db, tokenHash).last_used_at, null);
  updatePortalLastUsed(db, tokenHash);
  assert.ok(findPortalByTokenHash(db, tokenHash).last_used_at, "last_used_at должен быть установлен");
});

// ── active task ───────────────────────────────────────────────────────────────

test("setPortalActiveTask: обновляет все активные порталы ученика", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  setPortalActiveTask(db, { accountId, studentId, topicId: "shopping_v1", modeId: "shop" });
  const portal = findPortalByTokenHash(db, tokenHash);
  assert.equal(portal.active_topic_id, "shopping_v1");
  assert.equal(portal.active_mode_id, "shop");
});

test("setPortalActiveTask: снятие задания (null)", () => {
  const db = makeDb();
  const accountId = seedAccount(db);
  const studentId = seedStudent(db, accountId);
  const tokenHash = hashToken(randomUUID());
  createStudentPortal(db, { accountId, studentId, tokenHash, label: null });
  setPortalActiveTask(db, { accountId, studentId, topicId: "shopping_v1", modeId: "shop" });
  setPortalActiveTask(db, { accountId, studentId, topicId: null, modeId: null });
  const portal = findPortalByTokenHash(db, tokenHash);
  assert.equal(portal.active_topic_id, null);
  assert.equal(portal.active_mode_id, null);
});
