import { randomUUID } from "node:crypto";

export function createStudentPortal(db, { accountId, studentId, tokenHash, label }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO student_portals (id, account_id, student_id, token_hash, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, accountId, studentId, tokenHash, label ?? null, createdAt);
  return id;
}

export function findPortalByTokenHash(db, tokenHash) {
  return db.prepare(
    `SELECT * FROM student_portals WHERE token_hash = ? AND revoked_at IS NULL`
  ).get(tokenHash) ?? null;
}

export function listStudentPortals(db, { accountId, studentId }) {
  return db.prepare(
    `SELECT * FROM student_portals
     WHERE account_id = ? AND student_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`
  ).all(accountId, studentId);
}

export function revokeStudentPortal(db, { id, accountId }) {
  db.prepare(
    `UPDATE student_portals SET revoked_at = ?
     WHERE id = ? AND account_id = ?`
  ).run(new Date().toISOString(), id, accountId);
}

export function updatePortalLastUsed(db, tokenHash) {
  db.prepare(
    `UPDATE student_portals SET last_used_at = ? WHERE token_hash = ?`
  ).run(new Date().toISOString(), tokenHash);
}

export function setPortalActiveTask(db, { accountId, studentId, topicId, modeId }) {
  db.prepare(
    `UPDATE student_portals
     SET active_topic_id = ?, active_mode_id = ?
     WHERE account_id = ? AND student_id = ? AND revoked_at IS NULL`
  ).run(topicId ?? null, modeId ?? null, accountId, studentId);
}
