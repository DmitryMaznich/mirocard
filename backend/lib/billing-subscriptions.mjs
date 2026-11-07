import { randomUUID } from "node:crypto";
import { withTransaction } from "./db.mjs";
import { incrementRevision } from "./account-repository.mjs";
import { recordPaymentEvent, getOrderByExternalId, completeOrder } from "./billing-repository.mjs";

// Recurring subscriptions at a payment provider (Paddle). The provider is the
// source of truth; webhooks keep `provider_subscriptions` in step, and every
// change is mirrored onto ONE entitlement row per subscription
// (source = 'subscription', source_id = provider_subscription_id) -- the same
// table every access check already reads, so trial / promo / all_access /
// subscription all keep working through hasActiveEntitlement.

// After a failed renewal Paddle retries for a while; access stays open this
// long from the start of the unpaid period (docs/monetization-eu-plan.md §3).
export const PAST_DUE_GRACE_DAYS = 7;

const DAY_MS = 86400000;

function nowIso() { return new Date().toISOString(); }

function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

// When access ends for a subscription in this state.
export function accessEndFor(sub, { at = nowIso() } = {}) {
  switch (sub.status) {
    case "active":
    case "trialing":
      return { accessEnd: sub.periodEnd ?? at, graceUntil: null };
    case "past_due": {
      const graceUntil = addDays(sub.periodStart ?? at, PAST_DUE_GRACE_DAYS);
      return { accessEnd: graceUntil, graceUntil };
    }
    default: // 'paused' | 'canceled' | anything unknown: no further access
      return { accessEnd: sub.canceledAt ?? sub.pausedAt ?? at, graceUntil: null };
  }
}

export function getProviderSubscription(db, providerSubscriptionId) {
  return db.prepare("SELECT * FROM provider_subscriptions WHERE provider_subscription_id = ?").get(providerSubscriptionId) ?? null;
}

// The account's most recently updated provider subscription, if any.
export function getLatestProviderSubscriptionForAccount(db, accountId) {
  return db.prepare(
    "SELECT * FROM provider_subscriptions WHERE account_id = ? ORDER BY updated_at DESC LIMIT 1"
  ).get(accountId) ?? null;
}

function accountExists(db, accountId) {
  return Boolean(accountId && db.prepare("SELECT 1 FROM accounts WHERE id = ?").get(accountId));
}

// custom_data.accountId first (set by our checkout), then what we already
// know about this subscription or customer.
export function resolveAccountId(db, { accountId, subscriptionId, customerId }) {
  if (accountExists(db, accountId)) return accountId;
  if (subscriptionId) {
    const row = getProviderSubscription(db, subscriptionId);
    if (row) return row.account_id;
  }
  if (customerId) {
    const row = db.prepare(
      "SELECT account_id FROM provider_subscriptions WHERE provider_customer_id = ? ORDER BY updated_at DESC LIMIT 1"
    ).get(customerId);
    if (row) return row.account_id;
  }
  return null;
}

// Writes the subscription's state and its entitlement. Returns false (and
// changes nothing) when `sub` is older than what is stored -- a webhook that
// arrived out of order.
export function applySubscriptionState(db, accountId, sub, { provider = "paddle", at = nowIso() } = {}) {
  const existing = getProviderSubscription(db, sub.subscriptionId);
  if (existing?.provider_updated_at && sub.updatedAt && sub.updatedAt < existing.provider_updated_at) return false;

  const { accessEnd, graceUntil } = accessEndFor(sub, { at });
  const plan = sub.plan && sub.plan !== "unknown" ? sub.plan : (existing?.plan ?? "unknown");

  if (existing) {
    db.prepare(`
      UPDATE provider_subscriptions SET
        account_id = ?, provider_customer_id = COALESCE(?, provider_customer_id), plan = ?, status = ?,
        current_period_start = ?, current_period_end = ?, scheduled_cancel_at = ?, grace_until = ?,
        provider_updated_at = COALESCE(?, provider_updated_at), updated_at = ?
      WHERE id = ?
    `).run(accountId, sub.customerId, plan, sub.status, sub.periodStart, sub.periodEnd,
      sub.scheduledCancelAt, graceUntil, sub.updatedAt, at, existing.id);
  } else {
    db.prepare(`
      INSERT INTO provider_subscriptions
        (id, account_id, provider, provider_subscription_id, provider_customer_id, plan, status,
         current_period_start, current_period_end, scheduled_cancel_at, grace_until, provider_updated_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), accountId, provider, sub.subscriptionId, sub.customerId, plan, sub.status,
      sub.periodStart, sub.periodEnd, sub.scheduledCancelAt, graceUntil, sub.updatedAt, at, at);
  }

  upsertSubscriptionEntitlement(db, accountId, {
    subscriptionId: sub.subscriptionId, plan, startsAt: sub.periodStart ?? at, endsAt: accessEnd,
    // A subscription that will renew is not "ending" -- the expiry reminders
    // only go to one whose cancellation is scheduled (or that has ended).
    cancelAtPeriodEnd: Boolean(sub.scheduledCancelAt) || !["active", "trialing", "past_due"].includes(sub.status),
    at,
  });
  return true;
}

function upsertSubscriptionEntitlement(db, accountId, { subscriptionId, plan, startsAt, endsAt, cancelAtPeriodEnd, at }) {
  const status = endsAt > at ? "active" : "expired";
  const row = db.prepare("SELECT * FROM entitlements WHERE source = 'subscription' AND source_id = ?").get(subscriptionId);
  if (!row) {
    db.prepare(`
      INSERT INTO entitlements
        (id, account_id, source, source_id, plan, status, starts_at, ends_at, cancel_at_period_end, created_at, updated_at)
      VALUES (?, ?, 'subscription', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), accountId, subscriptionId, plan, status, startsAt, endsAt, cancelAtPeriodEnd ? 1 : 0, at, at);
    return;
  }
  if (row.status === "revoked") return; // a refund/chargeback revoked it; a later state event must not resurrect it
  // A renewal moves ends_at forward: the reminders of the previous period
  // must be able to fire again for the new one.
  const renewed = endsAt > row.ends_at;
  db.prepare(`
    UPDATE entitlements SET plan = ?, status = ?, starts_at = ?, ends_at = ?, cancel_at_period_end = ?, updated_at = ?
      ${renewed ? ", reminder_5d_sent_at = NULL, reminder_1d_sent_at = NULL, reminder_expired_sent_at = NULL" : ""}
    WHERE id = ?
  `).run(plan, status, startsAt, endsAt, cancelAtPeriodEnd ? 1 : 0, at, row.id);
}

function revokeSubscriptionEntitlement(db, subscriptionId, at) {
  db.prepare(
    "UPDATE entitlements SET status = 'revoked', ends_at = ?, updated_at = ? WHERE source = 'subscription' AND source_id = ? AND status <> 'revoked'"
  ).run(at, at, subscriptionId);
}

// Processes one normalized Paddle webhook (billing-providers/paddle.mjs →
// parsePaddleWebhookEvent). Same contract as processBillingEvent: never throws
// for a delivery that doesn't apply, returns { ok, reason? | kind? }; the HTTP
// handler answers 200 regardless.
//   kind 'completed' -- this delivery completed our checkout order (send the
//                       purchase confirmation once)
export function processPaddleEvent(db, event, { rawBody = "{}", at = nowIso() } = {}) {
  if (!event?.eventId) return { ok: false, reason: "no_event_id" };
  const ref = event.subscription ?? event.transaction ?? event.adjustment ?? {};
  const accountId = resolveAccountId(db, {
    accountId: ref.accountId, subscriptionId: ref.subscriptionId, customerId: ref.customerId,
  });
  if (!accountId) return { ok: false, reason: "unknown_account" };

  return withTransaction(db, () => {
    const isNew = recordPaymentEvent(db, {
      accountId, provider: "paddle", eventType: event.eventType, externalId: event.eventId, payloadJson: rawBody,
    });
    if (!isNew) return { ok: true, duplicate: true };
    if (db.prepare("SELECT status FROM accounts WHERE id = ?").get(accountId)?.status === "purged") {
      return { ok: true, reason: "account_purged" };
    }

    if (event.kind === "subscription") {
      const applied = applySubscriptionState(db, accountId, event.subscription, { at });
      if (!applied) return { ok: true, reason: "stale_event" };
      incrementRevision(db, accountId);
      return { ok: true, kind: "subscription_updated", accountId, status: event.subscription.status };
    }

    if (event.kind === "transaction") {
      const tx = event.transaction;
      if (event.eventType !== "transaction.completed") return { ok: true, reason: "ignored_event_type" };
      const order = tx.orderId ? getOrderByExternalId(db, tx.orderId) : null;
      // Renewals carry the subscription's custom_data (the first order's id)
      // too; only the first, still-pending order is "completed" here. Access
      // itself comes from the subscription events, not from this.
      if (!order || order.provider !== "paddle" || order.account_id !== accountId) return { ok: true, reason: "no_pending_order" };
      if (order.status !== "pending") return { ok: true, reason: "order_not_pending" };
      completeOrder(db, order.id);
      incrementRevision(db, accountId);
      return { ok: true, kind: "completed", orderId: order.id, accountId };
    }

    if (event.kind === "adjustment") {
      const adj = event.adjustment;
      const takesAccessAway = adj.status === "approved"
        && (adj.action === "chargeback" || (adj.action === "refund" && adj.type === "full"));
      if (!takesAccessAway || !adj.subscriptionId) return { ok: true, reason: "adjustment_keeps_access" };
      revokeSubscriptionEntitlement(db, adj.subscriptionId, at);
      incrementRevision(db, accountId);
      return { ok: true, kind: "revoked", accountId };
    }

    return { ok: true, reason: "ignored_event_type" };
  });
}

// What the subscription screen needs beyond "is there access until X".
export function getProviderSubscriptionSummary(db, accountId) {
  const row = getLatestProviderSubscriptionForAccount(db, accountId);
  if (!row) return null;
  return {
    provider: row.provider,
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    scheduledCancelAt: row.scheduled_cancel_at,
    graceUntil: row.grace_until,
    renews: ["active", "trialing", "past_due"].includes(row.status) && !row.scheduled_cancel_at,
  };
}

// Daily safety net against a lost webhook: re-read every live subscription
// from the provider and apply it. fetchSubscription(id) → normalized sub.
export async function reconcileProviderSubscriptions(db, fetchSubscription, { at = nowIso() } = {}) {
  const rows = db.prepare("SELECT * FROM provider_subscriptions WHERE status <> 'canceled'").all();
  let changed = 0;
  for (const row of rows) {
    try {
      const sub = await fetchSubscription(row.provider_subscription_id);
      if (!sub) continue;
      const applied = withTransaction(db, () => applySubscriptionState(db, row.account_id, sub, { provider: row.provider, at }));
      if (applied) changed += 1;
    } catch (err) {
      console.error(`[billing] reconcile failed for subscription ${row.provider_subscription_id}:`, err.message);
    }
  }
  return changed;
}
