import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, appendSession, getSessions } from "../lib/account-repository.mjs";
import { sessionToApi, getSessionStatistics } from "../lib/session-statistics.mjs";
import { processSync } from "../lib/sync-processor.mjs";

test("sync preserves conditions, quality assessments and completion reason; summaries include more than 200 sessions", () => {
  const db = initDb(":memory:");
  try {
    const account = createAccount(db, { email: "stats@example.test", passwordHash: "x" });
    const other = createAccount(db, { email: "other@example.test", passwordHash: "x" });
    const session = { studentId: "kid", topicId: "topic", topicVersion: "1", modeId: "find_n", startedAt: "2026-10-15T10:00:00Z", completedAt: "2026-10-15T10:01:00Z", activeDurationMs: 45000, elapsedDurationMs: 60000, paramsSnapshot: { optionCount: 4 }, assessments: [{ quality: "prompted", conceptId: "cat" }], completionReason: "manual", statistics: { schemaVersion: 1, firstTotal: 10, firstCorrect: 8, quality: { prompted: 1 }, conditions: { conceptIds: ["cat"], params: { optionCount: 4 } } } };
    processSync(db, account.id, [{ type: "session.append", data: { ...session, id: "s0" } }]);
    for (let i = 1; i < 205; i++) appendSession(db, account.id, { ...session, id: `s${i}` });
    appendSession(db, account.id, { ...session, id: "s0" });
    appendSession(db, other.id, { ...session, id: "other-account" });
    appendSession(db, account.id, { ...session, studentId: "other-kid", id: "other-kid" });
    const restored = sessionToApi(getSessions(db, account.id, { studentId: "kid" })[0]);
    assert.deepEqual(restored.paramsSnapshot, session.paramsSnapshot);
    assert.deepEqual(restored.assessments, session.assessments);
    assert.deepEqual(restored.statistics, session.statistics);
    assert.deepEqual(restored.conceptIds, ["cat"]);
    assert.equal(restored.modeId, "find_n");
    assert.equal(restored.completionReason, "manual");
    const report = getSessionStatistics(db, account.id, { studentId: "kid" });
    assert.equal(report.totals.sessions, 205);
    assert.equal(report.totals.firstTotal, 2050);
    assert.equal(report.totals.firstCorrect, 1640);
    assert.equal(report.recent.length, 20);
    assert.equal(report.recent[0].startedAt, session.startedAt);
    assert.equal(report.recent[0].activeDurationMs, 45000);
    assert.equal(report.recent[0].elapsedDurationMs, 60000);
    assert.equal(report.groups[0].trend.length, 12);
    assert.equal(getSessionStatistics(db, other.id, { studentId: "kid" }).totals.sessions, 1);
    assert.equal(getSessionStatistics(db, other.id, { studentId: "other-kid" }).totals.sessions, 0);
  } finally { db.close(); }
});

test("legacy records remain separate with unknown conditions and no invented first-response score", () => {
  const db = initDb(":memory:");
  try {
    const account = createAccount(db, { email: "legacy-stats@example.test", passwordHash: "x" });
    appendSession(db, account.id, { id: "old", studentId: "kid", topicId: "topic", topicVersion: "1", mode: "m", startedAt: "2026-10-15", completedAt: "2026-10-15", correctCount: 9, incorrectCount: 1 });
    const report = getSessionStatistics(db, account.id, { studentId: "kid" });
    assert.equal(report.groups[0].conditions, null);
    assert.equal(report.totals.firstTotal, 0);
    assert.equal(report.totals.correctActions, 9);
    assert.equal(report.totals.completedSeries, 0);
  } finally { db.close(); }
});
