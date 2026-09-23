import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-order-status-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-order-status-dist-"));
mkdirSync(path.join(frontendDir, "decks"), { recursive: true });
writeFileSync(path.join(frontendDir, "index.html"), "<html></html>");
writeFileSync(path.join(frontendDir, "decks", "catalog.json"), JSON.stringify({ decks: [] }));

process.env.MIROCARD_DATA_DIR = dataDir;
process.env.MIROCARD_DEPLOY_FRONTEND_DIR = frontendDir;
process.env.SERVE_STATIC = "1";
process.env.MIROCARD_ADMIN_TOKEN = "test-admin-token";
process.env.AUTH_SECRET = "test-auth-secret";
process.env.ACCOUNT_SECRET = "test-account-secret";
process.env.APP_BASE_URL = "http://localhost:5174";
process.env.LEGAL_DOCS_VERSION = "2026-10-01-test";
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

const { router, db } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount } = await import("../lib/account-repository.mjs");
const { grantTrialSubscription } = await import("../lib/billing-repository.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

let _n = 0;
async function registerAndLogin() {
  _n += 1;
  const email = `order-status-${_n}@example.test`;
  const password = "correct horse battery staple";
  await fetch(`${base}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  activateAccount(db, findAccountByEmailAny(db, email).id);
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { token } = await loginRes.json();
  return { token, accountId: findAccountByEmailAny(db, email).id };
}

async function createCheckoutOrder(token) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("api.stripe.com")) {
      return { ok: true, json: async () => ({ id: "cs_test", url: "https://checkout.stripe.com/pay/cs_test" }) };
    }
    return originalFetch(url, init);
  };
  try {
    const res = await fetch(`${base}/api/billing/checkout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: "monthly", method: "card",
        consents: { termsAccepted: true, pricePeriodConfirmed: true, digitalContentAck: true },
      }),
    });
    return (await res.json()).orderId;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("order-status requires auth", async () => {
  const res = await fetch(`${base}/api/billing/order-status?orderId=whatever`);
  assert.equal(res.status, 401);
});

test("order-status 404s for an unknown orderId", async () => {
  const { token } = await registerAndLogin();
  const res = await fetch(`${base}/api/billing/order-status?orderId=nope`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 404);
});

test("order-status 404s for another account's order (not just any order)", async () => {
  const { token: tokenA } = await registerAndLogin();
  const orderId = await createCheckoutOrder(tokenA);

  const { token: tokenB } = await registerAndLogin();
  const res = await fetch(`${base}/api/billing/order-status?orderId=${orderId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.equal(res.status, 404);
});

test("order-status reports pending for a freshly created order", async () => {
  const { token } = await registerAndLogin();
  const orderId = await createCheckoutOrder(token);

  const res = await fetch(`${base}/api/billing/order-status?orderId=${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  assert.equal(body.status, "pending");
  assert.equal(body.currentPeriodEnd, null);
});

test("order-status reports completed + the granted period once the webhook confirms it, even if the account already had an unrelated active entitlement", async () => {
  const { token, accountId } = await registerAndLogin();
  grantTrialSubscription(db, accountId); // account already entitled via trial -- unrelated to this order
  const orderId = await createCheckoutOrder(token);

  await fetch(`${base}/api/billing/webhook/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": await stripeSignature(JSON.stringify({
        id: "evt_order_status_test",
        type: "checkout.session.completed",
        data: { object: { client_reference_id: orderId, amount_total: 990, currency: "eur", metadata: { orderId } } },
      })),
    },
    body: JSON.stringify({
      id: "evt_order_status_test",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: orderId, amount_total: 990, currency: "eur", metadata: { orderId } } },
    }),
  });

  const res = await fetch(`${base}/api/billing/order-status?orderId=${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  assert.equal(body.status, "completed");
  assert.equal(body.plan, "monthly");
  assert.ok(body.currentPeriodEnd);
  // ~31 days out for a monthly order -- distinctly NOT the trial's ~7 days,
  // proving this reflects the order's own grant, not just "account is
  // entitled somehow".
  const daysLeft = (new Date(body.currentPeriodEnd) - Date.now()) / 86400000;
  assert.ok(daysLeft > 25, `expected the monthly order's own ~31-day grant, got ${daysLeft} days`);
});

async function stripeSignature(rawBody) {
  const { createHmac } = await import("node:crypto");
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", "whsec_test").update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
