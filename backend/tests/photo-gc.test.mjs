import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import {
  createAccount,
  upsertStudent,
  upsertStudentMyPeople,
  upsertAccountKv,
  extractAndStorePhoto,
  getPhoto,
} from "../lib/account-repository.mjs";
import { collectReferencedPhotoHashes, pruneOrphanPhotos } from "../lib/photo-gc.mjs";

const OLD = "2026-01-01T00:00:00.000Z";
const NOW = new Date("2026-09-30T00:00:00.000Z");

function setup() {
  const db = initDb(":memory:");
  const account = createAccount(db, { email: "gc@example.com", passwordHash: "x" });
  upsertStudent(db, account.id, { id: "s1", name: "Миша" });
  return { db, accountId: account.id };
}

function store(db, content, createdAt = OLD) {
  const url = extractAndStorePhoto(db, `data:image/jpeg;base64,${content}`);
  db.prepare("UPDATE photos SET created_at = ? WHERE hash = ?").run(createdAt, url.split("/").at(-1));
  return url;
}

const hashOf = (url) => url.split("/").at(-1);

test("keeps photos referenced anywhere and prunes old orphans only", () => {
  const { db, accountId } = setup();
  const person = store(db, "PERSON");
  const instruction = store(db, "INSTRUCTION");
  const oldOrphan = store(db, "ORPHAN");
  const youngOrphan = store(db, "YOUNG", "2026-09-25T00:00:00.000Z");
  for (const filler of ["A", "B", "C"]) upsertAccountKv(db, accountId, `k${filler}`, { url: store(db, filler) });

  upsertStudentMyPeople(db, accountId, { studentId: "s1", people: [{ id: "p1", photos: [person], updatedAt: OLD }], updatedAt: OLD });
  upsertAccountKv(db, accountId, "user_instructions", [{ steps: [{ photo: instruction }] }]);

  assert.ok(collectReferencedPhotoHashes(db).has(hashOf(instruction)), "account_kv references are found without being listed");

  const result = pruneOrphanPhotos(db, { now: NOW });

  assert.equal(result.deleted, 1);
  assert.equal(getPhoto(db, hashOf(oldOrphan)), null);
  assert.ok(getPhoto(db, hashOf(person)));
  assert.ok(getPhoto(db, hashOf(instruction)));
  assert.ok(getPhoto(db, hashOf(youngOrphan)), "inside the grace period a queued sync op may still reference it");
});

test("refuses to delete when most of the store looks orphaned", () => {
  const { db } = setup();
  for (let i = 0; i < 12; i += 1) store(db, `LOST${i}`);

  const result = pruneOrphanPhotos(db, { now: NOW });

  assert.equal(result.aborted, true);
  assert.equal(result.deleted, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM photos").get().n, 12);
});

test("a deleted person's tombstone no longer keeps its photos alive", () => {
  const { db, accountId } = setup();
  const photo = store(db, "GONE");
  upsertStudentMyPeople(db, accountId, { studentId: "s1", people: [{ id: "p1", photos: [photo], updatedAt: OLD }], updatedAt: OLD });

  upsertStudentMyPeople(db, accountId, {
    studentId: "s1",
    people: [{ id: "p1", photos: [photo], deletedAt: "2026-02-01T00:00:00.000Z" }],
    updatedAt: "2026-02-01T00:00:00.000Z",
  });

  assert.equal(collectReferencedPhotoHashes(db).has(hashOf(photo)), false);
});

test("re-uploading an orphaned photo restarts its grace period", () => {
  const { db } = setup();
  const url = store(db, "BACK");

  extractAndStorePhoto(db, "data:image/jpeg;base64,BACK");

  assert.ok(getPhoto(db, hashOf(url)));
  assert.ok(db.prepare("SELECT created_at FROM photos WHERE hash = ?").get(hashOf(url)).created_at > OLD);
});

test("dry run reports what it would delete and deletes nothing", () => {
  const { db, accountId } = setup();
  const kept = store(db, "KEPT");
  for (const filler of ["A", "B", "C"]) upsertAccountKv(db, accountId, `k${filler}`, { url: store(db, filler) });
  upsertAccountKv(db, accountId, "kept", { url: kept });
  const orphan = store(db, "ORPHAN");

  const result = pruneOrphanPhotos(db, { now: NOW, dryRun: true });

  assert.equal(result.orphans, 1);
  assert.ok(result.orphanBytes > 0);
  assert.equal(result.deleted, 0);
  assert.ok(getPhoto(db, hashOf(orphan)));
});
