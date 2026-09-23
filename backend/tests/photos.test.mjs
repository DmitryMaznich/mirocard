import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-photos-data-"));
const frontendDir = mkdtempSync(path.join(tmpdir(), "mirocard-photos-dist-"));
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

const { router } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount } = await import("../lib/account-repository.mjs");
const { db } = await import("../server.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

async function registerLoginUpload() {
  const email = "photo-owner@example.test";
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

  const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const uploadRes = await fetch(`${base}/api/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl: `data:image/png;base64,${tinyPngBase64}` }),
  });
  const { url } = await uploadRes.json();
  return { token, url };
}

test("uploading a photo requires auth", async () => {
  const res = await fetch(`${base}/api/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl: "data:image/png;base64,aaaa" }),
  });
  assert.equal(res.status, 401);
});

test("reading a photo by its hash requires auth (previously anonymous)", async () => {
  const { url } = await registerLoginUpload();
  const anonRes = await fetch(`${base}${url}`);
  assert.equal(anonRes.status, 401);
});

test("an authenticated request can read the photo back", async () => {
  const { token, url } = await registerLoginUpload();
  const res = await fetch(`${base}${url}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /image\/png/);
  assert.equal(res.headers.get("cache-control"), "private, max-age=31536000, immutable");
});

test("a different signed-in account can also read it (documented scope limitation -- see handleGetPhoto's comment)", async () => {
  const { url } = await registerLoginUpload();
  const email2 = "photo-other@example.test";
  const password = "correct horse battery staple";
  await fetch(`${base}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email2, password, firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  activateAccount(db, findAccountByEmailAny(db, email2).id);
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email2, password }),
  });
  const { token: otherToken } = await loginRes.json();

  const res = await fetch(`${base}${url}`, { headers: { Authorization: `Bearer ${otherToken}` } });
  assert.equal(res.status, 200); // any authenticated account, not owner-scoped -- see comment above
});
