import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

const { initDb } = await import("../lib/db.mjs");
const { createAccount, activateAccount, upsertStudent, getStudents } = await import("../lib/account-repository.mjs");
const {
  storePhotoDataUrl, getOwnedPhoto, accountOwnsPhoto, getPhotoUsage, pruneUnreferencedPhotoLinks, collectPhotoGarbage,
  backfillPhotoOwnership, runPhotoOwnershipBackfillOnce, migratePhotoStoreSchema, migrateLegacyDataUrlPhotos, resolveSyncOperationPhotos, PhotoQuotaError,
} = await import("../lib/photo-store.mjs");
const { processSync } = await import("../lib/sync-processor.mjs");

let n = 0;
function account(db) {
  n += 1;
  const acc = createAccount(db, { email: `store${n}@x.test`, passwordHash: "h" });
  activateAccount(db, acc.id);
  return acc;
}

async function dataUrl(seed, size = 400) {
  const buf = await sharp({ create: { width: size, height: size, channels: 3, background: { r: seed % 256, g: (seed * 7) % 256, b: 90 } } })
    .jpeg().toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const hashOf = (ref) => ref.split("/").at(-1);

test("storing links the photo to its owner; only the owner can read it; bytes are WebP BLOBs", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const b = account(db);
  const ref = await storePhotoDataUrl(db, a.id, await dataUrl(1));
  assert.match(ref, /^\/api\/photos\/[0-9a-f]{32}$/);
  const photo = getOwnedPhoto(db, a.id, hashOf(ref));
  assert.equal(photo.content_type, "image/webp");
  assert.ok(photo.data instanceof Uint8Array, "stored as BLOB, not base64 text");
  assert.equal(getOwnedPhoto(db, b.id, hashOf(ref)), null, "another account cannot read it");
  assert.equal(getOwnedPhoto(db, a.id, "../../etc/passwd"), null);
});

test("identical bytes from two accounts are stored once but owned by both", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const b = account(db);
  const url = await dataUrl(2);
  const refA = await storePhotoDataUrl(db, a.id, url);
  const refB = await storePhotoDataUrl(db, b.id, url);
  assert.equal(refA, refB);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 1);
  assert.ok(accountOwnsPhoto(db, a.id, hashOf(refA)));
  assert.ok(accountOwnsPhoto(db, b.id, hashOf(refB)));
});

test("re-uploading the same photo does not consume quota twice", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const url = await dataUrl(3);
  await storePhotoDataUrl(db, a.id, url);
  const before = getPhotoUsage(db, a.id);
  await storePhotoDataUrl(db, a.id, url);
  assert.deepEqual(getPhotoUsage(db, a.id), before);
  assert.equal(before.count, 1);
});

test("photo-count quota: the (N+1)th distinct photo is rejected with a friendly message", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const quota = { maxPhotos: 2, maxBytes: 100 * 1024 * 1024, graceHours: 24 };
  await storePhotoDataUrl(db, a.id, await dataUrl(10), { quota });
  await storePhotoDataUrl(db, a.id, await dataUrl(11), { quota });
  await assert.rejects(storePhotoDataUrl(db, a.id, await dataUrl(12), { quota }), (err) => {
    assert.ok(err instanceof PhotoQuotaError);
    assert.equal(err.code, "photo_count_quota");
    assert.match(err.message, /лимит фото: 2/);
    assert.match(err.message, /Удалите или замените/);
    return true;
  });
  assert.equal(getPhotoUsage(db, a.id).count, 2, "rejected photo was not stored/linked");
});

test("photo-storage quota: exceeding the byte budget is rejected with how much is used", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const first = await storePhotoDataUrl(db, a.id, await dataUrl(20, 900));
  const used = getPhotoUsage(db, a.id).bytes;
  assert.ok(used > 0);
  const quota = { maxPhotos: 50, maxBytes: used + 10, graceHours: 24 };
  await assert.rejects(storePhotoDataUrl(db, a.id, await dataUrl(21, 900), { quota }), (err) => {
    assert.equal(err.code, "photo_storage_quota");
    assert.match(err.message, /Закончилось место для фото: занято/);
    return true;
  });
  assert.ok(first);
});

test("a replaced (no longer referenced) photo is unlinked and its bytes deleted after the grace period", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const quota = { maxPhotos: 1, maxBytes: 100 * 1024 * 1024, graceHours: 24 };
  const ref1 = await storePhotoDataUrl(db, a.id, await dataUrl(30), { quota });
  upsertStudent(db, a.id, { id: "st1", name: "Аня", photo: ref1 });
  // Referenced -> never pruned, even long after the grace period.
  assert.deepEqual(pruneUnreferencedPhotoLinks(db, a.id, { at: "2099-01-01T00:00:00.000Z" }), []);
  await assert.rejects(storePhotoDataUrl(db, a.id, await dataUrl(31), { quota }), { code: "photo_count_quota" });

  // Photo replaced: the student no longer references ref1; grace period passes.
  db.prepare("UPDATE students SET photo = NULL WHERE id = 'st1'").run();
  db.prepare("UPDATE photo_owners SET created_at = '2000-01-01T00:00:00.000Z' WHERE account_id = ?").run(a.id);
  const ref2 = await storePhotoDataUrl(db, a.id, await dataUrl(31), { quota });
  assert.ok(ref2, "quota freed once the old photo was unlinked");
  assert.equal(getOwnedPhoto(db, a.id, hashOf(ref1)), null, "old photo no longer served");
  db.prepare("UPDATE students SET photo = ? WHERE id = 'st1'").run(ref2);
  // Once the grace period has passed for the old bytes too, they are deleted.
  collectPhotoGarbage(db, { at: new Date(Date.now() + 25 * 3_600_000).toISOString() });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos WHERE hash = ?").get(hashOf(ref1)).n, 0, "old bytes physically deleted");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos WHERE hash = ?").get(hashOf(ref2)).n, 1, "current photo kept");
});

test("a freshly uploaded but not-yet-referenced photo still counts (no quota bypass via POST /photos)", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const quota = { maxPhotos: 1, maxBytes: 100 * 1024 * 1024, graceHours: 24 };
  await storePhotoDataUrl(db, a.id, await dataUrl(40), { quota });
  await assert.rejects(storePhotoDataUrl(db, a.id, await dataUrl(41), { quota }), { code: "photo_count_quota" });
});

test("sync pre-pass: data: photos become owned refs; a rejected photo drops only its operation and is reported", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  upsertStudent(db, a.id, { id: "st2", name: "Боря" });
  const good = await dataUrl(50);
  const ops = [
    { type: "student.photo.upsert", data: { studentId: "st2", photo: good, photoUpdatedAt: "2026-09-24T10:00:00.000Z" } },
    { type: "student.adults.upsert", data: { studentId: "st2", closeAdults: [{ id: "m", name: "Мама", photo: "data:image/png;base64,bm90IGFuIGltYWdl" }], updatedAt: "2026-09-24T10:00:00.000Z" } },
    { type: "student.my_people.upsert", data: { studentId: "st2", people: [{ id: "p1", name: "Дед", photos: [good], updatedAt: "2026-09-24T10:00:00.000Z" }], updatedAt: "2026-09-24T10:00:00.000Z" } },
  ];
  const { accepted, rejected } = await resolveSyncOperationPhotos(db, a.id, ops);
  assert.equal(accepted.length, 2);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].type, "student.adults.upsert");
  assert.equal(rejected[0].code, "not_image");
  processSync(db, a.id, accepted);
  const st = getStudents(db, a.id).find((s) => s.id === "st2");
  assert.match(st.photo, /^\/api\/photos\/[0-9a-f]{32}$/);
  assert.ok(accountOwnsPhoto(db, a.id, hashOf(st.photo)));
  assert.ok(!st.my_people.includes("data:"), "no raw data: URL stored");
  assert.equal(JSON.parse(st.my_people)[0].photos[0], st.photo, "same photo deduped to the same ref");
});

test("writing someone else's photo hash into your own record does not grant access to it", async () => {
  const db = initDb(":memory:");
  const victim = account(db);
  const attacker = account(db);
  const victimRef = await storePhotoDataUrl(db, victim.id, await dataUrl(60));
  upsertStudent(db, attacker.id, { id: "st3", name: "X" });
  const { accepted } = await resolveSyncOperationPhotos(db, attacker.id, [
    { type: "student.photo.upsert", data: { studentId: "st3", photo: victimRef, photoUpdatedAt: "2026-09-24T10:00:00.000Z" } },
  ]);
  processSync(db, attacker.id, accepted);
  assert.equal(getOwnedPhoto(db, attacker.id, hashOf(victimRef)), null);
  // ...and neither does a later startup: the reference backfill runs once per database.
  assert.equal(runPhotoOwnershipBackfillOnce(db), null, "already applied by initDb");
  assert.equal(getOwnedPhoto(db, attacker.id, hashOf(victimRef)), null);
});

test("backfill links photos already referenced by existing data (student, closeAdults, MyPeople, kv); idempotent", () => {
  const db = initDb(":memory:");
  const a = account(db);
  const put = (hash) => db.prepare("INSERT INTO photos (hash, content_type, data, created_at) VALUES (?, 'image/jpeg', 'AAAA', 'x')").run(hash);
  const h = (i) => String(i).padStart(32, "0");
  [1, 2, 3, 4].forEach((i) => put(h(i)));
  db.prepare("DELETE FROM photo_owners").run();
  db.prepare(`INSERT INTO students (id, account_id, name, comment, primary_language, photo, close_adults, my_people, created_at, updated_at)
              VALUES ('s', ?, 'n', '', 'ru', ?, ?, ?, 'x', 'x')`).run(
    a.id, `/api/photos/${h(1)}`, JSON.stringify([{ photo: `/api/photos/${h(2)}` }]), JSON.stringify([{ photos: [`/api/photos/${h(3)}`] }]),
  );
  db.prepare("INSERT INTO account_kv (account_id, key, value, updated_at) VALUES (?, 'user_instructions', ?, 'x')")
    .run(a.id, JSON.stringify([{ steps: [{ photo: `/api/photos/${h(4)}` }, { photo: "/api/photos/ffffffffffffffffffffffffffffffff" }] }]));
  assert.equal(backfillPhotoOwnership(db), 4, "links the 4 existing photos, skips a dangling ref");
  assert.equal(backfillPhotoOwnership(db), 0, "second run is a no-op");
  for (const i of [1, 2, 3, 4]) assert.ok(accountOwnsPhoto(db, a.id, h(i)));
  // byte_size is computed for legacy base64 rows ("AAAA" = 3 bytes) by the schema step.
  migratePhotoStoreSchema(db);
  assert.equal(db.prepare("SELECT byte_size FROM photos WHERE hash = ?").get(h(1)).byte_size, 3);
});

test("legacy data: URLs in student rows are normalized to owned WebP refs; broken ones are left untouched", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const good = await dataUrl(70);
  const broken = "data:image/jpeg;base64,bm90IGFuIGltYWdl";
  db.prepare(`INSERT INTO students (id, account_id, name, comment, primary_language, photo, close_adults, my_people, created_at, updated_at)
              VALUES ('legacy', ?, 'n', '', 'ru', ?, ?, ?, 'x', 'x')`).run(
    a.id, good, JSON.stringify([{ id: "m", photo: good }, { id: "d", photo: broken }]), JSON.stringify([{ id: "p", photos: [good] }]),
  );
  const result = await migrateLegacyDataUrlPhotos(db);
  assert.equal(result.converted, 3);
  assert.equal(result.failed, 1);
  const row = db.prepare("SELECT photo, close_adults, my_people FROM students WHERE id = 'legacy'").get();
  assert.match(row.photo, /^\/api\/photos\//);
  assert.ok(accountOwnsPhoto(db, a.id, hashOf(row.photo)));
  const adults = JSON.parse(row.close_adults);
  assert.equal(adults[0].photo, row.photo);
  assert.equal(adults[1].photo, broken, "unreadable legacy photo kept as-is, never dropped");
  assert.equal(JSON.parse(row.my_people)[0].photos[0], row.photo);
  const again = await migrateLegacyDataUrlPhotos(db);
  assert.equal(again.converted, 0, "idempotent: nothing left to convert");
});

// ─── Physical cleanup: SQLite must not grow with repeated replacement ───────

const HOUR = 3_600_000;
const later = (hours) => new Date(Date.now() + hours * HOUR).toISOString();

test("replacing a photo 40 times keeps SQLite bounded: old bytes are physically deleted", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  upsertStudent(db, a.id, { id: "loop", name: "Лена" });
  let maxRows = 0;
  let maxBytes = 0;
  for (let i = 0; i < 40; i += 1) {
    const ref = await storePhotoDataUrl(db, a.id, await dataUrl(1000 + i * 37, 500));
    db.prepare("UPDATE students SET photo = ? WHERE id = 'loop'").run(ref);
    collectPhotoGarbage(db, { at: later(25) }); // grace period has passed for everything older
    const { n, bytes } = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(byte_size), 0) bytes FROM photos").get();
    maxRows = Math.max(maxRows, n);
    maxBytes = Math.max(maxBytes, bytes);
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 1, "only the current photo remains");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photo_owners").get().n, 1);
  assert.ok(maxRows <= 2, `rows never exceeded 2 (was ${maxRows})`);
  const oneMax = 650 * 1024;
  assert.ok(maxBytes <= 2 * oneMax, `bytes stayed bounded (${maxBytes})`);
});

test("without the grace period passing, nothing is deleted (in-flight uploads are safe)", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  await storePhotoDataUrl(db, a.id, await dataUrl(2001)); // uploaded, not yet referenced
  const r = collectPhotoGarbage(db);
  assert.deepEqual(r, { linksRemoved: 0, photosRemoved: 0, bytesFreed: 0 });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 1);
});

test("a photo still owned by another account keeps its bytes when one owner drops it", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const b = account(db);
  const url = await dataUrl(2100);
  const ref = await storePhotoDataUrl(db, a.id, url);
  await storePhotoDataUrl(db, b.id, url);
  upsertStudent(db, b.id, { id: "b-kid", name: "B", photo: ref });
  collectPhotoGarbage(db, { at: later(25) });
  assert.equal(accountOwnsPhoto(db, a.id, hashOf(ref)), false, "A's unused link removed");
  assert.ok(getOwnedPhoto(db, b.id, hashOf(ref)), "B still has it");
});

test("bytes still referenced by some account's data are never deleted, even without an owner link", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const ref = await storePhotoDataUrl(db, a.id, await dataUrl(2200));
  db.prepare("DELETE FROM photo_owners").run();
  upsertStudent(db, a.id, { id: "kept", name: "K", photo: ref });
  collectPhotoGarbage(db, { at: later(25) });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 1);
});

test("legacy photos (stored before the ownership migration) are never deleted automatically", () => {
  const db = initDb(":memory:");
  db.prepare("INSERT INTO photos (hash, content_type, data, created_at, byte_size) VALUES (?, 'image/jpeg', 'AAAA', '2020-01-01T00:00:00.000Z', 3)")
    .run("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  collectPhotoGarbage(db, { at: later(10_000) });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n, 1);
});

test("a sync batch that stores a photo and then another one can't prune the first before it is referenced", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  upsertStudent(db, a.id, { id: "batch", name: "B" });
  const first = await dataUrl(2300);
  // An old, unreferenced link to the same bytes (e.g. uploaded days ago).
  const oldRef = await storePhotoDataUrl(db, a.id, first);
  db.prepare("UPDATE photo_owners SET created_at = '2000-01-01T00:00:00.000Z'").run();
  const { accepted } = await resolveSyncOperationPhotos(db, a.id, [
    { type: "student.photo.upsert", data: { studentId: "batch", photo: first, photoUpdatedAt: "2026-09-24T10:00:00.000Z" } },
    { type: "student.adults.upsert", data: { studentId: "batch", closeAdults: [{ id: "m", photo: await dataUrl(2301) }], updatedAt: "2026-09-24T10:00:00.000Z" } },
  ]);
  processSync(db, a.id, accepted);
  assert.ok(getOwnedPhoto(db, a.id, hashOf(oldRef)), "re-stored photo survived the second op's quota prune");
});
