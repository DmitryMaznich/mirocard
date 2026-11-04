import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount } from "../lib/account-repository.mjs";
import { archiveAccount, restoreAccount, eraseAccount } from "../lib/account-lifecycle.mjs";
import { setMarketingConsent } from "../lib/marketing-consent.mjs";
import { initDeletionSurveySchema, deletionSurveyEmailHash, enqueueDeletionSurvey,
  backfillDeletionSurveys, createDeletionSurveyDispatcher, getDeletionSurveyStatus } from "../lib/deletion-survey.mjs";
import { buildDeletionSurveyEmail } from "../lib/deletion-survey-email.mjs";

const DAY = 86400000;
const T0 = Date.parse("2026-11-03T10:00:00Z");
const silent = { info() {}, warn() {} };
function fixture(db = initDb(":memory:"), email = "anna@example.test") {
  const a = createAccount(db, { email, passwordHash: "hash", firstName: "Анна", role: "parent" });
  activateAccount(db, a.id);
  setMarketingConsent(db, a.id, { optIn: true, source: "register" });
  db.prepare("UPDATE accounts SET created_at=? WHERE id=?").run(new Date(T0 - 60000).toISOString(), a.id);
  return { db, a };
}
const queue = (db, email = "anna@example.test") => db.prepare("SELECT * FROM account_deletion_surveys WHERE email_hash=?").get(deletionSurveyEmailHash(email));

test("self-deletion schedules exactly 24h later, persists over restart and sends only once", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "deletion-survey-"));
  const file = path.join(dir, "test.db");
  let db = initDb(file);
  try {
    const { a } = fixture(db);
    archiveAccount(db, a.id, "self", T0);
    assert.equal(queue(db).due_at, T0 + DAY);
    assert.equal(db.prepare("SELECT marketing_opt_in FROM accounts WHERE id=?").get(a.id).marketing_opt_in, 0);
    let time = T0 + DAY - 1;
    const calls = [];
    let dispatch = createDeletionSurveyDispatcher(db, { now: () => time, logger: silent, send: async (payload, key) => { calls.push({ payload, key }); return "provider-1"; } });
    assert.equal(await dispatch(), 0);
    assert.equal(calls.length, 0);
    db.close();
    db = initDb(file);
    time++;
    dispatch = createDeletionSurveyDispatcher(db, { now: () => time, logger: silent, send: async (payload, key) => { calls.push({ payload, key }); return "provider-1"; } });
    assert.equal(await dispatch(), 1);
    assert.equal(await dispatch(), 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].payload.replyTo, "dmaznichenko@gmail.com");
    assert.match(calls[0].payload.text, /Здравствуйте, Анна!/);
    assert.match(calls[0].payload.text, /так быстро/);
    assert.equal(queue(db).payload_json, null);
    assert.equal(queue(db).provider_email_id, "provider-1");
    const report = getDeletionSurveyStatus(db, time);
    assert.equal(report.delayHours, 24);
    assert.equal(report.states.sent, 42); // 41 imported receipts + this send.
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test("admin archive never schedules; restoration cancels and a later self-deletion gets a new due time", async () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "admin_token", T0);
    assert.equal(queue(db), undefined);
    restoreAccount(db, a.id, "restore", "Восстановление", T0 + 1000);
    archiveAccount(db, a.id, "self", T0 + 2000);
    restoreAccount(db, a.id, "restore", "Восстановление", T0 + 3000);
    assert.equal(queue(db).state, "cancelled");
    let sends = 0;
    const dispatch = createDeletionSurveyDispatcher(db, { now: () => T0 + 3 * DAY, logger: silent, send: async () => { sends++; return "bad"; } });
    assert.equal(await dispatch(), 0);
    assert.equal(sends, 0);
    archiveAccount(db, a.id, "self", T0 + 4 * DAY);
    assert.equal(queue(db).due_at, T0 + 5 * DAY);
  } finally { db.close(); }
});

test("sent receipt prevents another survey after restore/re-delete or a new account at the same address", async () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "self", T0);
    let sends = 0;
    const dispatch = createDeletionSurveyDispatcher(db, { now: () => T0 + DAY, logger: silent, send: async () => { sends++; return "one"; } });
    await dispatch();
    restoreAccount(db, a.id, "restore", "Восстановление", T0 + 2 * DAY);
    archiveAccount(db, a.id, "self", T0 + 3 * DAY);
    assert.equal(queue(db).state, "sent");
    eraseAccount(db, a.id, T0 + 4 * DAY);
    assert.equal(queue(db).account_id, null);
    assert.equal(queue(db).payload_json, null);
    const b = fixture(db).a;
    archiveAccount(db, b.id, "self", T0 + 5 * DAY);
    assert.equal(await dispatch(), 0);
    assert.equal(sends, 1);
  } finally { db.close(); }
});

test("erasure before the deadline cancels the email and removes the recipient snapshot", async () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "self", T0);
    eraseAccount(db, a.id, T0 + 1000);
    let calls = 0;
    const dispatch = createDeletionSurveyDispatcher(db, { now: () => T0 + DAY, logger: silent, send: async () => { calls++; return "bad"; } });
    assert.equal(await dispatch(), 0);
    assert.equal(calls, 0);
    assert.equal(queue(db).state, "cancelled");
    assert.equal(queue(db).account_id, null);
    assert.equal(queue(db).payload_json, null);
  } finally { db.close(); }
});

test("manual campaign import blocks backfill and withdraws old news consent once, but preserves later new permission", () => {
  const { db, a } = fixture();
  try {
    const history = [{ emailHash: deletionSurveyEmailHash(a.email), sentAt: new Date(T0).toISOString(), providerEmailId: "manual-1" }];
    initDeletionSurveySchema(db, history);
    assert.equal(queue(db).state, "sent");
    assert.equal(db.prepare("SELECT marketing_opt_in FROM accounts WHERE id=?").get(a.id).marketing_opt_in, 0);
    setMarketingConsent(db, a.id, { optIn: true, source: "settings" });
    initDeletionSurveySchema(db, history);
    assert.equal(db.prepare("SELECT marketing_opt_in FROM accounts WHERE id=?").get(a.id).marketing_opt_in, 1);
    archiveAccount(db, a.id, "self", T0 + 1000);
    backfillDeletionSurveys(db);
    assert.equal(queue(db).provider_email_id, "manual-1");
  } finally { db.close(); }
});

test("startup recovers only current self-deletions, and repeated backfills do not reset the deadline", () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "self", T0);
    db.prepare("DELETE FROM account_deletion_surveys WHERE email_hash=?").run(deletionSurveyEmailHash(a.email));
    assert.equal(backfillDeletionSurveys(db), 1);
    assert.equal(queue(db).due_at, T0 + DAY);
    backfillDeletionSurveys(db);
    assert.equal(queue(db).due_at, T0 + DAY);
    restoreAccount(db, a.id, "restore", "Восстановление", T0 + 2000);
    archiveAccount(db, a.id, "admin_token", T0 + 3000);
    assert.equal(backfillDeletionSurveys(db), 0);
  } finally { db.close(); }
});

test("two dispatchers cannot claim the same due email concurrently", async () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "self", T0);
    let resolve;
    let calls = 0;
    const opts = { now: () => T0 + DAY, logger: silent, send: async () => { calls++; return new Promise(r => { resolve = r; }); } };
    const first = createDeletionSurveyDispatcher(db, opts)();
    assert.equal(await createDeletionSurveyDispatcher(db, opts)(), 0);
    assert.equal(calls, 1);
    resolve("one");
    assert.equal(await first, 1);
  } finally { db.close(); }
});

test("temporary failure retries the same payload and idempotency key within the safe window", async () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "self", T0);
    let time = T0 + DAY, first;
    const warnings = [];
    const dispatch = createDeletionSurveyDispatcher(db, { now: () => time, logger: { info() {}, warn(s) { warnings.push(s); } }, send: async (payload, key) => {
      if (!first) { first = { payload, key }; throw new Error("secret-token anna@example.test"); }
      assert.deepEqual(payload, first.payload);
      assert.equal(key, first.key);
      return "retried";
    } });
    assert.equal(await dispatch(), 0);
    assert.equal(queue(db).state, "pending");
    assert.doesNotMatch(warnings.join(""), /secret-token|anna@example/);
    db.prepare("UPDATE accounts SET first_name='Changed' WHERE id=?").run(a.id);
    time += 60000;
    assert.equal(await dispatch(), 1);
    assert.equal(queue(db).attempts, 2);
  } finally { db.close(); }
});

test("an expired idempotency window is held for review rather than risking a duplicate", async () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "self", T0);
    let time = T0 + DAY, calls = 0;
    const dispatch = createDeletionSurveyDispatcher(db, { now: () => time, logger: silent, send: async () => { calls++; throw new Error("network"); } });
    await dispatch();
    time += 23 * 3600000;
    assert.equal(await dispatch(), 0);
    assert.equal(calls, 1);
    assert.equal(queue(db).state, "uncertain");
    assert.equal(queue(db).payload_json, null);
  } finally { db.close(); }
});

test("email budget exhaustion leaves the job unclaimed; permanent provider rejection is not retried", async () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "self", T0);
    let capacity = false, calls = 0;
    const dispatch = createDeletionSurveyDispatcher(db, { now: () => T0 + DAY, canSend: () => capacity, logger: silent, send: async () => { calls++; throw Object.assign(new Error("invalid"), { resendStatus: 422 }); } });
    assert.equal(await dispatch(), 0);
    assert.equal(queue(db).attempts, 0);
    assert.equal(queue(db).first_attempt_at, null);
    capacity = true;
    await dispatch();
    assert.equal(queue(db).state, "failed");
    await dispatch();
    assert.equal(calls, 1);
  } finally { db.close(); }
});

test("recovered lease reuses its frozen payload; repeated deletion cannot reset sent receipts", async () => {
  const { db, a } = fixture();
  try {
    archiveAccount(db, a.id, "self", T0);
    const payload = buildDeletionSurveyEmail({ ...a, first_name: "Анна", created_at: new Date(T0 - 1000).toISOString() }, new Date(T0).toISOString());
    db.prepare("UPDATE account_deletion_surveys SET state='sending',lease_until=?,first_attempt_at=?,attempts=1,payload_json=? WHERE email_hash=?")
      .run(T0 + DAY, T0 + DAY, JSON.stringify(payload), deletionSurveyEmailHash(a.email));
    const dispatch = createDeletionSurveyDispatcher(db, { now: () => T0 + DAY + 1000, logger: silent, send: async p => { assert.deepEqual(p, payload); return "recovered"; } });
    assert.equal(await dispatch(), 1);
    assert.equal(enqueueDeletionSurvey(db, a, new Date(T0 + 10 * DAY).toISOString()), false);
    assert.equal(queue(db).state, "sent");
  } finally { db.close(); }
});

test("email contains all ten choices and the promise, with safe greetings and no active content", () => {
  const a = { email: "owner@example.test", first_name: '<img src="x">', created_at: new Date(T0 - 2 * DAY).toISOString() };
  const p = buildDeletionSurveyEmail(a, new Date(T0).toISOString());
  assert.match(p.text, /^Здравствуйте!/);
  assert.equal((p.html.match(/<li /g) ?? []).length, 10);
  assert.match(p.text, /10\. Другая причина/);
  assert.match(p.text, /без вашего разрешения больше не пришлю/);
  assert.doesNotMatch(p.html, /<script|<form|<img|href=/);
  assert.doesNotMatch(p.text, /так быстро/);
});
