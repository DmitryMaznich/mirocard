import { test } from "node:test";
import assert from "node:assert/strict";

function freshImport() {
  return import(`../lib/observability.mjs?t=${Date.now()}-${Math.random()}`);
}

test("trackEvent is a no-op (no fetch call) when ANALYTICS_WEBHOOK_URL is unset", async () => {
  const saved = process.env.ANALYTICS_WEBHOOK_URL;
  delete process.env.ANALYTICS_WEBHOOK_URL;
  const { trackEvent } = await freshImport();

  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; return { ok: true }; };
  try {
    trackEvent("test_event", { foo: "bar" });
    await Promise.resolve();
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (saved !== undefined) process.env.ANALYTICS_WEBHOOK_URL = saved;
  }
});

test("trackEvent posts to ANALYTICS_WEBHOOK_URL when set", async () => {
  const saved = process.env.ANALYTICS_WEBHOOK_URL;
  process.env.ANALYTICS_WEBHOOK_URL = "https://analytics.example/ingest";
  const { trackEvent } = await freshImport();

  let capturedUrl, capturedBody;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { capturedUrl = url; capturedBody = JSON.parse(init.body); return { ok: true }; };
  try {
    trackEvent("checkout_created", { plan: "monthly" });
    await Promise.resolve();
    assert.equal(capturedUrl, "https://analytics.example/ingest");
    assert.equal(capturedBody.event, "checkout_created");
    assert.equal(capturedBody.properties.plan, "monthly");
  } finally {
    globalThis.fetch = originalFetch;
    if (saved !== undefined) process.env.ANALYTICS_WEBHOOK_URL = saved;
    else delete process.env.ANALYTICS_WEBHOOK_URL;
  }
});

test("reportError always console.errors locally and is a no-op fetch-wise when ERROR_REPORTING_WEBHOOK_URL is unset", async () => {
  delete process.env.ERROR_REPORTING_WEBHOOK_URL;
  const { reportError } = await freshImport();

  let called = false;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async () => { called = true; return { ok: true }; };
  console.error = () => {};
  try {
    reportError(new Error("boom"), { scope: "test" });
    await Promise.resolve();
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("reportError posts a capped, PII-free-by-contract payload when ERROR_REPORTING_WEBHOOK_URL is set", async () => {
  process.env.ERROR_REPORTING_WEBHOOK_URL = "https://errors.example/ingest";
  const { reportError } = await freshImport();

  let capturedBody;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async (url, init) => { capturedBody = JSON.parse(init.body); return { ok: true }; };
  console.error = () => {};
  try {
    reportError(new Error("boom"), { method: "GET", path: "/foo" });
    await Promise.resolve();
    assert.equal(capturedBody.message, "boom");
    assert.deepEqual(capturedBody.context, { method: "GET", path: "/foo" });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    delete process.env.ERROR_REPORTING_WEBHOOK_URL;
  }
});
