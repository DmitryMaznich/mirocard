import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount } from "../lib/account-repository.mjs";
import {
  createOrder, getOrderByExternalId, hasActiveEntitlement, getActiveSubscriptionForAccount,
  findEntitlementsNeedingReminders,
} from "../lib/billing-repository.mjs";
import {
  processPaddleEvent, getProviderSubscriptionSummary, reconcileProviderSubscriptions, PAST_DUE_GRACE_DAYS,
} from "../lib/billing-subscriptions.mjs";

const AT = "2026-11-07T12:00:00.000Z";
const DAY = 86400000;
const plus = (days, from = AT) => new Date(new Date(from).getTime() + days * DAY).toISOString();

let seq = 0;
function setup() {
  const db = initDb(":memory:");
  seq += 1;
  const acc = createAccount(db, { email: `sub${seq}@example.com`, passwordHash: "h" });
  activateAccount(db, acc.id);
  // No trial noise: these tests are about the subscription's own entitlement.
  db.prepare("DELETE FROM entitlements WHERE account_id = ?").run(acc.id);
  return { db, acc };
}

let evt = 0;
function subEvent(acc, overrides = {}, eventType = "subscription.updated") {
  evt += 1;
  return {
    eventId: `evt_${evt}`, eventType, kind: "subscription",
    subscription: {
      subscriptionId: "sub_1", customerId: "ctm_1", status: "active", plan: "annual",
      periodStart: AT, periodEnd: plus(366), scheduledCancelAt: null, canceledAt: null, pausedAt: null,
      updatedAt: plus(0), accountId: acc.id, ...overrides,
    },
  };
}

// hasActiveEntitlement compares with the real clock; the tests below use
// dates relative to AT in the near past/future of 2026-11, so check access
// through the entitlement row itself.
function subscriptionEntitlement(db) {
  return db.prepare("SELECT * FROM entitlements WHERE source = 'subscription' AND source_id = 'sub_1'").get();
}

test("subscription.created grants access until the end of the billing period", () => {
  const { db, acc } = setup();
  const result = processPaddleEvent(db, subEvent(acc, {}, "subscription.created"), { at: AT });
  assert.equal(result.ok, true);
  const ent = subscriptionEntitlement(db);
  assert.equal(ent.ends_at, plus(366));
  assert.equal(ent.status, "active");
  assert.equal(ent.cancel_at_period_end, 0);
  assert.equal(getProviderSubscriptionSummary(db, acc.id).renews, true);
});

test("the same delivery twice is applied once", () => {
  const { db, acc } = setup();
  const event = subEvent(acc);
  processPaddleEvent(db, event, { at: AT });
  assert.deepEqual(processPaddleEvent(db, event, { at: AT }), { ok: true, duplicate: true });
});

test("an older event arriving after a newer one does not roll the state back", () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc, { status: "canceled", canceledAt: plus(1), updatedAt: plus(1) }), { at: AT });
  const late = processPaddleEvent(db, subEvent(acc, { status: "active", updatedAt: plus(0) }), { at: AT });
  assert.equal(late.reason, "stale_event");
  assert.equal(getProviderSubscriptionSummary(db, acc.id).status, "canceled");
});

test("a renewal moves access forward and re-arms the reminders", () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc, { plan: "monthly", periodEnd: plus(31) }), { at: AT });
  db.prepare("UPDATE entitlements SET reminder_5d_sent_at = ?").run(AT);
  processPaddleEvent(db, subEvent(acc, { plan: "monthly", periodStart: plus(31), periodEnd: plus(62), updatedAt: plus(31) }), { at: plus(31) });
  const ent = subscriptionEntitlement(db);
  assert.equal(ent.ends_at, plus(62));
  assert.equal(ent.reminder_5d_sent_at, null);
});

test("a scheduled cancellation keeps access to the period end and marks it as ending", () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc, { scheduledCancelAt: plus(366) }), { at: AT });
  const ent = subscriptionEntitlement(db);
  assert.equal(ent.ends_at, plus(366));
  assert.equal(ent.cancel_at_period_end, 1);
  assert.equal(getProviderSubscriptionSummary(db, acc.id).renews, false);
});

test("past_due keeps access for the grace period from the start of the unpaid period", () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc, { status: "past_due", periodStart: AT, periodEnd: plus(31) }), { at: AT });
  const ent = subscriptionEntitlement(db);
  assert.equal(ent.ends_at, plus(PAST_DUE_GRACE_DAYS));
  assert.equal(getProviderSubscriptionSummary(db, acc.id).graceUntil, plus(PAST_DUE_GRACE_DAYS));
});

test("canceled ends access at the cancellation moment", () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc), { at: AT });
  processPaddleEvent(db, subEvent(acc, { status: "canceled", canceledAt: AT, updatedAt: plus(1) }), { at: plus(1) });
  const ent = subscriptionEntitlement(db);
  assert.equal(ent.ends_at, AT);
  assert.equal(ent.status, "expired");
});

test("a full refund revokes access and a later state event does not bring it back", () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc), { at: AT });
  const refund = processPaddleEvent(db, {
    eventId: "evt_refund", eventType: "adjustment.created", kind: "adjustment",
    adjustment: { adjustmentId: "adj_1", action: "refund", status: "approved", type: "full", subscriptionId: "sub_1", customerId: "ctm_1" },
  }, { at: plus(1) });
  assert.equal(refund.kind, "revoked");
  processPaddleEvent(db, subEvent(acc, { updatedAt: plus(2) }), { at: plus(2) });
  assert.equal(subscriptionEntitlement(db).status, "revoked");
});

test("a partial refund keeps access", () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc), { at: AT });
  const result = processPaddleEvent(db, {
    eventId: "evt_partial", eventType: "adjustment.created", kind: "adjustment",
    adjustment: { adjustmentId: "adj_2", action: "refund", status: "approved", type: "partial", subscriptionId: "sub_1", customerId: "ctm_1" },
  }, { at: plus(1) });
  assert.equal(result.reason, "adjustment_keeps_access");
  assert.equal(subscriptionEntitlement(db).status, "active");
});

test("transaction.completed completes our pending order once; renewals don't re-complete it", () => {
  const { db, acc } = setup();
  createOrder(db, acc.id, { provider: "paddle", plan: "annual", orderId: "ord_1", currency: "EUR", amountMinor: 8990 });
  const tx = (id) => ({
    eventId: id, eventType: "transaction.completed", kind: "transaction",
    transaction: { transactionId: id, status: "completed", subscriptionId: "sub_1", customerId: "ctm_1", orderId: "ord_1", accountId: acc.id, amountMinor: 8990, currency: "EUR" },
  });
  const first = processPaddleEvent(db, tx("txn_1"), { at: AT });
  assert.equal(first.kind, "completed");
  assert.equal(getOrderByExternalId(db, "ord_1").status, "completed");
  assert.equal(processPaddleEvent(db, tx("txn_2"), { at: AT }).reason, "order_not_pending");
});

test("an event for an account we can't identify is refused without side effects", () => {
  const { db } = setup();
  const result = processPaddleEvent(db, {
    eventId: "evt_x", eventType: "subscription.created", kind: "subscription",
    subscription: { subscriptionId: "sub_unknown", customerId: "ctm_unknown", status: "active", plan: "annual", periodStart: AT, periodEnd: plus(30), accountId: "nobody" },
  }, { at: AT });
  assert.deepEqual(result, { ok: false, reason: "unknown_account" });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM payment_events").get().n, 0);
});

test("a later event without custom_data still finds the account by subscription id", () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc), { at: AT });
  const result = processPaddleEvent(db, subEvent(acc, { accountId: null, updatedAt: plus(1) }), { at: AT });
  assert.equal(result.ok, true);
  assert.equal(result.accountId, acc.id);
});

test("an auto-renewing subscription gets no 'ends in 5 days' reminder; a cancelled one does", () => {
  const { db, acc } = setup();
  const now = new Date().toISOString();
  const soon = new Date(Date.now() + 3 * DAY).toISOString();
  processPaddleEvent(db, subEvent(acc, { periodStart: now, periodEnd: soon, updatedAt: now }), { at: now });
  assert.equal(findEntitlementsNeedingReminders(db).length, 0);
  processPaddleEvent(db, subEvent(acc, { periodStart: now, periodEnd: soon, scheduledCancelAt: soon, updatedAt: soon }), { at: now });
  assert.deepEqual(findEntitlementsNeedingReminders(db).map((r) => r.kind), ["days5"]);
});

test("an active subscription counts as access for the existing checks", () => {
  const { db, acc } = setup();
  const now = new Date().toISOString();
  processPaddleEvent(db, subEvent(acc, { periodStart: now, periodEnd: new Date(Date.now() + 30 * DAY).toISOString(), updatedAt: now }), { at: now });
  assert.equal(hasActiveEntitlement(db, acc.id), true);
  assert.equal(getActiveSubscriptionForAccount(db, acc.id).plan, "annual");
});

test("reconciliation applies the provider's current state", async () => {
  const { db, acc } = setup();
  processPaddleEvent(db, subEvent(acc), { at: AT });
  const changed = await reconcileProviderSubscriptions(db, async () => ({
    subscriptionId: "sub_1", customerId: "ctm_1", status: "canceled", plan: "annual",
    periodStart: null, periodEnd: null, scheduledCancelAt: null, canceledAt: plus(2), pausedAt: null, updatedAt: plus(2),
  }), { at: plus(3) });
  assert.equal(changed, 1);
  assert.equal(getProviderSubscriptionSummary(db, acc.id).status, "canceled");
  assert.equal(subscriptionEntitlement(db).ends_at, plus(2));
});
