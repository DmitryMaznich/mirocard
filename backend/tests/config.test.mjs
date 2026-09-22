// config.mjs reads every env var at module-evaluation time, so each
// scenario below needs its own fresh dynamic import with a cache-busting
// query string -- Node's ESM module cache would otherwise return the
// already-evaluated module on a second static import in this same process.

import { test } from "node:test";
import assert from "node:assert/strict";

function freshConfigImport() {
  return import(`../lib/config.mjs?t=${Date.now()}-${Math.random()}`);
}

test("in production (RAILWAY_ENVIRONMENT set) with a required secret missing, importing config.mjs throws", async () => {
  const saved = { ...process.env };
  process.env.RAILWAY_ENVIRONMENT = "production";
  delete process.env.AUTH_SECRET;
  delete process.env.ACCOUNT_SECRET;
  delete process.env.MIROCARD_DEPLOY_TOKEN;
  delete process.env.MIROCARD_ADMIN_TOKEN;
  delete process.env.RESEND_API_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  try {
    await assert.rejects(freshConfigImport(), /AUTH_SECRET must be set/);
  } finally {
    process.env = saved;
  }
});

test("in production with every required secret set, importing config.mjs succeeds and returns the real values (not the dev defaults)", async () => {
  const saved = { ...process.env };
  process.env.RAILWAY_ENVIRONMENT = "production";
  process.env.AUTH_SECRET = "real-auth-secret";
  process.env.ACCOUNT_SECRET = "real-account-secret";
  process.env.MIROCARD_DEPLOY_TOKEN = "real-deploy-token";
  process.env.MIROCARD_ADMIN_TOKEN = "real-admin-token";
  process.env.RESEND_API_KEY = "real-resend-key";
  process.env.STRIPE_SECRET_KEY = "real-stripe-key";
  process.env.STRIPE_WEBHOOK_SECRET = "real-stripe-webhook-secret";
  try {
    const config = await freshConfigImport();
    assert.equal(config.AUTH_SECRET, "real-auth-secret");
    assert.equal(config.ADMIN_TOKEN, "real-admin-token");
    assert.notEqual(config.AUTH_SECRET, "dev-auth-secret-change-me");
  } finally {
    process.env = saved;
  }
});

test("outside production (RAILWAY_ENVIRONMENT unset), a missing secret falls back to the dev default instead of throwing", async () => {
  const saved = { ...process.env };
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.AUTH_SECRET;
  try {
    const config = await freshConfigImport();
    assert.equal(config.AUTH_SECRET, "dev-auth-secret-change-me");
  } finally {
    process.env = saved;
  }
});

test("LAVA_TOP_API_KEY is not required even in production (Lava Top is an optional, unverified rail)", async () => {
  const saved = { ...process.env };
  process.env.RAILWAY_ENVIRONMENT = "production";
  process.env.AUTH_SECRET = "x";
  process.env.ACCOUNT_SECRET = "x";
  process.env.MIROCARD_DEPLOY_TOKEN = "x";
  process.env.MIROCARD_ADMIN_TOKEN = "x";
  process.env.RESEND_API_KEY = "x";
  process.env.STRIPE_SECRET_KEY = "x";
  process.env.STRIPE_WEBHOOK_SECRET = "x";
  delete process.env.LAVA_TOP_API_KEY;
  try {
    const config = await freshConfigImport();
    assert.equal(config.LAVA_TOP_API_KEY, "");
  } finally {
    process.env = saved;
  }
});
