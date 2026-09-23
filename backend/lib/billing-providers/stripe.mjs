import { createHmac, timingSafeEqual } from "node:crypto";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APP_BASE_URL } from "../config.mjs";

// Stripe's REST API takes application/x-www-form-urlencoded, with
// bracket-notation for nested objects/arrays (e.g. metadata[accountId]=...,
// line_items[0][price_data][currency]=...).
function toFormBody(obj, prefix = "") {
  const parts = [];
  for (const [key, value] of Object.entries(obj)) {
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") parts.push(toFormBody(item, `${paramKey}[${i}]`));
        else parts.push(`${encodeURIComponent(`${paramKey}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (value && typeof value === "object") {
      parts.push(toFormBody(value, paramKey));
    } else if (value !== undefined && value !== null) {
      parts.push(`${encodeURIComponent(paramKey)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join("&");
}

export async function createCheckoutSession({ orderId, planLabel, amountMinor, currency, accountEmail, accountId }) {
  const body = toFormBody({
    mode: "payment",
    success_url: `${APP_BASE_URL}/?checkout=success&order=${orderId}`,
    cancel_url: `${APP_BASE_URL}/?checkout=cancelled&order=${orderId}`,
    customer_email: accountEmail,
    client_reference_id: orderId,
    metadata: { accountId, orderId },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: amountMinor,
        product_data: { name: planLabel },
      },
    }],
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Stripe API error ${res.status}: ${errText}`);
  }
  const session = await res.json();
  return { checkoutUrl: session.url, externalId: session.id };
}

// toleranceSec matches Stripe's own SDK default (5 minutes) -- without it,
// a signature computed over a captured/replayed old payload would verify
// forever, since t is only ever used as HMAC input here, never checked
// against the current time.
const DEFAULT_TOLERANCE_SEC = 300;

export function verifyStripeWebhookSignature(rawBody, signatureHeader, { toleranceSec = DEFAULT_TOLERANCE_SEC, nowMs = Date.now() } = {}) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((kv) => kv.split("=")));
  const { t: timestamp, v1: expectedSig } = parts;
  if (!timestamp || !expectedSig) return false;

  const timestampSec = Number(timestamp);
  if (!Number.isFinite(timestampSec)) return false;
  if (Math.abs(nowMs / 1000 - timestampSec) > toleranceSec) return false;

  const computed = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseStripeWebhookEvent(rawBody) {
  const event = JSON.parse(rawBody);
  const obj = event.data?.object ?? {};
  return {
    eventType: event.type,
    externalId: event.id,
    orderId: obj.metadata?.orderId ?? obj.client_reference_id ?? null,
    amountMinor: obj.amount_total ?? obj.amount_subtotal ?? null,
    currency: obj.currency ? obj.currency.toUpperCase() : null,
  };
}
