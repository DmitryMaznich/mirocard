import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// STRIPE_WEBHOOK_SECRET/LAVA_TOP_WEBHOOK_SECRET must be set before importing
// these modules, since config.mjs reads process.env at import time.
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.LAVA_TOP_API_KEY = "lava_test_key";
process.env.LAVA_TOP_WEBHOOK_SECRET = "lava_test_webhook_secret";

const { createCheckoutSession, verifyStripeWebhookSignature, parseStripeWebhookEvent } =
  await import("../lib/billing-providers/stripe.mjs");
const { createInvoice, verifyLavaTopWebhookAuth, parseLavaTopWebhookEvent } =
  await import("../lib/billing-providers/lava-top.mjs");

function withStubbedFetch(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return fn().finally(() => { globalThis.fetch = original; });
}

test("createCheckoutSession posts to Stripe and returns the hosted URL", async () => {
  let capturedUrl, capturedInit;
  await withStubbedFetch(async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return {
      ok: true,
      json: async () => ({ id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" }),
    };
  }, async () => {
    const result = await createCheckoutSession({
      orderId: "order-1", planLabel: "Год", amountMinor: 8990, currency: "EUR",
      accountEmail: "buyer@example.com", accountId: "acc-1",
    });
    assert.equal(result.checkoutUrl, "https://checkout.stripe.com/pay/cs_test_abc");
    assert.equal(result.externalId, "cs_test_abc");
  });

  assert.equal(capturedUrl, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(capturedInit.headers.Authorization, "Bearer sk_test_123");
  assert.match(capturedInit.body, /client_reference_id=order-1/);
  assert.match(capturedInit.body, /metadata%5BaccountId%5D=acc-1/); // metadata[accountId]=acc-1, URL-encoded
});

test("createCheckoutSession throws with Stripe's error body on a non-ok response", async () => {
  await withStubbedFetch(async () => ({ ok: false, status: 402, text: async () => "card declined" }), async () => {
    await assert.rejects(
      () => createCheckoutSession({
        orderId: "o", planLabel: "Месяц", amountMinor: 990, currency: "EUR",
        accountEmail: "a@b.com", accountId: "acc-1",
      }),
      /Stripe API error 402: card declined/
    );
  });
});

test("verifyStripeWebhookSignature accepts a correctly-signed payload", () => {
  const rawBody = '{"id":"evt_1"}';
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawBody}`;
  const signature = createHmac("sha256", "whsec_test_secret").update(signedPayload).digest("hex");
  assert.ok(verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`));
});

test("verifyStripeWebhookSignature rejects a tampered payload", () => {
  const rawBody = '{"id":"evt_1"}';
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", "whsec_test_secret").update(`${timestamp}.{"id":"evt_2"}`).digest("hex");
  assert.equal(verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`), false);
});

test("verifyStripeWebhookSignature rejects a missing header", () => {
  assert.equal(verifyStripeWebhookSignature("{}", undefined), false);
});

test("parseStripeWebhookEvent extracts orderId and amount from a checkout.session.completed event", () => {
  const rawBody = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: {
      id: "cs_test_abc",
      client_reference_id: "order-1",
      amount_total: 8990,
      currency: "eur",
      metadata: { accountId: "acc-1", orderId: "order-1" },
    } },
  });
  const event = parseStripeWebhookEvent(rawBody);
  assert.equal(event.eventType, "checkout.session.completed");
  assert.equal(event.externalId, "evt_1");
  assert.equal(event.orderId, "order-1");
  assert.equal(event.amountMinor, 8990);
  assert.equal(event.currency, "EUR");
});

test("createInvoice posts to Lava Top's invoice endpoint and returns the hosted URL", async () => {
  let capturedUrl, capturedInit;
  await withStubbedFetch(async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return { ok: true, json: async () => ({ id: "contract_1", paymentUrl: "https://pay.lava.top/contract_1" }) };
  }, async () => {
    const result = await createInvoice({ orderId: "order-2", amountMinor: 8990, currency: "EUR", accountEmail: "buyer@example.com" });
    assert.equal(result.checkoutUrl, "https://pay.lava.top/contract_1");
    assert.equal(result.externalId, "contract_1");
  });

  assert.equal(capturedUrl, "https://gate.lava.top/api/v3/invoice");
  assert.equal(capturedInit.headers["X-Api-Key"], "lava_test_key");
  const sentBody = JSON.parse(capturedInit.body);
  assert.equal(sentBody.email, "buyer@example.com");
  assert.equal(sentBody.amount, 89.9); // amountMinor/100
  assert.equal(sentBody.clientUtm.orderId, "order-2");
});

test("createInvoice throws with Lava Top's error body on a non-ok response", async () => {
  await withStubbedFetch(async () => ({ ok: false, status: 400, text: async () => "bad request" }), async () => {
    await assert.rejects(
      () => createInvoice({ orderId: "o", amountMinor: 990, currency: "EUR", accountEmail: "a@b.com" }),
      /Lava Top API error 400: bad request/
    );
  });
});

test("verifyLavaTopWebhookAuth accepts the configured shared secret", () => {
  assert.ok(verifyLavaTopWebhookAuth("lava_test_webhook_secret"));
});

test("verifyLavaTopWebhookAuth rejects a wrong or missing secret", () => {
  assert.equal(verifyLavaTopWebhookAuth("wrong"), false);
  assert.equal(verifyLavaTopWebhookAuth(undefined), false);
});

test("parseLavaTopWebhookEvent extracts orderId and amount from a payment.success event", () => {
  const rawBody = JSON.stringify({
    eventType: "payment.success",
    contractId: "contract_1",
    amount: 89.9,
    currency: "EUR",
    clientUtm: { orderId: "order-2" },
  });
  const event = parseLavaTopWebhookEvent(rawBody);
  assert.equal(event.eventType, "payment.success");
  assert.equal(event.externalId, "contract_1");
  assert.equal(event.orderId, "order-2");
  assert.equal(event.amountMinor, 8990);
  assert.equal(event.currency, "EUR");
});
