// Paddle over real HTTP: checkout creates our order + a Paddle draft
// transaction (Paddle's API stubbed), a signed webhook grants access, a
// forged one is refused, and the portal link needs a known customer.
// Env must be set before server.mjs/config.mjs load (read at import time).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-paddle-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-paddle-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

Object.assign(process.env, {
  MIROCARD_DATA_DIR: dataDir, MIROCARD_DEPLOY_FRONTEND_DIR: frontendDir, SERVE_STATIC: "1",
  MIROCARD_ADMIN_TOKEN: "test-admin-token", AUTH_SECRET: "test-auth-secret", ACCOUNT_SECRET: "test-account-secret",
  MIROCARD_DEPLOY_TOKEN: "test-deploy-token", APP_BASE_URL: "http://localhost:5174",
  PADDLE_ENV: "sandbox", PADDLE_API_KEY: "pdl_sdbx_apikey_test", PADDLE_CLIENT_TOKEN: "test_client_token",
  PADDLE_WEBHOOK_SECRET: "pdl_ntfset_secret", PADDLE_PRICE_ANNUAL: "pri_year", PADDLE_PRICE_MONTHLY: "pri_month",
});

// Stub only Paddle's API; everything else (our own test server) goes through.
const realFetch = globalThis.fetch;
const paddleCalls = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.startsWith("https://sandbox-api.paddle.com")) {
    paddleCalls.push({ url: u, method: init.method, body: init.body ? JSON.parse(init.body) : null });
    if (u.endsWith("/transactions")) return new Response(JSON.stringify({ data: { id: "txn_test_1" } }), { status: 201 });
    const subMatch = u.match(/\/subscriptions\/([^/]+)(\/cancel)?$/);
    if (subMatch) {
      const body = init.body ? JSON.parse(init.body) : {};
      const now = new Date().toISOString();
      const end = new Date(Date.now() + 366 * 86400000).toISOString();
      const scheduled = subMatch[2] ? { action: "cancel", effective_at: end } : (body.scheduled_change === null ? null : undefined);
      return new Response(JSON.stringify({ data: {
        id: decodeURIComponent(subMatch[1]), status: "active", customer_id: "ctm_x", items: [{ price: { id: "pri_year" } }],
        current_billing_period: { starts_at: now, ends_at: end }, scheduled_change: scheduled ?? null,
        custom_data: null, updated_at: new Date(Date.now() + 1000).toISOString(),
      } }), { status: 200 });
    }
    if (u.includes("/portal-sessions")) {
      return new Response(JSON.stringify({ data: { urls: {
        general: { overview: "https://customer-portal.paddle.com/overview" },
        subscriptions: [{ id: "sub_http_1", cancel_subscription: "https://cp/cancel", update_subscription_payment_method: "https://cp/card" }],
      } } }), { status: 201 });
    }
    return new Response("{}", { status: 404 });
  }
  return realFetch(url, init);
};

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount, setAccountFeatureFlags } = await import("../lib/account-repository.mjs");
const { hasActiveEntitlement } = await import("../lib/billing-repository.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => { server.close(); globalThis.fetch = realFetch; });

async function login(email, { preview = true } = {}) {
  const password = "correct horse battery staple";
  const reg = await fetch(`${base}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  assert.equal(reg.status, 201);
  const account = findAccountByEmailAny(db, email);
  activateAccount(db, account.id);
  db.prepare("DELETE FROM entitlements WHERE account_id = ?").run(account.id); // no trial in the way
  // Paid plans are paused (PAYWALL_ENFORCED off): only billing-preview accounts may subscribe.
  if (preview) setAccountFeatureFlags(db, account.id, ["billing_preview"]);
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  return { accountId: account.id, auth: { Authorization: `Bearer ${(await res.json()).token}` } };
}

function signedWebhook(payload, secret = "pdl_ntfset_secret") {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(Date.now() / 1000));
  const h1 = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  return fetch(`${base}/api/billing/webhook/paddle`, {
    method: "POST", headers: { "Content-Type": "application/json", "Paddle-Signature": `ts=${ts};h1=${h1}` }, body,
  });
}

function subscriptionPayload(accountId, orderId, { eventId = "evt_http_sub", status = "active" } = {}) {
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 366 * 86400000).toISOString();
  return {
    event_id: eventId, event_type: "subscription.created", occurred_at: start,
    data: {
      id: "sub_http_1", status, customer_id: "ctm_http_1", items: [{ price: { id: "pri_year" } }],
      current_billing_period: { starts_at: start, ends_at: end }, scheduled_change: null,
      custom_data: { accountId, orderId }, updated_at: start,
    },
  };
}

test("signup-status advertises the sandbox Paddle checkout", async () => {
  const s = await (await fetch(`${base}/api/auth/signup-status`)).json();
  assert.deepEqual(s.paddle, { enabled: true, environment: "sandbox" });
});

test("checkout → signed webhooks → access, order completed, portal link", async () => {
  const { accountId, auth } = await login("paddle-flow@example.test");

  const checkout = await fetch(`${base}/api/billing/paddle/checkout`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ plan: "annual" }),
  });
  assert.equal(checkout.status, 200);
  const { orderId, transactionId, clientToken, environment } = await checkout.json();
  assert.equal(transactionId, "txn_test_1");
  assert.equal(clientToken, "test_client_token");
  assert.equal(environment, "sandbox");
  const txCall = paddleCalls.find((c) => c.url.endsWith("/transactions"));
  assert.deepEqual(txCall.body.items, [{ price_id: "pri_year", quantity: 1 }]);
  assert.deepEqual(txCall.body.custom_data, { accountId, orderId });

  assert.equal(hasActiveEntitlement(db, accountId), false);
  assert.equal((await signedWebhook(subscriptionPayload(accountId, orderId))).status, 200);
  assert.equal(hasActiveEntitlement(db, accountId), true);

  assert.equal((await signedWebhook({
    event_id: "evt_http_tx", event_type: "transaction.completed",
    data: { id: "txn_test_1", status: "completed", subscription_id: "sub_http_1", customer_id: "ctm_http_1",
      currency_code: "EUR", details: { totals: { grand_total: "8990" } }, custom_data: { accountId, orderId } },
  })).status, 200);
  const order = db.prepare("SELECT status FROM orders WHERE external_contract_id = ?").get(orderId);
  assert.equal(order.status, "completed");

  const sub = await (await fetch(`${base}/api/billing/subscription`, { headers: auth })).json();
  assert.equal(sub.provider.status, "active");
  assert.equal(sub.provider.renews, true);

  const second = await fetch(`${base}/api/billing/paddle/checkout`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ plan: "monthly" }),
  });
  assert.equal(second.status, 409, "no second live subscription");

  const portal = await fetch(`${base}/api/billing/portal`, { method: "POST", headers: auth });
  assert.equal(portal.status, 200);
  assert.deepEqual(await portal.json(), {
    overviewUrl: "https://customer-portal.paddle.com/overview", cancelUrl: "https://cp/cancel", updatePaymentMethodUrl: "https://cp/card",
  });
});

test("a webhook with a forged signature changes nothing", async () => {
  const { accountId } = await login("paddle-forged@example.test");
  const res = await signedWebhook(subscriptionPayload(accountId, "x", { eventId: "evt_forged" }), "wrong-secret");
  assert.equal(res.status, 401);
  assert.equal(hasActiveEntitlement(db, accountId), false);
});

test("checkout for a plan without a configured Paddle price is refused", async () => {
  const { auth } = await login("paddle-noprice@example.test");
  const res = await fetch(`${base}/api/billing/paddle/checkout`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ plan: "half_year" }),
  });
  assert.equal(res.status, 503);
});

test("the portal needs a subscription", async () => {
  const { auth } = await login("paddle-noportal@example.test");
  const res = await fetch(`${base}/api/billing/portal`, { method: "POST", headers: auth });
  assert.equal(res.status, 404);
});

test("while paid plans are paused, checkout is refused without the billing preview flag", async () => {
  const { auth } = await login("paddle-nopreview@example.test", { preview: false });
  const res = await fetch(`${base}/api/billing/paddle/checkout`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ plan: "annual" }),
  });
  assert.equal(res.status, 503);
});

function subscriptionFor(accountId, subId, { eventId, scheduledCancel = false }) {
  const payload = subscriptionPayload(accountId, "o-" + subId, { eventId });
  payload.data.id = subId;
  payload.data.customer_id = "ctm_" + subId;
  if (scheduledCancel) payload.data.scheduled_change = { action: "cancel", effective_at: payload.data.current_billing_period.ends_at };
  return payload;
}

test("resume removes a scheduled cancellation", async () => {
  const { accountId, auth } = await login("paddle-resume@example.test");
  assert.equal((await signedWebhook(subscriptionFor(accountId, "sub_resume", { eventId: "evt_resume", scheduledCancel: true }))).status, 200);
  let sub = await (await fetch(`${base}/api/billing/subscription`, { headers: auth })).json();
  assert.equal(sub.provider.renews, false);
  assert.ok(sub.provider.scheduledCancelAt);

  const res = await fetch(`${base}/api/billing/resume`, { method: "POST", headers: auth });
  assert.equal(res.status, 200);
  const summary = await res.json();
  assert.equal(summary.renews, true);
  assert.equal(summary.scheduledCancelAt, null);
  const call = paddleCalls.findLast((c) => c.url.endsWith("/subscriptions/sub_resume"));
  assert.equal(call.method, "PATCH");
  assert.deepEqual(call.body, { scheduled_change: null });

  const again = await fetch(`${base}/api/billing/resume`, { method: "POST", headers: auth });
  assert.equal(again.status, 409, "nothing left to resume");
});

test("deleting the account cancels a renewing subscription at the period's end", async () => {
  const { accountId, auth } = await login("paddle-delete@example.test");
  assert.equal((await signedWebhook(subscriptionFor(accountId, "sub_delete", { eventId: "evt_delete" }))).status, 200);
  const res = await fetch(`${base}/api/account`, { method: "DELETE", headers: auth });
  assert.ok(res.status === 204 || res.status === 200, `status ${res.status}`);
  const call = paddleCalls.findLast((c) => c.url.endsWith("/subscriptions/sub_delete/cancel"));
  assert.ok(call, "Paddle cancel was called");
  assert.deepEqual(call.body, { effective_from: "next_billing_period" });
  const row = db.prepare("SELECT scheduled_cancel_at FROM provider_subscriptions WHERE provider_subscription_id = 'sub_delete'").get();
  assert.ok(row.scheduled_cancel_at);
});
