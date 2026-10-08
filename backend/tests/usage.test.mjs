import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import {
  createAccount,
  activateAccount,
  appendSession,
  upsertStudent,
} from "../lib/account-repository.mjs";
import { appendUsageEvent, getUsageReport } from "../lib/usage-repository.mjs";
import { processSync } from "../lib/sync-processor.mjs";
const now = Date.parse("2026-10-08T12:00:00Z");
function fixture() {
  const db = initDb(":memory:");
  const a = createAccount(db, {
    email: "usage@example.test",
    passwordHash: "hash",
  });
  activateAccount(db, a.id);
  upsertStudent(db, a.id, { id: "student", name: "Student" });
  return { db, a };
}
const event = (id, kind, extra = {}) => ({
  id,
  kind,
  occurredAt: new Date(now).toISOString(),
  topicId: "topic",
  screen: "session",
  visitId: "visit",
  device: "Phone",
  version: "1.0.0",
  ...extra,
});
const session = (id, extra = {}) => ({
  id,
  studentId: "student",
  topicId: "topic",
  topicVersion: "1",
  mode: "exercise",
  startedAt: new Date(now - 60000).toISOString(),
  completedAt: new Date(now).toISOString(),
  ...extra,
});
test("usage retries are idempotent, durations bounded, account scope is server-owned", () => {
  const { db, a } = fixture();
  const e = event("time", "time", {
    foregroundMs: 999999,
    activeMs: 999999,
    accountId: "other",
  });
  appendUsageEvent(db, a.id, e, now);
  appendUsageEvent(db, a.id, e, now);
  appendUsageEvent(db, a.id, event("bad", "arbitrary"), now);
  const r = getUsageReport(db, a.id, "30", now);
  assert.equal(r.summary.foregroundMs, 30000);
  assert.equal(r.summary.activeMs, 30000);
  assert.equal(r.technical.version, "1.0.0");
  assert.equal(getUsageReport(db, "other", "all", now).summary.foregroundMs, 0);
  db.close();
});
test("legacy sessions retain unknown active time; new duration persists through sync and replay", () => {
  const { db, a } = fixture();
  appendSession(db, a.id, session("old"));
  processSync(db, a.id, [
    {
      type: "session.append",
      data: session("new", {
        activeDurationMs: 25000,
        elapsedDurationMs: 60000,
      }),
    },
  ]);
  appendUsageEvent(
    db,
    a.id,
    event("start", "session_start", { sessionId: "new" }),
    now,
  );
  appendUsageEvent(
    db,
    a.id,
    event("exit", "session_exit", { sessionId: "new" }),
    now,
  );
  appendUsageEvent(
    db,
    a.id,
    event("start2", "session_start", { sessionId: "interrupted" }),
    now,
  );
  appendUsageEvent(
    db,
    a.id,
    event("exit2", "session_exit", { sessionId: "interrupted" }),
    now,
  );
  appendUsageEvent(
    db,
    a.id,
    event("start3", "session_start", { sessionId: "unknown" }),
    now,
  );
  const r = getUsageReport(db, a.id, "all", now),
    t = r.topics[0];
  assert.equal(t.completed, 2);
  assert.equal(t.interrupted, 1);
  assert.equal(t.unclosed, 1);
  assert.equal(t.exerciseActiveMs, 25000);
  assert.equal(t.measuredSessions, 1);
  assert.equal(
    db.prepare("SELECT active_duration_ms FROM sessions WHERE id='old'").get()
      .active_duration_ms,
    null,
  );
  assert.equal(r.timeline.find((e) => e.id === "old").elapsedMs, 60000);
  db.close();
});
test("today uses Ljubljana midnight and period filtering excludes older events", () => {
  const { db, a } = fixture();
  appendUsageEvent(
    db,
    a.id,
    event("yesterday", "topic_open", { occurredAt: "2026-10-07T21:59:59Z" }),
    now,
  );
  appendUsageEvent(
    db,
    a.id,
    event("today", "topic_open", { occurredAt: "2026-10-07T22:00:00Z" }),
    now,
  );
  assert.equal(getUsageReport(db, a.id, "today", now).topics[0].opens, 1);
  assert.equal(getUsageReport(db, a.id, "all", now).topics[0].opens, 2);
  assert.throws(
    () => getUsageReport(db, a.id, "bad", now),
    (e) => e.status === 400,
  );
  db.close();
});
test("usage-only sync does not change application data revision; duplicates survive replay", () => {
  const { db, a } = fixture();
  const getRev = () =>
    db
      .prepare("SELECT revision FROM sync_revision WHERE account_id=?")
      .get(a.id)?.revision;
  const before = getRev();
  const op = {
    type: "usage.append",
    data: event("offline", "topic_open", {
      occurredAt: new Date().toISOString(),
    }),
  };
  processSync(db, a.id, [op, op]);
  assert.equal(getRev(), before);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM usage_events").get().n, 1);
  db.close();
});
