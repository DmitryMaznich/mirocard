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
  createPromoCode,
  listPromoCodes,
  validatePromoCode,
  redeemFreeGrantCode,
  finalizeDiscountRedemption,
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

test("validatePromoCode rejects an unknown code", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  const result = validatePromoCode(db, "NOPE", { accountId: acc.id, plan: "monthly" });
  assert.deepEqual(result, { ok: false, reason: "not_found" });
});

test("validatePromoCode accepts a matching percent_off code and normalizes case", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "welcome10", kind: "percent_off", value: 10, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: "launch", createdBy: "dima",
  });
  const result = validatePromoCode(db, "Welcome10", { accountId: acc.id, plan: "monthly" });
  assert.equal(result.ok, true);
  assert.equal(result.code, "WELCOME10");
  assert.equal(result.kind, "percent_off");
  assert.equal(result.value, 10);
});

test("validatePromoCode rejects a code already redeemed by this account", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "ONE-USE", kind: "free_grant", value: null, currency: null,
    appliesToPlan: null, grantDurationDays: 30, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  assert.equal(redeemFreeGrantCode(db, "ONE-USE", acc.id).ok, true);
  const second = validatePromoCode(db, "ONE-USE", { accountId: acc.id, plan: "monthly" });
  assert.deepEqual(second, { ok: false, reason: "already_used" });
});

test("validatePromoCode rejects a code restricted to a different plan", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "ANNUAL-ONLY", kind: "fixed_off", value: 1000, currency: "EUR",
    appliesToPlan: "annual", grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  const result = validatePromoCode(db, "ANNUAL-ONLY", { accountId: acc.id, plan: "monthly" });
  assert.deepEqual(result, { ok: false, reason: "wrong_plan" });
});

test("validatePromoCode rejects a code once max_redemptions is reached", () => {
  const db = makeDb();
  const acc1 = makeAccount(db);
  createPromoCode(db, {
    code: "LIMIT1", kind: "free_grant", value: null, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: 1,
    expiresAt: null, note: null, createdBy: "dima",
  });
  assert.equal(redeemFreeGrantCode(db, "LIMIT1", acc1.id).ok, true);

  const acc2 = createAccount(db, { email: "second@example.com", passwordHash: "h" });
  activateAccount(db, acc2.id);
  const result = validatePromoCode(db, "LIMIT1", { accountId: acc2.id, plan: "monthly" });
  assert.deepEqual(result, { ok: false, reason: "exhausted" });
});

test("redeemFreeGrantCode activates entitlement immediately without a payment provider", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "FREEBIE", kind: "free_grant", value: null, currency: null,
    appliesToPlan: null, grantDurationDays: 14, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  const result = redeemFreeGrantCode(db, "FREEBIE", acc.id);
  assert.equal(result.ok, true);
  assert.ok(hasActiveEntitlement(db, acc.id));
  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.plan, "free_grant");
});

test("redeemFreeGrantCode refuses a discount-kind code", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "DISCOUNTONLY", kind: "percent_off", value: 20, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  const result = redeemFreeGrantCode(db, "DISCOUNTONLY", acc.id);
  assert.deepEqual(result, { ok: false, reason: "not_free_grant" });
});

test("finalizeDiscountRedemption records one redemption and bumps redeemed_count, twice is a no-op", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "TENOFF", kind: "percent_off", value: 10, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  finalizeDiscountRedemption(db, "TENOFF", acc.id);
  finalizeDiscountRedemption(db, "TENOFF", acc.id);
  assert.equal(listPromoCodes(db).find((c) => c.code === "TENOFF").redeemedCount, 1);
});

test("finalizeDiscountRedemption is a no-op when code is null", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  finalizeDiscountRedemption(db, null, acc.id); // must not throw
});
