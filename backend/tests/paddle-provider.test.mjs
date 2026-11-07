import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyPaddleWebhookSignature, parsePaddleWebhookEvent, planForPriceId,
} from "../lib/billing-providers/paddle.mjs";

const SECRET = "pdl_ntfset_test_secret";
const NOW_MS = 1_800_000_000_000;
const TS = String(NOW_MS / 1000);

function sign(body, { ts = TS, secret = SECRET } = {}) {
  return createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
}

test("a correctly signed delivery verifies", () => {
  const body = '{"event_id":"evt_1"}';
  assert.equal(verifyPaddleWebhookSignature(body, `ts=${TS};h1=${sign(body)}`, { secret: SECRET, nowMs: NOW_MS }), true);
});

test("any of several h1 values (secret rotation) is accepted", () => {
  const body = '{"event_id":"evt_2"}';
  const header = `ts=${TS};h1=${"0".repeat(64)};h1=${sign(body)}`;
  assert.equal(verifyPaddleWebhookSignature(body, header, { secret: SECRET, nowMs: NOW_MS }), true);
});

test("a changed body, a wrong secret, a missing header or a missing secret fail", () => {
  const body = '{"event_id":"evt_3"}';
  const header = `ts=${TS};h1=${sign(body)}`;
  assert.equal(verifyPaddleWebhookSignature(body + " ", header, { secret: SECRET, nowMs: NOW_MS }), false);
  assert.equal(verifyPaddleWebhookSignature(body, header, { secret: "other", nowMs: NOW_MS }), false);
  assert.equal(verifyPaddleWebhookSignature(body, "", { secret: SECRET, nowMs: NOW_MS }), false);
  assert.equal(verifyPaddleWebhookSignature(body, header, { secret: "", nowMs: NOW_MS }), false);
});

test("a delivery older than the replay window fails even with a valid signature", () => {
  const body = '{"event_id":"evt_4"}';
  const oldTs = String(NOW_MS / 1000 - 301);
  const header = `ts=${oldTs};h1=${sign(body, { ts: oldTs })}`;
  assert.equal(verifyPaddleWebhookSignature(body, header, { secret: SECRET, nowMs: NOW_MS }), false);
});

const PRICE_IDS = { monthly: "pri_month", half_year: "pri_half", annual: "pri_year" };

test("a subscription event is normalized, plan resolved from the price id", () => {
  const raw = JSON.stringify({
    event_id: "evt_sub", event_type: "subscription.updated", occurred_at: "2026-11-07T10:00:00Z",
    data: {
      id: "sub_1", status: "active", customer_id: "ctm_1",
      items: [{ price: { id: "pri_year" } }],
      current_billing_period: { starts_at: "2026-11-07T10:00:00Z", ends_at: "2027-11-07T10:00:00Z" },
      scheduled_change: { action: "cancel", effective_at: "2027-11-07T10:00:00Z" },
      custom_data: { accountId: "acc_1", orderId: "ord_1" },
      updated_at: "2026-11-07T10:00:01Z",
    },
  });
  const event = parsePaddleWebhookEvent(raw, { priceIds: PRICE_IDS });
  assert.equal(event.kind, "subscription");
  assert.deepEqual(event.subscription, {
    subscriptionId: "sub_1", customerId: "ctm_1", status: "active", plan: "annual",
    periodStart: "2026-11-07T10:00:00Z", periodEnd: "2027-11-07T10:00:00Z",
    scheduledCancelAt: "2027-11-07T10:00:00Z", canceledAt: null, pausedAt: null,
    updatedAt: "2026-11-07T10:00:01Z", accountId: "acc_1",
  });
});

test("transaction and adjustment events are normalized", () => {
  const tx = parsePaddleWebhookEvent(JSON.stringify({
    event_id: "evt_tx", event_type: "transaction.completed",
    data: { id: "txn_1", status: "completed", subscription_id: "sub_1", customer_id: "ctm_1", currency_code: "EUR",
      details: { totals: { grand_total: "990" } }, custom_data: { accountId: "acc_1", orderId: "ord_1" } },
  }));
  assert.equal(tx.kind, "transaction");
  assert.equal(tx.transaction.amountMinor, 990);
  assert.equal(tx.transaction.orderId, "ord_1");

  const adj = parsePaddleWebhookEvent(JSON.stringify({
    event_id: "evt_adj", event_type: "adjustment.created",
    data: { id: "adj_1", action: "refund", status: "approved", type: "full", transaction_id: "txn_1", subscription_id: "sub_1", customer_id: "ctm_1" },
  }));
  assert.equal(adj.kind, "adjustment");
  assert.equal(adj.adjustment.subscriptionId, "sub_1");
});

test("an unknown price id maps to 'unknown', never to a real plan", () => {
  assert.equal(planForPriceId("pri_other", PRICE_IDS), "unknown");
  assert.equal(planForPriceId(null, PRICE_IDS), "unknown");
  assert.equal(planForPriceId("pri_month", PRICE_IDS), "monthly");
});
