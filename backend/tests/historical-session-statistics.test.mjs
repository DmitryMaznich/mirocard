import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, upsertStudent, appendSession } from "../lib/account-repository.mjs";
import { getSessionStatistics, restoreSessionHistory, sessionToApi } from "../lib/session-statistics.mjs";
import { recoverHistoricalSession } from "../../shared/historical-session-statistics.mjs";

const old = extra => ({ id: "old", studentId: "kid", topicId: "topic", topicVersion: "1", mode: "find_n", startedAt: "2026-10-01T10:00:00Z", completedAt: "2026-10-01T10:01:00Z", correctCount: 1, incorrectCount: 1, cardEvents: [{ conceptId: "cat", attemptCount: 2, taps: [{ isCorrect: false }, { isCorrect: true }] }], ...extra });
function setup() {
  const db = initDb(":memory:");
  const account = createAccount(db, { email: "history@example.test", passwordHash: "x" });
  const other = createAccount(db, { email: "history-other@example.test", passwordHash: "x" });
  upsertStudent(db, account.id, { id: "kid", name: "Test" });
  upsertStudent(db, other.id, { id: "other-kid", name: "Test" });
  return { db, account, other };
}

test("old server tap records are reconstructed on read, without rewriting original evidence", () => {
  const { db, account } = setup();
  try {
    appendSession(db, account.id, old());
    const original = db.prepare("SELECT * FROM sessions WHERE id = 'old'").get();
    const report = getSessionStatistics(db, account.id, { studentId: "kid" });
    assert.equal(report.totals.recoveredResponseSessions, 1);
    assert.equal(report.totals.firstTotal, 1);
    assert.equal(report.totals.firstCorrect, 0);
    assert.equal(report.groups[0].conditions, null);
    assert.equal(sessionToApi(original).statistics.corrected, 1);
    assert.deepEqual(db.prepare("SELECT * FROM sessions WHERE id = 'old'").get(), original);
    assert.equal(JSON.stringify(report).includes("taps"), false);
  } finally { db.close(); }
});

test("a device snapshot enriches an existing old session durably and repeated recovery never duplicates sessions", () => {
  const { db, account } = setup();
  try {
    appendSession(db, account.id, old());
    const evidence = recoverHistoricalSession(old({ paramsSnapshot: { optionCount: 2 }, conceptIds: ["cat"] }));
    delete evidence.cardEvents; // restoration uploads no tap log
    for (let repeat = 0; repeat < 2; repeat++) assert.equal(restoreSessionHistory(db, account.id, [evidence]).restored, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
    const row = db.prepare("SELECT * FROM sessions WHERE id = 'old'").get();
    assert.deepEqual(JSON.parse(row.params_snapshot), { optionCount: 2 });
    const report = getSessionStatistics(db, account.id, { studentId: "kid" });
    assert.equal(report.totals.savedSettingsSessions, 1);
    assert.equal(report.totals.firstTotal, 1);
    assert.equal(report.groups[0].conditions.knownSettingsOnly, true);
    assert.equal(row.correct_count, 1);
    assert.equal(row.incorrect_count, 1);
    assert.equal(JSON.parse(row.card_events)[0].taps.length, 2);
  } finally { db.close(); }
});

test("restoration rejects foreign accounts, identity conflicts, malformed records and erased students", () => {
  const { db, account, other } = setup();
  try {
    appendSession(db, account.id, old());
    const evidence = recoverHistoricalSession(old({ paramsSnapshot: { optionCount: 2 } }));
    assert.equal(restoreSessionHistory(db, other.id, [evidence]).restored, 0);
    assert.equal(restoreSessionHistory(db, other.id, [{ ...evidence, studentId: "other-kid" }]).restored, 0);
    assert.equal(restoreSessionHistory(db, account.id, [{ ...evidence, startedAt: "2026-10-02T10:00:00Z" }, { id: [] }, null]).restored, 0);
    assert.equal(db.prepare("SELECT params_snapshot FROM sessions WHERE id = 'old'").get().params_snapshot, null);
    db.prepare("UPDATE students SET deleted_at = '2026-10-15' WHERE id = 'kid'").run();
    assert.equal(restoreSessionHistory(db, account.id, [evidence]).restored, 0);
  } finally { db.close(); }
});

test("restoration preserves native statistics and recovers a locally-only historical session", () => {
  const { db, account } = setup();
  try {
    const native = { schemaVersion: 1, firstTotal: 8, firstCorrect: 7, conditions: { params: { optionCount: 4 } } };
    appendSession(db, account.id, old({ statistics: native }));
    restoreSessionHistory(db, account.id, [recoverHistoricalSession(old({ paramsSnapshot: { optionCount: 2 } }))]);
    assert.deepEqual(JSON.parse(db.prepare("SELECT statistics_json FROM sessions WHERE id = 'old'").get().statistics_json), native);
    assert.equal(db.prepare("SELECT params_snapshot FROM sessions WHERE id = 'old'").get().params_snapshot, null);
    const local = recoverHistoricalSession(old({ id: "only-on-device", paramsSnapshot: { optionCount: 2 } }));
    delete local.cardEvents;
    restoreSessionHistory(db, account.id, [local]);
    const report = getSessionStatistics(db, account.id, { studentId: "kid" });
    assert.equal(report.totals.sessions, 2);
    assert.equal(report.totals.firstTotal, 9);
    assert.equal(report.totals.firstCorrect, 7);
  } finally { db.close(); }
});
