import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount } from "../lib/account-repository.mjs";
import {
  createPendingSubscription, hasActiveEntitlement, getActiveSubscriptionForAccount, createPromoCode,
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

test("processBillingEvent activates a pending subscription on a success event", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "annual", orderId: "order-1",
    currency: "EUR", amountMinor: 8990, periodDays: 366,
  });

  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_1", orderId: "order-1", amountMinor: 8990, currency: "EUR" },
    rawBody: "{}",
  });

  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("processBillingEvent finalizes a promo redemption alongside activation", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "TENOFF", kind: "percent_off", value: 10, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-2",
    currency: "EUR", amountMinor: 891, periodDays: 31, appliedCode: "TENOFF",
  });

  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_2", orderId: "order-2", amountMinor: 891, currency: "EUR" },
    rawBody: "{}",
  });

  const redeemed = db.prepare("SELECT 1 FROM promo_redemptions WHERE code = 'TENOFF' AND account_id = ?").get(acc.id);
  assert.ok(redeemed);
});

test("processBillingEvent ignores an event with no matching orderId", () => {
  const db = makeDb();
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_3", orderId: "no-such-order", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  }); // must not throw
});

test("processBillingEvent is idempotent — replaying the same event twice activates once", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPendingSubscription(db, acc.id, {
    provider: "lava_top", plan: "monthly", orderId: "order-4",
    currency: "EUR", amountMinor: 990, periodDays: 31,
  });
  const event = { eventType: "payment.success", externalId: "contract_1", orderId: "order-4", amountMinor: 990, currency: "EUR" };
  processBillingEvent(db, { provider: "lava_top", event, rawBody: "{}" });
  processBillingEvent(db, { provider: "lava_top", event, rawBody: "{}" }); // duplicate delivery

  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.status, "active"); // no error, no double-processing
});

test("processBillingEvent revokes entitlement on a refund event", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-5",
    currency: "EUR", amountMinor: 990, periodDays: 31,
  });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_5a", orderId: "order-5", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.ok(hasActiveEntitlement(db, acc.id));

  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "charge.refunded", externalId: "evt_5b", orderId: "order-5", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.equal(hasActiveEntitlement(db, acc.id), false);
});
