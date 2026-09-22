import { randomUUID } from "node:crypto";
import { PLAN_CATALOG } from "./billing-plans.mjs";

function now() { return new Date().toISOString(); }

function safeJson(value, fallback) {
  try { return JSON.parse(value ?? "null") ?? fallback; }
  catch { return fallback; }
}

// ─── Orders (one row per checkout attempt, full history) ───────────────────

// Every call starts a brand-new order row -- never overwrites or reuses a
// prior one, so a second checkout attempt (retry, plan change, abandoned
// first attempt) never loses the first attempt's audit trail. Any of the
// account's own still-"pending" orders are marked "abandoned" first, purely
// for tidiness (so "pending" always means "the most recent unconfirmed
// attempt"); this never touches entitlements, so it can never take away
// access the account already has.
export function createOrder(db, accountId, { provider, plan, orderId, currency, amountMinor, appliedCode = null }) {
  const ts = now();
  db.prepare(
    "UPDATE orders SET status = 'abandoned', updated_at = ? WHERE account_id = ? AND status = 'pending'"
  ).run(ts, accountId);
  db.prepare(`
    INSERT INTO orders
      (id, account_id, provider, plan, status, currency, amount_minor, external_contract_id, applied_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), accountId, provider, plan, currency, amountMinor, orderId, appliedCode, ts, ts);
}

export function getOrderByExternalId(db, orderId) {
  return db.prepare("SELECT * FROM orders WHERE external_contract_id = ?").get(orderId) ?? null;
}

export function completeOrder(db, orderId) {
  db.prepare("UPDATE orders SET status = 'completed', updated_at = ? WHERE id = ?").run(now(), orderId);
}

export function markOrderRefunded(db, orderId, eventType) {
  const status = eventType === "chargeback.initiated" ? "chargeback" : "refunded";
  db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), orderId);
}

// ─── Entitlements (the actual access grant) ────────────────────────────────

function activeEntitlementRow(db, accountId) {
  return db.prepare(
    "SELECT * FROM entitlements WHERE account_id = ? AND status = 'active' AND ends_at > ? ORDER BY ends_at DESC LIMIT 1"
  ).get(accountId, now());
}

// A confirmed order extends the account's access -- starting from
// max(now, the current active entitlement's ends_at), never from `now`
// alone. Reusing `now` for a renewal would silently discard whatever paid
// time the account already had left; always inserting a NEW row (rather
// than updating an existing one in place) keeps every grant individually
// visible for audit, with "current access" simply being whichever active
// row has the furthest ends_at.
export function extendEntitlementForOrder(db, order) {
  const periodDays = PLAN_CATALOG[order.plan]?.periodDays;
  if (!periodDays) {
    console.error(`[billing] extendEntitlementForOrder: unknown plan "${order.plan}" for order ${order.id}`);
    return null;
  }
  const current = activeEntitlementRow(db, order.account_id);
  const baseMs = current ? Math.max(Date.now(), new Date(current.ends_at).getTime()) : Date.now();
  const startsAt = new Date(baseMs).toISOString();
  const endsAt = new Date(baseMs + periodDays * 86400000).toISOString();
  const ts = now();
  db.prepare(`
    INSERT INTO entitlements
      (id, account_id, source, source_id, plan, status, starts_at, ends_at, cancel_at_period_end, created_at, updated_at)
    VALUES (?, ?, 'order', ?, ?, 'active', ?, ?, 0, ?, ?)
  `).run(randomUUID(), order.account_id, order.id, order.plan, startsAt, endsAt, ts, ts);
  return endsAt;
}

// Refunding/charging back one order revokes only the entitlement grant
// *that order* created -- not any other overlapping grant (e.g. a trial,
// or a later order bought while this one was still active). If that leaves
// no other active entitlement, access correctly ends; if the account still
// has one from elsewhere, they keep access, which is the correct outcome.
export function revokeEntitlementsForOrder(db, orderId) {
  db.prepare(
    "UPDATE entitlements SET status = 'revoked', updated_at = ? WHERE source = 'order' AND source_id = ? AND status = 'active'"
  ).run(now(), orderId);
}

// Called once at registration — gives every new account a no-promo-code-
// needed trial. The existence check (rather than a UNIQUE constraint, now
// that an account can hold many entitlement rows over its lifetime) is
// defensive only: registration should never call this twice for the same
// account.
export function grantTrialSubscription(db, accountId, { trialDays = 7 } = {}) {
  const already = db.prepare("SELECT 1 FROM entitlements WHERE account_id = ? AND source = 'trial'").get(accountId);
  if (already) return;
  const ts = now();
  const endsAt = new Date(Date.now() + trialDays * 86400000).toISOString();
  db.prepare(`
    INSERT INTO entitlements
      (id, account_id, source, source_id, plan, status, starts_at, ends_at, cancel_at_period_end, created_at, updated_at)
    VALUES (?, ?, 'trial', NULL, 'trial', 'active', ?, ?, 0, ?, ?)
  `).run(randomUUID(), accountId, ts, endsAt, ts, ts);
}

export function hasActiveEntitlement(db, accountId) {
  const account = db.prepare("SELECT feature_flags FROM accounts WHERE id = ?").get(accountId);
  if (!account) return false;
  const flags = safeJson(account.feature_flags, []);
  if (flags.includes("all_access")) return true;
  return Boolean(activeEntitlementRow(db, accountId));
}

export function getActiveSubscriptionForAccount(db, accountId) {
  const row = activeEntitlementRow(db, accountId);
  if (row) {
    return {
      plan: row.plan,
      status: row.status,
      currentPeriodEnd: row.ends_at,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    };
  }
  // Grandfathered all_access accounts hold no entitlements row during
  // normal operation (the feature flag alone is authoritative for
  // hasActiveEntitlement) -- surfaced here too so the UI doesn't tell a
  // grandfathered account "no active plan".
  const account = db.prepare("SELECT feature_flags FROM accounts WHERE id = ?").get(accountId);
  const flags = safeJson(account?.feature_flags, []);
  if (flags.includes("all_access")) {
    return { plan: "all_access", status: "active", currentPeriodEnd: "9999-12-31T00:00:00.000Z", cancelAtPeriodEnd: false };
  }
  return null;
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

// ─── Checkout consent (see LEGAL_DOCS_VERSION in lib/config.mjs) ──────────

export function recordCheckoutConsent(db, { accountId, orderId, legalDocsVersion, termsAccepted, pricePeriodConfirmed, digitalContentAck }) {
  db.prepare(`
    INSERT INTO checkout_consents
      (id, account_id, order_id, legal_docs_version, terms_accepted, price_period_confirmed, digital_content_ack, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), accountId, orderId, legalDocsVersion,
    termsAccepted ? 1 : 0, pricePeriodConfirmed ? 1 : 0, digitalContentAck ? 1 : 0, now(),
  );
}

// ─── Promo codes ─────────────────────────────────────────────────────────

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

// A free-grant promo code (e.g. the Instagram INSTAGRAM31 campaign)
// deliberately REPLACES whatever entitlement period is currently running
// (trial, or a still-active prior order) rather than stacking on top of
// it -- redeeming a 31-day code mid-trial jumps straight to a fresh 31-day
// period starting today; it does not add 31 days on top of the trial's
// remaining time. This is a deliberate product decision for the Instagram
// launch (see docs/commercial-launch-runbook.md), not an artifact of the
// schema.
export function redeemFreeGrantCode(db, rawCode, accountId) {
  const validation = validatePromoCode(db, rawCode, { accountId, plan: null });
  if (!validation.ok) return validation;
  if (validation.kind !== "free_grant") return { ok: false, reason: "not_free_grant" };

  const ts = now();
  const endsAt = validation.grantDurationDays
    ? new Date(Date.now() + validation.grantDurationDays * 86400000).toISOString()
    : "9999-12-31T00:00:00.000Z"; // no expiry

  db.prepare(
    "UPDATE entitlements SET status = 'revoked', updated_at = ? WHERE account_id = ? AND status = 'active'"
  ).run(ts, accountId);

  db.prepare(`
    INSERT INTO entitlements
      (id, account_id, source, source_id, plan, status, starts_at, ends_at, cancel_at_period_end, created_at, updated_at)
    VALUES (?, ?, 'promo', ?, 'free_grant', 'active', ?, ?, 0, ?, ?)
  `).run(randomUUID(), accountId, validation.code, ts, endsAt, ts, ts);

  recordRedemption(db, validation.code, accountId);
  return { ok: true };
}

// ─── Expiry reminders (scripts/entitlement-reminder-loop.mjs) ──────────────

const REMINDER_KINDS = ["days5", "days1", "expired"];

// Only an account's CURRENT entitlement (the active row with the furthest
// ends_at -- same selection rule as hasActiveEntitlement/
// getActiveSubscriptionForAccount) is reminder-worthy. An earlier active
// row that a later one has stacked on top of (e.g. a trial an order later
// extended past) is NOT "ending" from the account's point of view even
// though ITS OWN ends_at has passed or is approaching -- reminding about
// it would be a false "your access is ending" email while access
// actually continues uninterrupted.
export function findEntitlementsNeedingReminders(db, { at = now() } = {}) {
  const days5Cutoff = new Date(new Date(at).getTime() + 5 * 86400000).toISOString();
  const days1Cutoff = new Date(new Date(at).getTime() + 1 * 86400000).toISOString();

  const currentActiveRows = db.prepare(`
    SELECT e.* FROM entitlements e
    INNER JOIN (
      SELECT account_id, MAX(ends_at) AS max_ends_at
      FROM entitlements
      WHERE status = 'active'
      GROUP BY account_id
    ) latest ON latest.account_id = e.account_id AND latest.max_ends_at = e.ends_at
    WHERE e.status = 'active'
  `).all();

  const due = [];
  for (const row of currentActiveRows) {
    const account = db.prepare("SELECT email FROM accounts WHERE id = ?").get(row.account_id);
    if (!account) continue;
    if (row.ends_at < at) {
      if (!row.reminder_expired_sent_at) due.push({ kind: "expired", entitlement: row, email: account.email });
      continue; // already past -- days5/days1 no longer meaningful
    }
    if (row.ends_at <= days1Cutoff && !row.reminder_1d_sent_at) {
      due.push({ kind: "days1", entitlement: row, email: account.email });
    } else if (row.ends_at <= days5Cutoff && !row.reminder_5d_sent_at) {
      due.push({ kind: "days5", entitlement: row, email: account.email });
    }
  }
  return due;
}

export function markReminderSent(db, entitlementId, kind) {
  if (!REMINDER_KINDS.includes(kind)) throw new Error(`Unknown reminder kind: ${kind}`);
  const column = { days5: "reminder_5d_sent_at", days1: "reminder_1d_sent_at", expired: "reminder_expired_sent_at" }[kind];
  db.prepare(`UPDATE entitlements SET ${column} = ? WHERE id = ?`).run(now(), entitlementId);
}

// For a discount (percent_off/fixed_off) code, redemption is only finalized
// once the provider webhook confirms payment (called from
// billing-orchestrator.mjs) -- never at checkout time -- so an abandoned
// €-checkout can't burn a limited-use code's redemption count for nothing.
export function finalizeDiscountRedemption(db, code, accountId) {
  if (!code) return;
  const already = db.prepare(
    "SELECT 1 FROM promo_redemptions WHERE code = ? AND account_id = ?"
  ).get(code, accountId);
  if (already) return;
  recordRedemption(db, code, accountId);
}
