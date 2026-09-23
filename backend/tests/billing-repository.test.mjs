import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount } from "../lib/account-repository.mjs";
import {
  createOrder,
  getOrderByExternalId,
  completeOrder,
  markOrderRefunded,
  extendEntitlementForOrder,
  revokeEntitlementsForOrder,
  getActiveSubscriptionForAccount,
  recordPaymentEvent,
  hasActiveEntitlement,
  createPromoCode,
  listPromoCodes,
  validatePromoCode,
  redeemFreeGrantCode,
  finalizeDiscountRedemption,
  grantTrialSubscription,
} from "../lib/billing-repository.mjs";

function makeAccount(db) {
  const acc = createAccount(db, { email: "buyer@example.com", passwordHash: "h" });
  activateAccount(db, acc.id);
  return acc;
}

function makeDb() { return initDb(":memory:"); }

test("createOrder then completeOrder+extendEntitlementForOrder grants access", () => {
  const db = makeDb();
  const acc = makeAccount(db);

  createOrder(db, acc.id, {
    provider: "stripe", plan: "annual", orderId: "order-1",
    currency: "EUR", amountMinor: 8990, appliedCode: null,
  });

  assert.equal(getActiveSubscriptionForAccount(db, acc.id), null); // still pending

  const order = getOrderByExternalId(db, "order-1");
  completeOrder(db, order.id);
  extendEntitlementForOrder(db, order);

  const active = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(active.plan, "annual");
  assert.equal(active.status, "active");
  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("getOrderByExternalId returns null for an unknown orderId", () => {
  const db = makeDb();
  assert.equal(getOrderByExternalId(db, "nope"), null);
});

test("markOrderRefunded + revokeEntitlementsForOrder revokes the entitlement that order granted", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createOrder(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-2",
    currency: "EUR", amountMinor: 990, appliedCode: null,
  });
  const order = getOrderByExternalId(db, "order-2");
  completeOrder(db, order.id);
  extendEntitlementForOrder(db, order);
  assert.ok(hasActiveEntitlement(db, acc.id));

  markOrderRefunded(db, order.id, "charge.refunded");
  revokeEntitlementsForOrder(db, order.id);
  assert.equal(hasActiveEntitlement(db, acc.id), false);
  assert.equal(getOrderByExternalId(db, "order-2").status, "refunded");
});

test("refunding one order does not revoke a still-active entitlement from a different order", () => {
  const db = makeDb();
  const acc = makeAccount(db);

  createOrder(db, acc.id, { provider: "stripe", plan: "monthly", orderId: "order-a", currency: "EUR", amountMinor: 990 });
  const orderA = getOrderByExternalId(db, "order-a");
  completeOrder(db, orderA.id);
  extendEntitlementForOrder(db, orderA);

  createOrder(db, acc.id, { provider: "stripe", plan: "monthly", orderId: "order-b", currency: "EUR", amountMinor: 990 });
  const orderB = getOrderByExternalId(db, "order-b");
  completeOrder(db, orderB.id);
  extendEntitlementForOrder(db, orderB); // stacks on top of order-a's period

  markOrderRefunded(db, orderA.id, "charge.refunded");
  revokeEntitlementsForOrder(db, orderA.id);

  // order-b's grant is untouched, so the account is still entitled.
  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("recordPaymentEvent returns true once, false on a duplicate delivery", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  const args = { accountId: acc.id, provider: "stripe", eventType: "checkout.session.completed", externalId: "evt_1", payloadJson: "{}" };
  assert.equal(recordPaymentEvent(db, args), true);
  assert.equal(recordPaymentEvent(db, args), false);
});

test("hasActiveEntitlement is true for an account with the all_access feature flag, even without any entitlement row", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  db.prepare("UPDATE accounts SET feature_flags = ? WHERE id = ?").run(JSON.stringify(["all_access"]), acc.id);
  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("getActiveSubscriptionForAccount reflects an all_access account too (not just hasActiveEntitlement)", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  db.prepare("UPDATE accounts SET feature_flags = ? WHERE id = ?").run(JSON.stringify(["all_access"]), acc.id);
  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.plan, "all_access");
  assert.equal(sub.status, "active");
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

test("redeemFreeGrantCode replaces an active trial rather than stacking on top of it", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id); // ~7 days left
  createPromoCode(db, {
    code: "INSTAGRAM31", kind: "free_grant", value: null, currency: null,
    appliesToPlan: null, grantDurationDays: 31, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });

  const result = redeemFreeGrantCode(db, "INSTAGRAM31", acc.id);
  assert.equal(result.ok, true);

  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.plan, "free_grant");
  const daysLeft = (new Date(sub.currentPeriodEnd) - Date.now()) / 86400000;
  assert.ok(daysLeft > 30 && daysLeft <= 31, `expected ~31 days left (promo replaces trial), got ${daysLeft}`);

  // Exactly one active entitlement — the trial was revoked, not left running
  // alongside the promo grant.
  const activeCount = db.prepare(
    "SELECT COUNT(*) AS n FROM entitlements WHERE account_id = ? AND status = 'active'"
  ).get(acc.id).n;
  assert.equal(activeCount, 1);
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

test("grantTrialSubscription activates entitlement for 7 days by default", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id);

  assert.ok(hasActiveEntitlement(db, acc.id));
  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.plan, "trial");
  const daysLeft = (new Date(sub.currentPeriodEnd) - Date.now()) / 86400000;
  assert.ok(daysLeft > 6.9 && daysLeft <= 7, `expected ~7 days left, got ${daysLeft}`);
});

test("grantTrialSubscription accepts a custom trial length", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 14 });

  const sub = getActiveSubscriptionForAccount(db, acc.id);
  const daysLeft = (new Date(sub.currentPeriodEnd) - Date.now()) / 86400000;
  assert.ok(daysLeft > 13.9 && daysLeft <= 14, `expected ~14 days left, got ${daysLeft}`);
});

test("grantTrialSubscription is defensively a no-op if called twice for the same account", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id, { trialDays: 7 });
  grantTrialSubscription(db, acc.id, { trialDays: 30 }); // must not overwrite/extend
  const sub = getActiveSubscriptionForAccount(db, acc.id);
  const daysLeft = (new Date(sub.currentPeriodEnd) - Date.now()) / 86400000;
  assert.ok(daysLeft <= 7.1, `second call must not have granted 30 days, got ${daysLeft}`);
});

test("a pending order does not interrupt an active, non-expired entitlement while checkout is pending", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  grantTrialSubscription(db, acc.id); // active trial, ~7 days left

  createOrder(db, acc.id, {
    provider: "stripe", plan: "annual", orderId: "order-new",
    currency: "EUR", amountMinor: 8990, appliedCode: null,
  });

  // Still entitled — the pending checkout must not have knocked out the trial.
  assert.ok(hasActiveEntitlement(db, acc.id));
  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.status, "active");
  assert.equal(sub.plan, "trial");

  // Confirming the payment now correctly upgrades to the paid period,
  // stacked on top of (not replacing) the trial's remaining time.
  const order = getOrderByExternalId(db, "order-new");
  completeOrder(db, order.id);
  extendEntitlementForOrder(db, order);
  const paid = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(paid.plan, "annual");
  const daysLeft = (new Date(paid.currentPeriodEnd) - Date.now()) / 86400000;
  assert.ok(daysLeft > 366, `expected >366 days left (366-day plan stacked on top of the trial's remaining days), got ${daysLeft}`);
});

test("createOrder still leaves the account unentitled when there was no prior active entitlement", () => {
  const db = makeDb();
  const acc = makeAccount(db);

  createOrder(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-fresh",
    currency: "EUR", amountMinor: 990, appliedCode: null,
  });

  assert.equal(hasActiveEntitlement(db, acc.id), false); // still pending, not yet paid
  assert.equal(getOrderByExternalId(db, "order-fresh").status, "pending");
});

test("a second checkout marks the account's still-pending prior order abandoned", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createOrder(db, acc.id, { provider: "stripe", plan: "monthly", orderId: "order-x", currency: "EUR", amountMinor: 990 });
  createOrder(db, acc.id, { provider: "stripe", plan: "annual", orderId: "order-y", currency: "EUR", amountMinor: 8990 });

  assert.equal(getOrderByExternalId(db, "order-x").status, "abandoned");
  assert.equal(getOrderByExternalId(db, "order-y").status, "pending");
});

test("extendEntitlementForOrder computes the new period from the plan, not any value set at checkout time", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createOrder(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-3",
    currency: "EUR", amountMinor: 990, appliedCode: null,
  });

  const order = getOrderByExternalId(db, "order-3");
  completeOrder(db, order.id);
  extendEntitlementForOrder(db, order);
  const sub = getActiveSubscriptionForAccount(db, acc.id);
  const daysLeft = (new Date(sub.currentPeriodEnd) - Date.now()) / 86400000;
  assert.ok(daysLeft > 30 && daysLeft <= 31, `expected ~31 days left, got ${daysLeft}`);
});
