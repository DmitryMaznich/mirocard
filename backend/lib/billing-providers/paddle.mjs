import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PADDLE_ENV, PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_PRICE_IDS,
} from "../config.mjs";

// Paddle Billing (merchant of record). Paddle sells the subscription to the
// customer and owns tax, invoices, card updates and cancellation (its
// customer portal); this module only:
//   - verifies and normalizes webhook deliveries,
//   - creates the draft transaction a checkout is opened for,
//   - opens a customer-portal session,
//   - reads a subscription for the daily reconciliation.
// Formats follow Paddle Billing API v1. Field names marked [sandbox] are the
// ones to re-check against a real sandbox delivery before going live.

const API_BASE = PADDLE_ENV === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

// ─── Webhook signature ───────────────────────────────────────────────────────

// Paddle-Signature: "ts=1671552777;h1=eb4d0dc8853be92b7f063b9f3ba5233eb920a09459b6e6b2c26705b4364db151"
// h1 = hex HMAC-SHA256 over `${ts}:${rawBody}` with the notification
// destination's secret. During a secret rotation Paddle may send more than
// one h1 -- any match is accepted. Same 5-minute replay window as Stripe.
const DEFAULT_TOLERANCE_SEC = 300;

export function verifyPaddleWebhookSignature(rawBody, signatureHeader, {
  secret = PADDLE_WEBHOOK_SECRET, toleranceSec = DEFAULT_TOLERANCE_SEC, nowMs = Date.now(),
} = {}) {
  if (!signatureHeader || !secret) return false;
  let ts = null;
  const signatures = [];
  for (const part of String(signatureHeader).split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "ts") ts = value;
    else if (key === "h1" && value) signatures.push(value);
  }
  if (!ts || signatures.length === 0) return false;
  const tsSec = Number(ts);
  if (!Number.isFinite(tsSec) || Math.abs(nowMs / 1000 - tsSec) > toleranceSec) return false;

  const computed = Buffer.from(createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex"), "utf8");
  return signatures.some((sig) => {
    const candidate = Buffer.from(sig, "utf8");
    return candidate.length === computed.length && timingSafeEqual(candidate, computed);
  });
}

// ─── Webhook payload normalization ───────────────────────────────────────────

export function planForPriceId(priceId, priceIds = PADDLE_PRICE_IDS) {
  if (!priceId) return "unknown";
  for (const [plan, id] of Object.entries(priceIds)) {
    if (id && id === priceId) return plan;
  }
  return "unknown";
}

function normalizeSubscription(data, priceIds) {
  const priceId = data.items?.[0]?.price?.id ?? null;
  const scheduled = data.scheduled_change ?? null;
  return {
    subscriptionId: data.id,
    customerId: data.customer_id ?? null,
    status: data.status,
    plan: planForPriceId(priceId, priceIds),
    periodStart: data.current_billing_period?.starts_at ?? null,
    periodEnd: data.current_billing_period?.ends_at ?? null,
    scheduledCancelAt: scheduled?.action === "cancel" ? (scheduled.effective_at ?? null) : null,
    canceledAt: data.canceled_at ?? null,
    pausedAt: data.paused_at ?? null,
    updatedAt: data.updated_at ?? null,
    accountId: data.custom_data?.accountId ?? null,
  };
}

function normalizeTransaction(data) {
  // [sandbox] details.totals.grand_total is a string in the currency's
  // lowest unit ("990").
  const total = data.details?.totals?.grand_total;
  return {
    transactionId: data.id,
    status: data.status,
    subscriptionId: data.subscription_id ?? null,
    customerId: data.customer_id ?? null,
    orderId: data.custom_data?.orderId ?? null,
    accountId: data.custom_data?.accountId ?? null,
    amountMinor: total != null && total !== "" ? Number(total) : null,
    currency: data.currency_code ?? null,
  };
}

function normalizeAdjustment(data) {
  return {
    adjustmentId: data.id,
    action: data.action,          // 'refund' | 'credit' | 'chargeback' | 'chargeback_reverse' | ...
    status: data.status,          // 'pending_approval' | 'approved' | 'rejected' | ...
    type: data.type ?? null,      // 'full' | 'partial'
    transactionId: data.transaction_id ?? null,
    subscriptionId: data.subscription_id ?? null,
    customerId: data.customer_id ?? null,
  };
}

// → { eventId, eventType, occurredAt, kind, subscription?, transaction?, adjustment? }
// kind: 'subscription' | 'transaction' | 'adjustment' | 'other'
export function parsePaddleWebhookEvent(rawBody, { priceIds = PADDLE_PRICE_IDS } = {}) {
  const event = JSON.parse(rawBody);
  const type = String(event.event_type ?? "");
  const data = event.data ?? {};
  const base = { eventId: event.event_id ?? null, eventType: type, occurredAt: event.occurred_at ?? null };
  if (type.startsWith("subscription.")) return { ...base, kind: "subscription", subscription: normalizeSubscription(data, priceIds) };
  if (type.startsWith("transaction.")) return { ...base, kind: "transaction", transaction: normalizeTransaction(data) };
  if (type.startsWith("adjustment.")) return { ...base, kind: "adjustment", adjustment: normalizeAdjustment(data) };
  return { ...base, kind: "other" };
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function paddleRequest(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PADDLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // Raw provider text stays in the server log only (see handleBillingCheckout).
    throw new Error(`Paddle API error ${res.status}: ${errText}`);
  }
  return (await res.json()).data;
}

export function isPaddleConfiguredFor(plan) {
  return Boolean(PADDLE_API_KEY && PADDLE_PRICE_IDS[plan]);
}

// A draft transaction for one plan; the client opens Paddle's overlay
// checkout with its id. accountId/orderId travel in custom_data, which Paddle
// copies onto the subscription it creates -- that is how a webhook finds its
// account. Created server-side so the client can't choose the price or the
// account it pays for.
export async function createPaddleTransaction({ plan, accountId, orderId, discountId = null }) {
  const priceId = PADDLE_PRICE_IDS[plan];
  if (!priceId) throw new Error(`No Paddle price configured for plan ${plan}`);
  const transaction = await paddleRequest("POST", "/transactions", {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: { accountId, orderId },
    ...(discountId ? { discount_id: discountId } : {}),
  });
  return { transactionId: transaction.id };
}

// One-time authenticated link into Paddle's customer portal (card, cancel,
// invoices). Links expire -- create one per click, never cache.
export async function createPaddlePortalSession({ customerId, subscriptionId }) {
  const session = await paddleRequest("POST", `/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    subscription_ids: subscriptionId ? [subscriptionId] : [],
  });
  const forSubscription = session.urls?.subscriptions?.find((s) => s.id === subscriptionId);
  return {
    overviewUrl: session.urls?.general?.overview ?? null,
    cancelUrl: forSubscription?.cancel_subscription ?? null,
    updatePaymentMethodUrl: forSubscription?.update_subscription_payment_method ?? null,
  };
}

export async function getPaddleSubscription(subscriptionId, { priceIds = PADDLE_PRICE_IDS } = {}) {
  const data = await paddleRequest("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return normalizeSubscription(data, priceIds);
}

// Undo a cancellation the customer scheduled in the portal ("Возобновить
// подписку"): removing the scheduled change keeps the subscription renewing.
export async function resumePaddleSubscription(subscriptionId, { priceIds = PADDLE_PRICE_IDS } = {}) {
  const data = await paddleRequest("PATCH", `/subscriptions/${encodeURIComponent(subscriptionId)}`, { scheduled_change: null });
  return normalizeSubscription(data, priceIds);
}

// Account deletion: no further charges. The period already paid for runs
// out on its own (no refund is implied), so cancel at the next billing date.
export async function cancelPaddleSubscriptionAtPeriodEnd(subscriptionId, { priceIds = PADDLE_PRICE_IDS } = {}) {
  const data = await paddleRequest("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { effective_from: "next_billing_period" });
  return normalizeSubscription(data, priceIds);
}
