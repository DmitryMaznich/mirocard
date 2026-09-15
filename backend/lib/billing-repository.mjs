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
