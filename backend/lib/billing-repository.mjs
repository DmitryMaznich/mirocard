import { randomUUID } from "node:crypto";

function now() { return new Date().toISOString(); }

function safeJson(value, fallback) {
  try { return JSON.parse(value ?? "null") ?? fallback; }
  catch { return fallback; }
}

export function createPendingSubscription(db, accountId, {
  provider, plan, orderId, currency, amountMinor, periodDays, appliedCode = null,
}) {
  const ts = now();
  const currentPeriodEnd = new Date(Date.now() + periodDays * 86400000).toISOString();
  db.prepare(`
    INSERT INTO subscriptions
      (id, account_id, provider, plan, status, currency, amount_minor, external_contract_id, applied_code, current_period_end, cancel_at_period_end, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      provider = excluded.provider,
      plan = excluded.plan,
      status = 'pending',
      currency = excluded.currency,
      amount_minor = excluded.amount_minor,
      external_contract_id = excluded.external_contract_id,
      applied_code = excluded.applied_code,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `).run(randomUUID(), accountId, provider, plan, currency, amountMinor, orderId, appliedCode, currentPeriodEnd, ts, ts);
}

export function getSubscriptionByOrderId(db, orderId) {
  return db.prepare("SELECT * FROM subscriptions WHERE external_contract_id = ?").get(orderId) ?? null;
}

export function activateSubscriptionByOrderId(db, orderId) {
  const row = getSubscriptionByOrderId(db, orderId);
  if (!row) return null;
  db.prepare("UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?").run(now(), row.id);
  return row.account_id;
}

export function markSubscriptionRefundedByOrderId(db, orderId) {
  const row = getSubscriptionByOrderId(db, orderId);
  if (!row) return null;
  db.prepare("UPDATE subscriptions SET status = 'refunded', updated_at = ? WHERE id = ?").run(now(), row.id);
  return row.account_id;
}

export function getActiveSubscriptionForAccount(db, accountId) {
  const row = db.prepare("SELECT * FROM subscriptions WHERE account_id = ?").get(accountId);
  if (!row || row.status !== "active") return null;
  return {
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

// Returns true if this is the first time this exact provider event has been
// seen (caller should act on it), false if it's a duplicate delivery.
export function recordPaymentEvent(db, { accountId, provider, eventType, externalId, payloadJson }) {
  try {
    db.prepare(`
      INSERT INTO payment_events (id, account_id, provider, event_type, external_id, payload_json, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), accountId, provider, eventType, externalId, payloadJson, now());
    return true;
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err.message)) return false;
    throw err;
  }
}

export function hasActiveEntitlement(db, accountId) {
  const account = db.prepare("SELECT feature_flags FROM accounts WHERE id = ?").get(accountId);
  if (!account) return false;
  const flags = safeJson(account.feature_flags, []);
  if (flags.includes("all_access")) return true;

  const sub = db.prepare("SELECT status, current_period_end FROM subscriptions WHERE account_id = ?").get(accountId);
  return Boolean(sub && sub.status === "active" && sub.current_period_end > now());
}

export function createPromoCode(db, {
  code, kind, value = null, currency = null, appliesToPlan = null,
  grantDurationDays = null, maxRedemptions = null, expiresAt = null,
  note = null, createdBy = null,
}) {
  db.prepare(`
    INSERT INTO promo_codes
      (code, kind, value, currency, applies_to_plan, grant_duration_days, max_redemptions, redeemed_count, expires_at, note, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(code.trim().toUpperCase(), kind, value, currency, appliesToPlan, grantDurationDays, maxRedemptions, expiresAt, note, now(), createdBy);
}

export function listPromoCodes(db) {
  return db.prepare("SELECT * FROM promo_codes ORDER BY created_at DESC").all().map((row) => ({
    code: row.code,
    kind: row.kind,
    value: row.value,
    currency: row.currency,
    appliesToPlan: row.applies_to_plan,
    grantDurationDays: row.grant_duration_days,
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    expiresAt: row.expires_at,
    note: row.note,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export function validatePromoCode(db, rawCode, { accountId, plan }) {
  const code = String(rawCode ?? "").trim().toUpperCase();
  if (!code) return { ok: false, reason: "not_found" };

  const row = db.prepare("SELECT * FROM promo_codes WHERE code = ?").get(code);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expires_at && row.expires_at < now()) return { ok: false, reason: "expired" };
  if (row.max_redemptions != null && row.redeemed_count >= row.max_redemptions) return { ok: false, reason: "exhausted" };
  if (row.applies_to_plan && plan && row.applies_to_plan !== plan) return { ok: false, reason: "wrong_plan" };

  const already = db.prepare(
    "SELECT 1 FROM promo_redemptions WHERE code = ? AND account_id = ?"
  ).get(code, accountId);
  if (already) return { ok: false, reason: "already_used" };

  return {
    ok: true,
    code,
    kind: row.kind,
    value: row.value,
    currency: row.currency,
    grantDurationDays: row.grant_duration_days,
  };
}

function recordRedemption(db, code, accountId) {
  db.prepare(
    "INSERT INTO promo_redemptions (id, code, account_id, redeemed_at) VALUES (?, ?, ?, ?)"
  ).run(randomUUID(), code, accountId, now());
  db.prepare("UPDATE promo_codes SET redeemed_count = redeemed_count + 1 WHERE code = ?").run(code);
}

export function redeemFreeGrantCode(db, rawCode, accountId) {
  const validation = validatePromoCode(db, rawCode, { accountId, plan: null });
  if (!validation.ok) return validation;
  if (validation.kind !== "free_grant") return { ok: false, reason: "not_free_grant" };

  const ts = now();
  const currentPeriodEnd = validation.grantDurationDays
    ? new Date(Date.now() + validation.grantDurationDays * 86400000).toISOString()
    : "9999-12-31T00:00:00.000Z"; // no expiry

  db.prepare(`
    INSERT INTO subscriptions
      (id, account_id, provider, plan, status, currency, amount_minor, external_contract_id, applied_code, current_period_end, cancel_at_period_end, created_at, updated_at)
    VALUES (?, ?, 'promo', 'free_grant', 'active', 'EUR', 0, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      provider = 'promo', plan = 'free_grant', status = 'active',
      applied_code = excluded.applied_code,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `).run(randomUUID(), accountId, `promo:${validation.code}:${accountId}`, validation.code, currentPeriodEnd, ts, ts);

  recordRedemption(db, validation.code, accountId);
  return { ok: true };
}

export function finalizeDiscountRedemption(db, code, accountId) {
  if (!code) return;
  const already = db.prepare(
    "SELECT 1 FROM promo_redemptions WHERE code = ? AND account_id = ?"
  ).get(code, accountId);
  if (already) return;
  recordRedemption(db, code, accountId);
}
