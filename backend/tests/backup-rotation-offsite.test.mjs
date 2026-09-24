import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, readdirSync, mkdirSync, symlinkSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const { planRotation, rotateBackups, snapshotName, parseSnapshotTime } = await import("../lib/backup/rotation.mjs");
const { signRequest } = await import("../lib/backup/s3-client.mjs");
const { runBackupOnce, maybeUploadOffsite, warnIfOffsiteNotConfigured } = await import("../../scripts/railway-backup-loop.mjs");
const { restoreBackup, verifyRestoredDb } = await import("../../scripts/restore-sqlite-backup.mjs");

const HOUR = 3_600_000;
const NOW = Date.parse("2026-09-24T12:30:00.000Z");

// ─── Rotation ────────────────────────────────────────────────────────────────

test("snapshot names round-trip to their timestamp; foreign names are not snapshots", () => {
  const d = new Date("2026-09-23T14:13:55.330Z");
  assert.equal(snapshotName(d), "mirocard-2026-09-23T14-13-55-330Z.db");
  assert.equal(parseSnapshotTime(snapshotName(d)), d.getTime());
  for (const other of ["offsite-state.json", "mirocard.db", "mirocard-latest.db", "../mirocard-2026-09-23T14-13-55-330Z.db", "notes.txt"]) {
    assert.equal(parseSnapshotTime(other), null, other);
  }
});

test("14 days of hourly snapshots rotate down to 24 hourly + one per day for 14 more days", () => {
  const names = [];
  for (let h = 0; h < 16 * 24; h += 1) names.push(snapshotName(new Date(NOW - h * HOUR)));
  const { keep, remove } = planRotation(names, { now: NOW, keepHourly: 24, keepDailyDays: 14 });
  assert.equal(keep.length + remove.length, names.length);
  // The newest 24 are all kept.
  for (let h = 0; h < 24; h += 1) assert.ok(keep.includes(names[h]), `hourly ${h}`);
  const older = keep.filter((n) => !names.slice(0, 24).includes(n));
  const days = older.map((n) => new Date(parseSnapshotTime(n)).toISOString().slice(0, 10));
  assert.equal(new Set(days).size, days.length, "at most one per day beyond the hourly window");
  assert.ok(older.length <= 15, `daily copies kept: ${older.length}`);
  assert.ok(keep.length <= 24 + 15, `total kept ${keep.length} (was ${names.length})`);
  const oldestKept = Math.min(...keep.map(parseSnapshotTime));
  assert.ok(oldestKept >= NOW - 24 * HOUR - 14 * 24 * HOUR - 24 * HOUR, "nothing older than hourly window + 14 days (+1 day bucket)");
});

test("fewer snapshots than the hourly window: nothing is deleted", () => {
  const names = [0, 1, 2].map((h) => snapshotName(new Date(NOW - h * HOUR)));
  assert.deepEqual(planRotation(names, { now: NOW }).remove, []);
});

test("rotateBackups deletes only its own snapshot files -- never foreign files, symlinks or directories", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rotation-"));
  const snaps = [];
  for (let h = 0; h < 40 * 24; h += 6) {
    const name = snapshotName(new Date(NOW - h * HOUR));
    writeFileSync(path.join(dir, name), "x");
    snaps.push(name);
  }
  const decoys = ["offsite-state.json", "README.txt", "mirocard.db"];
  for (const d of decoys) writeFileSync(path.join(dir, d), "keep me");
  const oldName = snapshotName(new Date(NOW - 60 * 24 * HOUR));
  mkdirSync(path.join(dir, oldName)); // a directory that looks like an old snapshot
  const target = mkdtempSync(path.join(tmpdir(), "rotation-target-"));
  writeFileSync(path.join(target, "precious.db"), "do not delete");
  symlinkSync(path.join(target, "precious.db"), path.join(dir, snapshotName(new Date(NOW - 59 * 24 * HOUR))));

  const removed = rotateBackups(dir, { now: NOW, keepHourly: 24, keepDailyDays: 14 });
  assert.ok(removed.length > 0);
  const left = readdirSync(dir);
  for (const d of decoys) assert.ok(left.includes(d), `${d} kept`);
  assert.ok(left.includes(oldName), "directory untouched");
  assert.ok(existsSync(path.join(target, "precious.db")), "symlink target untouched");
  assert.ok(left.includes(snapshotName(new Date(NOW - 59 * 24 * HOUR))), "symlink itself untouched");
  for (const r of removed) assert.ok(!left.includes(r));
});

// ─── Fake S3 (verifies what a real store verifies) ──────────────────────────

const CREDS = { accessKeyId: "AKIDTEST", secretAccessKey: "secret/test+key", region: "auto" };

function startFakeS3({ corruptOnGet = false } = {}) {
  const objects = new Map();
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, `http://${req.headers.host}`);
    // Re-derive the signature from the request as received.
    const signedNames = /SignedHeaders=([^,]+)/.exec(req.headers.authorization ?? "")?.[1]?.split(";") ?? [];
    const headers = Object.fromEntries(signedNames.filter((h) => !["host", "x-amz-date", "x-amz-content-sha256"].includes(h)).map((h) => [h, req.headers[h]]));
    const date = req.headers["x-amz-date"];
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`;
    const expected = signRequest({ method: req.method, url: url.toString(), headers, payloadHash: req.headers["x-amz-content-sha256"], ...CREDS, date: new Date(iso) });
    if (expected.headers.authorization !== req.headers.authorization) { res.writeHead(403); res.end("SignatureDoesNotMatch"); return; }
    if (req.method === "PUT") {
      if (createHash("sha256").update(body).digest("hex") !== req.headers["x-amz-content-sha256"]) { res.writeHead(400); res.end("XAmzContentSHA256Mismatch"); return; }
      if (createHash("md5").update(body).digest("base64") !== req.headers["content-md5"]) { res.writeHead(400); res.end("BadDigest"); return; }
      objects.set(url.pathname, { body, sha256: req.headers["x-amz-meta-sha256"] });
      res.writeHead(200); res.end(); return;
    }
    if (req.method === "HEAD" || req.method === "GET") {
      if (url.searchParams.get("list-type") === "2") {
        const prefix = `${url.pathname}/${url.searchParams.get("prefix")}`;
        const keys = [...objects.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(url.pathname.length + 1));
        res.writeHead(200, { "content-type": "application/xml" });
        res.end(`<ListBucketResult>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("")}<IsTruncated>false</IsTruncated></ListBucketResult>`);
        return;
      }
      const obj = objects.get(url.pathname);
      if (!obj) { res.writeHead(404); res.end(); return; }
      const out = corruptOnGet ? Buffer.concat([obj.body.subarray(0, 100), Buffer.from("garbage"), obj.body.subarray(107)]) : obj.body;
      res.writeHead(200, { "content-length": String(obj.body.length), "x-amz-meta-sha256": obj.sha256 });
      res.end(req.method === "GET" ? out : undefined);
      return;
    }
    res.writeHead(405); res.end();
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, objects, endpoint: `http://127.0.0.1:${server.address().port}` })));
}

function makeDataDir() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "offsite-"));
  const db = new DatabaseSync(path.join(dataDir, "mirocard.db"));
  db.exec("CREATE TABLE accounts (id TEXT PRIMARY KEY); INSERT INTO accounts VALUES ('a1'), ('a2');");
  db.exec("CREATE TABLE students (id TEXT PRIMARY KEY); INSERT INTO students VALUES ('s1');");
  db.close();
  return dataDir;
}

test("off-site: snapshot is uploaded with checksums, verified by size + SHA-256, then restored and integrity-checked", async () => {
  const s3 = await startFakeS3();
  try {
    const dataDir = makeDataDir();
    const snapshotPath = runBackupOnce({ dataDir, now: new Date(NOW) });
    const config = { ...CREDS, endpoint: s3.endpoint, bucket: "mirocard-backups", prefix: "mirocard/sqlite/", everyHours: 6 };
    const up = await maybeUploadOffsite({ snapshotPath, backupDir: path.join(dataDir, "backups"), config, now: new Date(NOW) });
    assert.equal(up.status, "uploaded");
    assert.equal(up.size, readFileSync(snapshotPath).length);

    // Not due again within everyHours.
    const again = await maybeUploadOffsite({ snapshotPath, backupDir: path.join(dataDir, "backups"), config, now: new Date(NOW + HOUR) });
    assert.equal(again.status, "not_due");

    const out = path.join(mkdtempSync(path.join(tmpdir(), "restore-")), "restored.db");
    const restored = await restoreBackup({ fromS3: "latest", out, config });
    assert.equal(restored.integrity, "ok");
    assert.equal(restored.counts.accounts, 2);
    assert.equal(restored.counts.students, 1);
    assert.equal(restored.source.sha256, up.sha256);

    await assert.rejects(restoreBackup({ fromS3: "latest", out, config }), /already exists/, "never overwrites without --force");
  } finally {
    s3.server.close();
  }
});

test("off-site: a corrupted download is detected and nothing is written", async () => {
  const s3 = await startFakeS3({ corruptOnGet: true });
  try {
    const dataDir = makeDataDir();
    const snapshotPath = runBackupOnce({ dataDir, now: new Date(NOW) });
    const config = { ...CREDS, endpoint: s3.endpoint, bucket: "b", prefix: "p/", everyHours: 6 };
    await maybeUploadOffsite({ snapshotPath, backupDir: path.join(dataDir, "backups"), config, now: new Date(NOW) });
    const out = path.join(mkdtempSync(path.join(tmpdir(), "restore-bad-")), "restored.db");
    await assert.rejects(restoreBackup({ fromS3: "latest", out, config }), /corrupt: sha256/);
    assert.equal(existsSync(out), false);
  } finally {
    s3.server.close();
  }
});

test("off-site: wrong credentials fail loudly (signature rejected), no state recorded", async () => {
  const s3 = await startFakeS3();
  try {
    const dataDir = makeDataDir();
    const snapshotPath = runBackupOnce({ dataDir, now: new Date(NOW) });
    const config = { ...CREDS, secretAccessKey: "wrong", endpoint: s3.endpoint, bucket: "b", prefix: "p/", everyHours: 6 };
    await assert.rejects(maybeUploadOffsite({ snapshotPath, backupDir: path.join(dataDir, "backups"), config, now: new Date(NOW) }), /HTTP 403/);
    assert.equal(existsSync(path.join(dataDir, "backups", "offsite-state.json")), false);
  } finally {
    s3.server.close();
  }
});

test("off-site not configured: app keeps going, structured warning is emitted", async () => {
  const result = await maybeUploadOffsite({ snapshotPath: "/nonexistent", backupDir: "/nonexistent", config: { endpoint: "", bucket: "" } });
  assert.equal(result.status, "not_configured");
  const warnings = [];
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = (msg) => warnings.push(msg);
  console.error = () => {};
  try {
    assert.equal(warnIfOffsiteNotConfigured({ endpoint: "" }), true);
  } finally {
    console.warn = origWarn;
    console.error = origError;
  }
  const parsed = JSON.parse(warnings[0]);
  assert.equal(parsed.level, "warn");
  assert.equal(parsed.code, "offsite_backup_not_configured");
});

test("restore from a local file verifies integrity; a non-SQLite file is refused", async () => {
  const dataDir = makeDataDir();
  const snapshotPath = runBackupOnce({ dataDir, now: new Date(NOW) });
  const out = path.join(mkdtempSync(path.join(tmpdir(), "restore-file-")), "r.db");
  const result = await restoreBackup({ file: snapshotPath, out });
  assert.equal(result.integrity, "ok");
  assert.deepEqual(verifyRestoredDb(out).counts, { accounts: 2, students: 1 });

  const junk = path.join(dataDir, "junk.db");
  writeFileSync(junk, "definitely not sqlite");
  await assert.rejects(restoreBackup({ file: junk, out: `${out}.2` }));
  assert.equal(existsSync(`${out}.2`), false);
});
