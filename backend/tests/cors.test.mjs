import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-cors-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-cors-dist-"));
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
process.env.CORS_ALLOWED_ORIGINS = "https://app.mironium.com,http://localhost:5174";

const { router } = await import("../server.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

test("an allowlisted Origin gets echoed back in Access-Control-Allow-Origin", async () => {
  const res = await fetch(`${base}/api/version`, { headers: { Origin: "https://app.mironium.com" } });
  assert.equal(res.headers.get("access-control-allow-origin"), "https://app.mironium.com");
});

test("a disallowed Origin gets no CORS header at all", async () => {
  const res = await fetch(`${base}/api/version`, { headers: { Origin: "https://evil.example" } });
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  // The response body is still returned -- CORS is enforced by the browser
  // reading the (absent) header, not by the server refusing the request.
  assert.equal(res.status, 200);
});

test("a request with no Origin header (same-origin, curl, etc.) gets no CORS header, still succeeds", async () => {
  const res = await fetch(`${base}/api/version`);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  assert.equal(res.status, 200);
});

test("OPTIONS preflight from an allowlisted origin gets the CORS headers on the 204", async () => {
  const res = await fetch(`${base}/api/billing/checkout`, { method: "OPTIONS", headers: { Origin: "http://localhost:5174" } });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5174");
  assert.match(res.headers.get("access-control-allow-methods") ?? "", /POST/);
});
