import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount } from "../lib/account-repository.mjs";
import {
  createOrder, getOrderByExternalId, hasActiveEntitlement, getActiveSubscriptionForAccount, createPromoCode,
} from "../lib/billing-repository.mjs";
import { processBillingEvent } from "../lib/billing-orchestrator.mjs";

function makeDb() { return initDb(":memory:"); }

let _accountCounter = 0;
function makeAccount(db) {
  _accountCounter += 1;
  const acc = createAccount(db, { email: `buyer${_accountCounter}@example.com`, passwordHash: "h" });
  activateAccount(db, acc.id);
  return acc;
}

function paidOrder(db, acc, { provider = "stripe", plan = "annual", orderId, amountMinor = 8990, currency = "EUR", appliedCode = null } = {}) {
  createOrder(db, acc.id, { provider, plan, orderId, currency, amountMinor, appliedCode });
  return getOrderByExternalId(db, orderId);
}

test("processBillingEvent completes a pending order and grants entitlement on a success event", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { orderId: "order-1" });

  const result = processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_1", orderId: "order-1", amountMinor: 8990, currency: "EUR" },
    rawBody: "{}",
  });

  assert.equal(result.ok, true);
  assert.ok(hasActiveEntitlement(db, acc.id));
  assert.equal(getOrderByExternalId(db, "order-1").status, "completed");
});

test("processBillingEvent finalizes a promo redemption alongside completion", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "TENOFF", kind: "percent_off", value: 10, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  paidOrder(db, acc, { orderId: "order-2", plan: "monthly", amountMinor: 891, appliedCode: "TENOFF" });

  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_2", orderId: "order-2", amountMinor: 891, currency: "EUR" },
    rawBody: "{}",
  });

  const redeemed = db.prepare("SELECT 1 FROM promo_redemptions WHERE code = 'TENOFF' AND account_id = ?").get(acc.id);
  assert.ok(redeemed);
});

test("processBillingEvent ignores an event with no matching orderId, without throwing", () => {
  const db = makeDb();
  const result = processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_3", orderId: "no-such-order", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.deepEqual(result, { ok: false, reason: "unknown_order" });
});

test("processBillingEvent is idempotent — replaying the same event twice grants access once", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { provider: "lava_top", plan: "monthly", orderId: "order-4", amountMinor: 990 });
  const event = { eventType: "payment.success", externalId: "contract_1", orderId: "order-4", amountMinor: 990, currency: "EUR" };

  const first = processBillingEvent(db, { provider: "lava_top", event, rawBody: "{}" });
  const second = processBillingEvent(db, { provider: "lava_top", event, rawBody: "{}" }); // duplicate delivery

  assert.equal(first.ok, true);
  assert.deepEqual(second, { ok: true, duplicate: true });

  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.status, "active");
  // Exactly one entitlement grant, not two -- the duplicate must not have
  // extended the period a second time.
  const grants = db.prepare("SELECT COUNT(*) AS n FROM entitlements WHERE account_id = ? AND source = 'order'").get(acc.id).n;
  assert.equal(grants, 1);
});

test("processBillingEvent revokes entitlement on a refund event, but not other unrelated ones", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { orderId: "order-5", plan: "monthly", amountMinor: 990 });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_5a", orderId: "order-5", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.ok(hasActiveEntitlement(db, acc.id));

  const result = processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "charge.refunded", externalId: "evt_5b", orderId: "order-5", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.equal(result.ok, true);
  assert.equal(hasActiveEntitlement(db, acc.id), false);
  assert.equal(getOrderByExternalId(db, "order-5").status, "refunded");
});

test("processBillingEvent marks a chargeback distinctly from a refund", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { orderId: "order-cb", plan: "monthly", amountMinor: 990 });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_cb_a", orderId: "order-cb", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "chargeback.initiated", externalId: "evt_cb_b", orderId: "order-cb", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.equal(getOrderByExternalId(db, "order-cb").status, "chargeback");
  assert.equal(hasActiveEntitlement(db, acc.id), false);
});

test("a late webhook for an already-refunded order is a no-op, not a re-refund or an error", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { orderId: "order-late", plan: "monthly", amountMinor: 990 });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_late_a", orderId: "order-late", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "charge.refunded", externalId: "evt_late_b", orderId: "order-late", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });

  // A second, late refund delivery for the same order (different event id,
  // as a provider retry with a fresh id could in principle produce) must
  // not throw or double-process.
  const result = processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "charge.refunded", externalId: "evt_late_c", orderId: "order-late", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.deepEqual(result, { ok: true, reason: "order_not_completed" });
});

test("out-of-order events: a refund arriving before the success event is a safe no-op, and the later success still completes normally", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { orderId: "order-ooo", plan: "monthly", amountMinor: 990 });

  const refundFirst = processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "charge.refunded", externalId: "evt_ooo_refund", orderId: "order-ooo", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.deepEqual(refundFirst, { ok: true, reason: "order_not_completed" });
  assert.equal(getOrderByExternalId(db, "order-ooo").status, "pending"); // untouched

  const successAfter = processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_ooo_success", orderId: "order-ooo", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.equal(successAfter.ok, true);
  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("two checkouts in a row: confirming the second order stacks its period on top of the first's remaining time (renewal)", () => {
  const db = makeDb();
  const acc = makeAccount(db);

  paidOrder(db, acc, { orderId: "order-first", plan: "monthly", amountMinor: 990 });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_first", orderId: "order-first", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  const afterFirst = getActiveSubscriptionForAccount(db, acc.id);
  const daysAfterFirst = (new Date(afterFirst.currentPeriodEnd) - Date.now()) / 86400000;
  assert.ok(daysAfterFirst > 30 && daysAfterFirst <= 31);

  paidOrder(db, acc, { orderId: "order-second", plan: "monthly", amountMinor: 990 });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_second", orderId: "order-second", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  const afterSecond = getActiveSubscriptionForAccount(db, acc.id);
  const daysAfterSecond = (new Date(afterSecond.currentPeriodEnd) - Date.now()) / 86400000;
  // ~62 days: the second month starts from the first month's end, not from
  // "now" (which would have thrown away the remaining ~31 days).
  assert.ok(daysAfterSecond > 60 && daysAfterSecond <= 62, `expected ~62 days left after stacking two monthly orders, got ${daysAfterSecond}`);
});

test("rejects a webhook whose provider doesn't match the order's own provider", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { provider: "stripe", orderId: "order-provider", amountMinor: 8990 });

  const result = processBillingEvent(db, {
    provider: "lava_top", // order was created for stripe
    event: { eventType: "payment.success", externalId: "evt_provider", orderId: "order-provider", amountMinor: 8990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.deepEqual(result, { ok: false, reason: "provider_mismatch" });
  assert.equal(hasActiveEntitlement(db, acc.id), false);
});

test("rejects a webhook whose amount doesn't match the order's amount", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { orderId: "order-amount", amountMinor: 8990 });

  const result = processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_amount", orderId: "order-amount", amountMinor: 100, currency: "EUR" },
    rawBody: "{}",
  });
  assert.deepEqual(result, { ok: false, reason: "amount_mismatch" });
  assert.equal(hasActiveEntitlement(db, acc.id), false);
});

test("rejects a webhook whose currency doesn't match the order's currency", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { orderId: "order-currency", amountMinor: 8990, currency: "EUR" });

  const result = processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_currency", orderId: "order-currency", amountMinor: 8990, currency: "USD" },
    rawBody: "{}",
  });
  assert.deepEqual(result, { ok: false, reason: "currency_mismatch" });
  assert.equal(hasActiveEntitlement(db, acc.id), false);
});

test("webhook retry after a crash mid-transaction reprocesses cleanly instead of silently losing the grant", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  paidOrder(db, acc, { orderId: "order-crash", amountMinor: 8990 });
  const event = { eventType: "checkout.session.completed", externalId: "evt_crash", orderId: "order-crash", amountMinor: 8990, currency: "EUR" };

  // Simulate a crash partway through the transaction (after the event would
  // be recorded, before the entitlement is granted) by breaking the table
  // extendEntitlementForOrder writes to.
  db.exec("ALTER TABLE entitlements RENAME TO entitlements_disabled_for_test");
  assert.throws(() => processBillingEvent(db, { provider: "stripe", event, rawBody: "{}" }));

  // The whole transaction must have rolled back -- not just the entitlement
  // insert -- or a retry would see the event as already-processed
  // (payment_events' own idempotency check) and skip granting access
  // forever despite the payment having gone through.
  db.exec("ALTER TABLE entitlements_disabled_for_test RENAME TO entitlements");
  const eventRecorded = db.prepare("SELECT 1 FROM payment_events WHERE external_id = ?").get("evt_crash");
  assert.equal(eventRecorded, undefined, "the failed attempt must not have left the event recorded");
  assert.equal(getOrderByExternalId(db, "order-crash").status, "pending", "the failed attempt must not have marked the order completed");

  // The retried delivery (same event, table restored) now succeeds fully.
  const retryResult = processBillingEvent(db, { provider: "stripe", event, rawBody: "{}" });
  assert.equal(retryResult.ok, true);
  assert.ok(hasActiveEntitlement(db, acc.id));
  assert.equal(getOrderByExternalId(db, "order-crash").status, "completed");
});
