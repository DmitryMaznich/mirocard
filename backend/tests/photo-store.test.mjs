import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

const { initDb } = await import("../lib/db.mjs");
const { createAccount, activateAccount, upsertStudent, getStudents } = await import("../lib/account-repository.mjs");
const {
  storePhotoDataUrl, getOwnedPhoto, accountOwnsPhoto, getPhotoUsage, releaseUnreferencedPhotos,
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

test("a replaced (no longer referenced) photo stops counting after the grace period, but stays readable", async () => {
  const db = initDb(":memory:");
  const a = account(db);
  const quota = { maxPhotos: 1, maxBytes: 100 * 1024 * 1024, graceHours: 24 };
  const ref1 = await storePhotoDataUrl(db, a.id, await dataUrl(30), { quota });
  upsertStudent(db, a.id, { id: "st1", name: "Аня", photo: ref1 });
  // Referenced -> never released, even long after the grace period.
  assert.equal(releaseUnreferencedPhotos(db, a.id, { at: "2099-01-01T00:00:00.000Z" }), 0);
  await assert.rejects(storePhotoDataUrl(db, a.id, await dataUrl(31), { quota }), { code: "photo_count_quota" });

  // Photo replaced: the student no longer references ref1.
  db.prepare("UPDATE students SET photo = NULL WHERE id = 'st1'").run();
  db.prepare("UPDATE photo_owners SET created_at = '2000-01-01T00:00:00.000Z' WHERE account_id = ?").run(a.id);
  const ref2 = await storePhotoDataUrl(db, a.id, await dataUrl(31), { quota });
  assert.ok(ref2, "quota freed once the old photo was released");
  assert.ok(getOwnedPhoto(db, a.id, hashOf(ref1)), "released photo is still readable by its owner");
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
