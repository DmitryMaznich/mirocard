import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount } from "../lib/account-repository.mjs";
import {
  createPendingSubscription,
  activateSubscriptionByOrderId,
  markSubscriptionRefundedByOrderId,
  getSubscriptionByOrderId,
  getActiveSubscriptionForAccount,
  recordPaymentEvent,
  hasActiveEntitlement,
} from "../lib/billing-repository.mjs";

function makeAccount(db) {
  const acc = createAccount(db, { email: "buyer@example.com", passwordHash: "h" });
  activateAccount(db, acc.id);
  return acc;
}

function makeDb() { return initDb(":memory:"); }

test("createPendingSubscription then activateSubscriptionByOrderId flips status to active", () => {
  const db = makeDb();
  const acc = makeAccount(db);

  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "annual", orderId: "order-1",
    currency: "EUR", amountMinor: 8990, periodDays: 366, appliedCode: null,
  });

  assert.equal(getActiveSubscriptionForAccount(db, acc.id), null); // still pending

  const returnedAccountId = activateSubscriptionByOrderId(db, "order-1");
  assert.equal(returnedAccountId, acc.id);

  const active = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(active.plan, "annual");
  assert.equal(active.status, "active");
  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("activateSubscriptionByOrderId returns null for an unknown orderId", () => {
  const db = makeDb();
  assert.equal(activateSubscriptionByOrderId(db, "nope"), null);
});

test("markSubscriptionRefundedByOrderId revokes entitlement", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-2",
    currency: "EUR", amountMinor: 990, periodDays: 31, appliedCode: null,
  });
  activateSubscriptionByOrderId(db, "order-2");
  assert.ok(hasActiveEntitlement(db, acc.id));

  markSubscriptionRefundedByOrderId(db, "order-2");
  assert.equal(hasActiveEntitlement(db, acc.id), false);
  assert.equal(getSubscriptionByOrderId(db, "order-2").status, "refunded");
});

test("recordPaymentEvent returns true once, false on a duplicate delivery", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  const args = { accountId: acc.id, provider: "stripe", eventType: "checkout.session.completed", externalId: "evt_1", payloadJson: "{}" };
  assert.equal(recordPaymentEvent(db, args), true);
  assert.equal(recordPaymentEvent(db, args), false);
});

test("hasActiveEntitlement is true for an account with the all_access feature flag, even without a subscription", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  db.prepare("UPDATE accounts SET feature_flags = ? WHERE id = ?").run(JSON.stringify(["all_access"]), acc.id);
  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("hasActiveEntitlement is false for an unknown account", () => {
  const db = makeDb();
  assert.equal(hasActiveEntitlement(db, "no-such-account"), false);
});
