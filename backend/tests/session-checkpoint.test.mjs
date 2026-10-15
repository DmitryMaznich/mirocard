import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, appendSession } from "../lib/account-repository.mjs";
import { getSessionStatistics } from "../lib/session-statistics.mjs";

test("checkpoint sync is monotonic, account scoped, and cannot reopen a finished session", () => {
  const db = initDb(":memory:");
  try {
    const account = createAccount(db, { email: "checkpoint@example.test", passwordHash: "x" });
    const other = createAccount(db, { email: "checkpoint-other@example.test", passwordHash: "x" });
    const base = { id: "lesson", studentId: "kid", topicId: "addition_subtraction", topicVersion: "1", modeId: "operation_audio", startedAt: "2026-10-14T10:00:00Z", completedAt: "2026-10-14T10:01:00Z", recordUpdatedAt: "2026-10-14T10:01:00Z", recordState: "checkpoint", completionReason: "checkpoint", recordRevision: 1, correctCount: 1, incorrectCount: 0 };
    const later = { ...base, recordRevision: 2, correctCount: 2, recordUpdatedAt: "2026-10-14T10:02:00Z" };
    appendSession(db, account.id, base);
    appendSession(db, account.id, later);
    appendSession(db, account.id, base);
    appendSession(db, other.id, { ...later, recordRevision: 99, correctCount: 99 });
    appendSession(db, account.id, { ...later, modeId: "other", recordRevision: 99 });
    let report = getSessionStatistics(db, account.id, { studentId: "kid" });
    assert.equal(report.totals.sessions, 1);
    assert.equal(report.totals.correctActions, 2);
    assert.equal(report.totals.checkpointSessions, 1);
    assert.equal(getSessionStatistics(db, other.id, { studentId: "kid" }).totals.sessions, 0);
    appendSession(db, account.id, { ...later, recordState: "final", completionReason: "manual" });
    appendSession(db, account.id, { ...later, recordRevision: 100, correctCount: 100 });
    report = getSessionStatistics(db, account.id, { studentId: "kid" });
    assert.equal(report.totals.correctActions, 2);
    assert.equal(report.totals.manualSessions, 1);
    assert.equal(report.totals.checkpointSessions ?? 0, 0);
  } finally { db.close(); }
});
