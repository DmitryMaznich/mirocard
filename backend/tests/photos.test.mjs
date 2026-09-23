import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

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
// Small limits so quota and body-size paths are reachable in a test.
process.env.MAX_PHOTOS_PER_ACCOUNT = "2";
process.env.PHOTO_MAX_INPUT_BYTES = String(2 * 1024 * 1024);

const { router } = await import("../server.mjs");
const { findAccountByEmailAny, activateAccount } = await import("../lib/account-repository.mjs");
const { db } = await import("../server.mjs");

const server = createServer(router);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

let n = 0;
async function login() {
  n += 1;
  const email = `photo-${n}@example.test`;
  const password = "correct horse battery staple";
  await fetch(`${base}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, firstName: "T", role: "parent", referralSource: "other", consentPersonalData: true }),
  });
  activateAccount(db, findAccountByEmailAny(db, email).id);
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await res.json()).token;
}

async function jpegDataUrl(seed, width = 1200, height = 900) {
  const buf = await sharp({ create: { width, height, channels: 3, background: { r: (seed * 37) % 256, g: (seed * 91) % 256, b: (seed * 53) % 256 } } }).jpeg().toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function upload(token, dataUrl) {
  return fetch(`${base}/api/photos`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
}

test("uploading a photo requires auth", async () => {
  const res = await upload(null, await jpegDataUrl(1));
  assert.equal(res.status, 401);
});

test("upload normalizes to WebP; the owner reads it (200), anonymous gets 401, another account gets 404", async () => {
  const owner = await login();
  const other = await login();
  const res = await upload(owner, await jpegDataUrl(2, 3000, 2000));
  assert.equal(res.status, 200);
  const { url } = await res.json();
  assert.match(url, /^\/api\/photos\/[0-9a-f]{32}$/);

  assert.equal((await fetch(`${base}${url}`)).status, 401);

  const mine = await fetch(`${base}${url}`, { headers: { Authorization: `Bearer ${owner}` } });
  assert.equal(mine.status, 200);
  assert.equal(mine.headers.get("content-type"), "image/webp");
  assert.equal(mine.headers.get("cache-control"), "private, max-age=31536000, immutable");
  const meta = await sharp(Buffer.from(await mine.arrayBuffer())).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(Math.max(meta.width, meta.height), 1440, "downscaled from 3000 px");

  const theirs = await fetch(`${base}${url}`, { headers: { Authorization: `Bearer ${other}` } });
  assert.equal(theirs.status, 404, "not 403 -- must not confirm the photo exists");
});

test("a non-image is rejected with 422 and a user-facing message; nothing is stored", async () => {
  const token = await login();
  const before = db.prepare("SELECT COUNT(*) n FROM photos").get().n;
  const res = await upload(token, `data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`);
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.code, "not_image");
  assert.match(body.error, /не похож на фото/);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, before);
});

test("an oversized request body is rejected with 413 before decoding", async () => {
  const token = await login();
  const res = await upload(token, `data:image/jpeg;base64,${"A".repeat(3 * 1024 * 1024)}`);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, "too_large_input");
});

test("per-account photo quota: 409 with an explanation; re-uploading an owned photo is free", async () => {
  const token = await login();
  const first = await jpegDataUrl(10);
  assert.equal((await upload(token, first)).status, 200);
  assert.equal((await upload(token, await jpegDataUrl(11))).status, 200);
  assert.equal((await upload(token, first)).status, 200, "same photo again costs no quota");
  const res = await upload(token, await jpegDataUrl(12));
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, "photo_count_quota");
  assert.match(body.error, /Удалите или замените/);
});

test("sync: a rejected photo op is reported in `rejected` with 200 (never stalls the client queue)", async () => {
  const token = await login();
  const sync = (operations) => fetch(`${base}/api/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ operations }),
  });
  await sync([{ type: "student.upsert", data: { id: "sync-st", name: "Аня" } }]);
  const res = await sync([
    { type: "student.photo.upsert", data: { studentId: "sync-st", photo: "data:image/jpeg;base64,bm9wZQ==", photoUpdatedAt: "2026-09-24T10:00:00.000Z" } },
  ]);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.rejected.length, 1);
  assert.equal(body.rejected[0].code, "not_image");
  assert.ok(body.rejected[0].message);

  const ok = await sync([
    { type: "student.photo.upsert", data: { studentId: "sync-st", photo: await jpegDataUrl(30), photoUpdatedAt: "2026-09-24T11:00:00.000Z" } },
  ]);
  assert.deepEqual((await ok.json()).rejected, []);
  const stored = db.prepare("SELECT photo FROM students WHERE id = 'sync-st'").get().photo;
  assert.match(stored, /^\/api\/photos\/[0-9a-f]{32}$/);
  const read = await fetch(`${base}${stored}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(read.status, 200);
});
