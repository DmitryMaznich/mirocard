import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyRollout } from "../../scripts/verify-localization-rollout.mjs";

function options(overrides = {}) {
  const replies = {
    "/": '<html><div id="root"></div><script>localStorage.getItem("mironium.uiLanguage")</script></html>',
    "/api/version": { version: "1.0.2659", gitSha: "1234567" },
    "/api/healthz": { status: "ok", db: true, version: "1.0.2659", gitSha: "1234567" },
    "/api/decks/catalog": { decks: [] },
    ...(overrides.replies || {}),
  };
  return { baseUrl: "https://example.test", expectedSha: "1234567890abcdef1234567890abcdef12345678", expectedVersion: "1.0.2659", requireLanguagePicker: true,
    fetcher: async (url) => new Response(typeof replies[url.pathname] === "string" ? replies[url.pathname] : JSON.stringify(replies[url.pathname])),
    ...overrides.options };
}

test("accepts a matching release, healthy DB and built localization shell", async () => {
  assert.deepEqual(await verifyRollout(options()), { version: "1.0.2659", gitSha: "1234567", health: "ok", catalogEntries: 0 });
});
test("rejects an old deployment, mismatched health identity and an unhealthy DB", async () => {
  await assert.rejects(verifyRollout(options({ options: { expectedSha: "abcdef0123456789012345678901234567890123" } })), /Awaiting commit/);
  await assert.rejects(verifyRollout(options({ replies: { "/api/version": { version: "1.0.2659", gitSha: "123" } } })), /Awaiting commit/);
  await assert.rejects(verifyRollout(options({ options: { expectedVersion: "newer" } })), /Unexpected app version/);
  await assert.rejects(verifyRollout(options({ replies: { "/api/healthz": { status: "ok", db: true, version: "1.0.2658", gitSha: "1234567" } } })), /disagree/);
  await assert.rejects(verifyRollout(options({ replies: { "/api/healthz": { status: "degraded", db: false } } })), /health check failed/);
});
test("rejects a missing localization shell, invalid catalog and HTTP errors", async () => {
  await assert.rejects(verifyRollout(options({ replies: { "/": '<div id="root"></div>' } })), /Localization bootstrap/);
  await assert.rejects(verifyRollout(options({ replies: { "/api/decks/catalog": {} } })), /catalog/);
  await assert.rejects(verifyRollout(options({ options: { fetcher: async () => new Response("", { status: 503 }) } })), /HTTP 503/);
});
test("preflight can verify the prior release without requiring localization", async () => {
  await verifyRollout(options({ replies: { "/": '<div id="root"></div>' }, options: { expectedSha: "", expectedVersion: "", requireLanguagePicker: false } }));
});
