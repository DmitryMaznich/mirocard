import { test } from "node:test";
import assert from "node:assert/strict";

// RESEND_API_KEY must be set before mailer.mjs is imported (config.mjs
// reads process.env at import time) so sendEntitlementReminderEmail
// actually calls fetch instead of taking its dev-mode console.log no-op
// path -- this test wants to verify the real call, stubbed below.
process.env.RESEND_API_KEY = "test_resend_key";

const { initDb } = await import("../lib/db.mjs");
const { createAccount, activateAccount } = await import("../lib/account-repository.mjs");
const { grantTrialSubscription, findEntitlementsNeedingReminders, markReminderSent } = await import("../lib/billing-repository.mjs");
const { runReminderSweepOnce } = await import("../../scripts/entitlement-reminder-loop.mjs");

function makeDb() { return initDb(":memory:"); }
let _n = 0;
function makeAccount(db) {
  _n += 1;
  const acc = createAccount(db, { email: `reminder${_n}@example.com`, passwordHash: "h" });
  activateAccount(db, acc.id);
  return acc;
}

function setEntitlementEndsAt(db, accountId, iso) {
  db.prepare("UPDATE entitlements SET ends_at = ? WHERE account_id = ? AND status = 'active'").run(iso, accountId);
}

test("findEntitlementsNeedingReminders flags an entitlement ending in ~4 days as days5-due", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 30 });
  setEntitlementEndsAt(db, acc.id, new Date(Date.now() + 4 * 86400000).toISOString());

  const due = findEntitlementsNeedingReminders(db);
  assert.equal(due.length, 1);
  assert.equal(due[0].kind, "days5");
  assert.equal(due[0].email, acc.email);
});

test("findEntitlementsNeedingReminders flags an entitlement ending in ~12 hours as days1-due, not days5", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 30 });
  setEntitlementEndsAt(db, acc.id, new Date(Date.now() + 12 * 3600000).toISOString());

  const due = findEntitlementsNeedingReminders(db);
  assert.equal(due.length, 1);
  assert.equal(due[0].kind, "days1");
});

test("findEntitlementsNeedingReminders flags a past ends_at as expired-due", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 30 });
  setEntitlementEndsAt(db, acc.id, new Date(Date.now() - 3600000).toISOString());

  const due = findEntitlementsNeedingReminders(db);
  assert.equal(due.length, 1);
  assert.equal(due[0].kind, "expired");
});

test("an entitlement that expired long ago (e.g. a legacy trial backfilled on first deploy) gets no expired reminder", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 30 });
  setEntitlementEndsAt(db, acc.id, new Date(Date.now() - 60 * 86400000).toISOString());

  assert.deepEqual(findEntitlementsNeedingReminders(db), []);
});

test("markReminderSent makes the same reminder kind not-due again", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 30 });
  setEntitlementEndsAt(db, acc.id, new Date(Date.now() + 4 * 86400000).toISOString());

  const [first] = findEntitlementsNeedingReminders(db);
  markReminderSent(db, first.entitlement.id, "days5");

  assert.equal(findEntitlementsNeedingReminders(db).length, 0);
});

test("a superseded (older, lower ends_at) active row is never reminder-due once a later one covers the account", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 30 });
  // Trial's own ends_at is "tomorrow" -- would be days1-due on its own --
  // but a later order entitlement already covers the account well past
  // that, so the account's *actual* access isn't ending soon at all.
  setEntitlementEndsAt(db, acc.id, new Date(Date.now() + 12 * 3600000).toISOString());
  db.prepare(`
    INSERT INTO entitlements (id, account_id, source, source_id, plan, status, starts_at, ends_at, cancel_at_period_end, created_at, updated_at)
    VALUES ('order-row', ?, 'order', 'some-order', 'annual', 'active', ?, ?, 0, ?, ?)
  `).run(acc.id, new Date().toISOString(), new Date(Date.now() + 400 * 86400000).toISOString(), new Date().toISOString(), new Date().toISOString());

  assert.equal(findEntitlementsNeedingReminders(db).length, 0);
});

test("runReminderSweepOnce sends the due email and marks it sent so a second sweep is a no-op", async () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 30 });
  setEntitlementEndsAt(db, acc.id, new Date(Date.now() + 4 * 86400000).toISOString());

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ id: "email_1" }) };
  };
  try {
    const sentCount1 = await runReminderSweepOnce(db);
    assert.equal(sentCount1, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.to, acc.email);

    const sentCount2 = await runReminderSweepOnce(db);
    assert.equal(sentCount2, 0, "the reminder must not fire twice");
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
