import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { recoverHistoricalSession } from "../../shared/historical-session-statistics.mjs";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-statistics-"));
process.env.MIROCARD_DATA_DIR = dataDir;
process.env.ERROR_REPORTING_WEBHOOK_URL = "";
process.env.ANALYTICS_WEBHOOK_URL = "";
const { router } = await import("../server.mjs");
const { getDb } = await import("../lib/db.mjs");
const { createAccount, activateAccount, storeAuthToken, appendSession, upsertStudent } = await import("../lib/account-repository.mjs");
const db = getDb();
const account = createAccount(db, { email: "stats-http@example.test", passwordHash: "x" });
activateAccount(db, account.id);
const token = "statistics-http-token";
storeAuthToken(db, { accountId: account.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: "2099-01-01T00:00:00Z" });
appendSession(db, account.id, { id: "lesson", studentId: "kid", topicId: "topic", topicVersion: "1", mode: "m", startedAt: "2026-10-15", completedAt: "2026-10-15", cardEvents: [{ taps: [{ optionId: "private-tap" }] }], statistics: { schemaVersion: 1, firstTotal: 1, firstCorrect: 1, conditions: { params: { optionCount: 4 } } } });
const server = createServer(router);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const headers = { Authorization: `Bearer ${token}` };
test.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); rmSync(dataDir, { recursive: true, force: true }); });

test("statistics route requires authentication, validates filters, scopes the account and returns only aggregates", async () => {
  assert.equal((await fetch(`${base}/statistics?studentId=kid`)).status, 401);
  for (const query of ["", "studentId=kid&since=bad", "studentId=kid&timeZone=bad", "studentId=kid&since=2026-10-16&until=2026-10-15"]) assert.equal((await fetch(`${base}/statistics?${query}`, { headers })).status, 400);
  const response = await fetch(`${base}/statistics?studentId=kid&topicId=topic`, { headers });
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.totals.firstTotal, 1);
  assert.equal(JSON.stringify(report).includes("private-tap"), false);
  const empty = await fetch(`${base}/statistics?studentId=someone-else`, { headers });
  assert.equal((await empty.json()).totals.sessions, 0);
  const restored = await fetch(`${base}/sessions?studentId=kid`, { headers });
  assert.equal((await restored.json())[0].statistics.conditions.params.optionCount, 4);
});

test("history restoration is authenticated, bounded and idempotently fills missing historical settings", async () => {
  const url = `${base}/statistics/restore`;
  assert.equal((await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessions: [] }) })).status, 401);
  const request = body => fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  for (const body of [{}, { sessions: "invalid" }, { sessions: Array.from({ length: 101 }, () => ({})) }]) assert.equal((await request(body)).status, 400);
  upsertStudent(db, account.id, { id: "history-kid", name: "Test" });
  const old = { id: "historical", studentId: "history-kid", topicId: "animals", topicVersion: "1", modeId: "find_n", startedAt: "2026-10-01T10:00:00Z", completedAt: "2026-10-01T10:01:00Z", correctCount: 1, incorrectCount: 0, cardEvents: [{ conceptId: "cat", attemptCount: 1, taps: [{ isCorrect: true }] }] };
  appendSession(db, account.id, old);
  const compact = recoverHistoricalSession({ ...old, paramsSnapshot: { optionCount: 2 } });
  delete compact.cardEvents;
  for (let i = 0; i < 2; i++) {
    const response = await request({ sessions: [compact] });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).restored, 1);
  }
  const response = await fetch(`${base}/statistics?studentId=history-kid`, { headers });
  const report = await response.json();
  assert.equal(report.totals.sessions, 1);
  assert.equal(report.totals.savedSettingsSessions, 1);
  assert.equal(report.totals.firstTotal, 1);
  assert.equal(JSON.stringify(report).includes('"taps"'), false);
});
