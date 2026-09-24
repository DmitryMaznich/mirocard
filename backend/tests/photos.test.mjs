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

// ─── Upload size limits: base64 overhead + a reliable 413 ───────────────────
import { request as httpRequest } from "node:http";
import { randomBytes } from "node:crypto";

test("an image just under the byte limit is not refused by the HTTP body limit (base64 is ~4/3 larger)", async () => {
  const token = await login();
  // ~1.9 MiB of raw image data -> ~2.5 MiB of base64, over the 2 MiB image limit
  // used in this file but within the derived HTTP body limit.
  const nearLimit = await sharp(randomBytes(800 * 800 * 3), { raw: { width: 800, height: 800, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  assert.ok(nearLimit.length < 2 * 1024 * 1024 && nearLimit.length > 1.5 * 1024 * 1024, `fixture ${nearLimit.length} B`);
  const dataUrl = `data:image/png;base64,${nearLimit.toString("base64")}`;
  assert.ok(dataUrl.length > 2 * 1024 * 1024, "body is larger than the image limit");
  const res = await upload(token, dataUrl);
  assert.notEqual(res.status, 413, "must be judged on the decoded image, not the base64 body");
  const body = await res.json();
  assert.ok(res.status === 200 || body.code === "too_large_output", `${res.status} ${JSON.stringify(body)}`);
});

function rawPost(path, token, bodyBytes) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.concat([Buffer.from('{"dataUrl":"data:image/jpeg;base64,'), Buffer.alloc(bodyBytes, 0x41), Buffer.from('"}')]);
    const req = httpRequest(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Content-Length": payload.length },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    req.on("error", reject); // ECONNRESET / EPIPE would land here and fail the test
    req.end(payload);
  });
}

test("an oversized upload always gets a readable 413 (never ECONNRESET), repeatedly, and the server keeps serving", async () => {
  const token = await login();
  // Mixed sizes: small overruns, and bodies far larger than the socket
  // buffers, so the client is still uploading when the server decides --
  // the case where answering + closing early produced ECONNRESET.
  const sizes = [3, 6, 40, 3, 40, 6, 40, 3].map((mib) => mib * 1024 * 1024);
  for (const [i, size] of sizes.entries()) {
    const { status, body } = await rawPost("/api/photos", token, size);
    assert.equal(status, 413, `attempt ${i}`);
    assert.equal(body.code, "too_large_input");
    assert.match(body.error, /слишком большое/);
  }
  // fetch (keep-alive pool) right after: connection state is clean.
  const res = await upload(token, await jpegDataUrl(77));
  assert.equal(res.status, 200);
});

test("the upload body limit is derived from the image limit with base64 overhead", async () => {
  const { photoUploadBodyLimit } = await import("../lib/config.mjs");
  const tenMiB = 10 * 1024 * 1024;
  const limit = photoUploadBodyLimit(tenMiB);
  assert.ok(limit > Math.ceil(tenMiB * 4 / 3), `${limit} must exceed the base64 size of a 10 MiB image`);
  assert.ok(limit < 15 * 1024 * 1024, `${limit} stays close to it`);
});
