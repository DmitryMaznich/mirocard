// Content-addressed photo store with per-account ownership and quotas.
//
// `photos` stays a physically de-duplicated store keyed by content hash.
// `photo_owners` records which accounts own each hash: GET /photos/:hash is
// served only to an owner (404 for everyone else, so a known hash doesn't
// even confirm the photo exists). Ownership is created only by actually
// storing image bytes (upload / sync data: URL / legacy migration) or by the
// one-time backfill from references already in the database -- never from a
// client merely *mentioning* a /api/photos/<hash> URL, or anyone could claim
// another account's photo by writing its hash into their own student record.
//
// Quota: an owner link counts toward MAX_PHOTOS_PER_ACCOUNT and
// MAX_PHOTO_STORAGE_BYTES_PER_ACCOUNT while it is "active". A link the
// account no longer references anywhere (photo replaced or deleted) is
// marked released after PHOTO_UNREFERENCED_GRACE_HOURS and stops counting;
// the account keeps read access to it (it did upload those bytes), and
// storing or referencing it again re-activates it.

import {
  MAX_PHOTOS_PER_ACCOUNT, MAX_PHOTO_STORAGE_BYTES_PER_ACCOUNT, PHOTO_UNREFERENCED_GRACE_HOURS,
} from "./config.mjs";
import { normalizePhotoDataUrl, PhotoRejectedError } from "./photo-normalizer.mjs";

function now() { return new Date().toISOString(); }

const PHOTO_REF_RE = /\/api\/photos\/([0-9a-f]{32})/g;
const OWNERSHIP_BACKFILL_MIGRATION = "photo_ownership_backfill_v1";

export class PhotoQuotaError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "PhotoQuotaError";
    this.code = code;
    this.details = details;
  }
}

function formatMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",");
}

// ─── Schema (called from initDb) ─────────────────────────────────────────────

export function migratePhotoStoreSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS photo_owners (
      hash        TEXT NOT NULL,
      account_id  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      released_at TEXT,
      PRIMARY KEY (hash, account_id)
    );
    CREATE INDEX IF NOT EXISTS idx_photo_owners_account ON photo_owners(account_id);
  `);
  const cols = db.prepare("PRAGMA table_info(photos)").all().map((c) => c.name);
  if (!cols.includes("byte_size")) {
    db.exec("ALTER TABLE photos ADD COLUMN byte_size INTEGER");
  }
  // Legacy rows store base64 TEXT; new rows store raw BLOB. byte_size is the
  // decoded size either way. Only fills NULLs, so re-running is a no-op.
  db.exec(`
    UPDATE photos SET byte_size = CASE
      WHEN typeof(data) = 'blob' THEN length(data)
      ELSE (length(data) * 3 / 4) - (CASE WHEN data LIKE '%==' THEN 2 WHEN data LIKE '%=' THEN 1 ELSE 0 END)
    END
    WHERE byte_size IS NULL
  `);
}

// ─── References ──────────────────────────────────────────────────────────────

function collectRefs(text, into) {
  if (typeof text !== "string" || !text.includes("/api/photos/")) return;
  for (const m of text.matchAll(PHOTO_REF_RE)) into.add(m[1]);
}

/** Every photo hash the account's stored data currently points at. */
export function referencedPhotoHashes(db, accountId) {
  const refs = new Set();
  const students = db.prepare(
    "SELECT photo, close_adults, my_people, my_people_profile FROM students WHERE account_id = ? AND deleted_at IS NULL",
  ).all(accountId);
  for (const s of students) {
    collectRefs(s.photo, refs);
    collectRefs(s.close_adults, refs);
    collectRefs(s.my_people, refs);
    collectRefs(s.my_people_profile, refs);
  }
  for (const row of db.prepare("SELECT value FROM account_kv WHERE account_id = ?").all(accountId)) {
    collectRefs(row.value, refs);
  }
  return refs;
}

export function extractPhotoRefs(value) {
  const refs = new Set();
  collectRefs(typeof value === "string" ? value : JSON.stringify(value ?? null), refs);
  return refs;
}

// ─── Ownership ───────────────────────────────────────────────────────────────

export function accountOwnsPhoto(db, accountId, hash) {
  return Boolean(db.prepare("SELECT 1 FROM photo_owners WHERE hash = ? AND account_id = ?").get(hash, accountId));
}

export function getOwnedPhoto(db, accountId, hash) {
  if (!/^[0-9a-f]{32}$/.test(hash) || !accountOwnsPhoto(db, accountId, hash)) return null;
  return db.prepare("SELECT content_type, data FROM photos WHERE hash = ?").get(hash) ?? null;
}

function cutoffFor(at, graceHours) {
  return new Date(new Date(at).getTime() - graceHours * 3600_000).toISOString();
}

// photo_owners.created_at is the link's "last touched" time: set when the
// photo is stored, refreshed when it is stored again or referenced by an
// incoming sync operation. The grace period is measured from it.
// (released_at is a leftover of an earlier design and is no longer set.)

/**
 * Deletes the account's links to photos it no longer references anywhere
 * and hasn't touched within the grace period. Returns the unlinked hashes.
 */
export function pruneUnreferencedPhotoLinks(db, accountId, { at = now(), graceHours = PHOTO_UNREFERENCED_GRACE_HOURS } = {}) {
  const cutoff = cutoffFor(at, graceHours);
  const candidates = db.prepare(
    "SELECT hash FROM photo_owners WHERE account_id = ? AND created_at < ?",
  ).all(accountId, cutoff);
  if (!candidates.length) return [];
  const refs = referencedPhotoHashes(db, accountId);
  const del = db.prepare("DELETE FROM photo_owners WHERE hash = ? AND account_id = ?");
  const removed = [];
  for (const { hash } of candidates) {
    if (!refs.has(hash)) { del.run(hash, accountId); removed.push(hash); }
  }
  return removed;
}

/** Keeps owned photos an incoming operation references from being pruned mid-flight. */
export function touchReferencedPhotoLinks(db, accountId, hashes) {
  const stmt = db.prepare("UPDATE photo_owners SET created_at = ?, released_at = NULL WHERE hash = ? AND account_id = ?");
  const ts = now();
  for (const hash of hashes) stmt.run(ts, hash, accountId);
}

function globallyReferencedHashes(db) {
  const refs = new Set();
  for (const s of db.prepare("SELECT photo, close_adults, my_people, my_people_profile FROM students WHERE deleted_at IS NULL").all()) {
    collectRefs(s.photo, refs);
    collectRefs(s.close_adults, refs);
    collectRefs(s.my_people, refs);
    collectRefs(s.my_people_profile, refs);
  }
  for (const row of db.prepare("SELECT value FROM account_kv").all()) collectRefs(row.value, refs);
  return refs;
}

function ownershipEpoch(db) {
  return db.prepare("SELECT applied_at FROM app_migrations WHERE name = ?").get(OWNERSHIP_BACKFILL_MIGRATION)?.applied_at ?? null;
}

/**
 * Physically deletes photo bytes nobody owns or references any more:
 * no photo_owners link, no reference in any account's data, older than the
 * grace period. Photos stored before the ownership migration (legacy rows)
 * are never deleted automatically. Returns { removed, bytes }.
 */
export function deleteOrphanPhotos(db, { at = now(), graceHours = PHOTO_UNREFERENCED_GRACE_HOURS, hashes = null } = {}) {
  const epoch = ownershipEpoch(db);
  if (!epoch) return { removed: 0, bytes: 0 };
  const cutoff = cutoffFor(at, graceHours);
  const orphanSql = `
    SELECT p.hash, COALESCE(p.byte_size, 0) AS bytes FROM photos p
    WHERE p.created_at >= ? AND p.created_at < ?
      AND NOT EXISTS (SELECT 1 FROM photo_owners o WHERE o.hash = p.hash)`;
  let orphans = db.prepare(orphanSql).all(epoch, cutoff);
  if (hashes) {
    const only = new Set(hashes);
    orphans = orphans.filter((o) => only.has(o.hash));
  }
  if (!orphans.length) return { removed: 0, bytes: 0 };
  const refs = globallyReferencedHashes(db);
  const del = db.prepare("DELETE FROM photos WHERE hash = ? AND NOT EXISTS (SELECT 1 FROM photo_owners o WHERE o.hash = photos.hash)");
  let removed = 0;
  let bytes = 0;
  for (const o of orphans) {
    if (refs.has(o.hash)) continue;
    if (del.run(o.hash).changes) { removed += 1; bytes += o.bytes; }
  }
  return { removed, bytes };
}

/** Full sweep over every account (hourly on Railway, and at startup). */
export function collectPhotoGarbage(db, { at = now(), graceHours = PHOTO_UNREFERENCED_GRACE_HOURS } = {}) {
  let linksRemoved = 0;
  for (const { account_id: accountId } of db.prepare("SELECT DISTINCT account_id FROM photo_owners").all()) {
    linksRemoved += pruneUnreferencedPhotoLinks(db, accountId, { at, graceHours }).length;
  }
  const { removed, bytes } = deleteOrphanPhotos(db, { at, graceHours });
  if (linksRemoved || removed) {
    console.log(`[photos] gc: unlinked=${linksRemoved} deleted=${removed} freedBytes=${bytes}`);
  }
  return { linksRemoved, photosRemoved: removed, bytesFreed: bytes };
}

export function getPhotoUsage(db, accountId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(p.byte_size), 0) AS bytes
    FROM photo_owners o JOIN photos p ON p.hash = o.hash
    WHERE o.account_id = ?
  `).get(accountId);
  return { count: row.count, bytes: row.bytes };
}

function assertWithinQuota(db, accountId, addBytes, limits) {
  // Free what this account no longer uses before judging the limit -- and
  // delete those bytes for real, so replacing photos can't grow the DB.
  const unlinked = pruneUnreferencedPhotoLinks(db, accountId, { graceHours: limits.graceHours });
  if (unlinked.length) deleteOrphanPhotos(db, { graceHours: limits.graceHours, hashes: unlinked });
  const usage = getPhotoUsage(db, accountId);
  if (usage.count + 1 > limits.maxPhotos) {
    throw new PhotoQuotaError(
      "photo_count_quota",
      `Достигнут лимит фото: ${limits.maxPhotos} на аккаунт. Удалите или замените одно из загруженных фото (ученика, близких, «Моих людей» или инструкций), и место освободится.`,
      { ...usage, maxPhotos: limits.maxPhotos, maxBytes: limits.maxBytes },
    );
  }
  if (usage.bytes + addBytes > limits.maxBytes) {
    throw new PhotoQuotaError(
      "photo_storage_quota",
      `Закончилось место для фото: занято ${formatMb(usage.bytes)} из ${formatMb(limits.maxBytes)} МБ. Удалите или замените одно из загруженных фото, и место освободится.`,
      { ...usage, maxPhotos: limits.maxPhotos, maxBytes: limits.maxBytes },
    );
  }
}

const DEFAULT_QUOTA = {
  maxPhotos: MAX_PHOTOS_PER_ACCOUNT,
  maxBytes: MAX_PHOTO_STORAGE_BYTES_PER_ACCOUNT,
  graceHours: PHOTO_UNREFERENCED_GRACE_HOURS,
};

/**
 * Stores an already-normalized photo and links it to the account.
 * Re-storing a photo the account already owns costs no quota (and refreshes
 * the link's grace clock). `enforceQuota: false` is only for migrating data
 * that already exists.
 */
export function storeNormalizedPhoto(db, accountId, normalized, { enforceQuota = true, quota = DEFAULT_QUOTA } = {}) {
  const { hash, buffer, contentType, bytes } = normalized;
  const ts = now();
  const link = db.prepare("SELECT 1 FROM photo_owners WHERE hash = ? AND account_id = ?").get(hash, accountId);
  if (enforceQuota && !link) {
    assertWithinQuota(db, accountId, bytes, { ...DEFAULT_QUOTA, ...quota });
  }
  db.prepare(
    "INSERT OR IGNORE INTO photos (hash, content_type, data, created_at, byte_size) VALUES (?, ?, ?, ?, ?)",
  ).run(hash, contentType, buffer, ts, bytes);
  if (link) {
    db.prepare("UPDATE photo_owners SET created_at = ?, released_at = NULL WHERE hash = ? AND account_id = ?").run(ts, hash, accountId);
  } else {
    db.prepare("INSERT OR IGNORE INTO photo_owners (hash, account_id, created_at) VALUES (?, ?, ?)").run(hash, accountId, ts);
  }
  return `/api/photos/${hash}`;
}

export async function storePhotoDataUrl(db, accountId, dataUrl, options = {}) {
  const normalized = await normalizePhotoDataUrl(dataUrl, options.limits);
  return storeNormalizedPhoto(db, accountId, normalized, options);
}

// ─── Sync pre-pass ───────────────────────────────────────────────────────────

// Where each sync operation carries photos. Only these fields are touched.
const PHOTO_FIELDS = {
  "student.upsert": (data) => [
    ["photo", data],
    ...(Array.isArray(data?.closeAdults) ? data.closeAdults.map((a) => ["photo", a]) : []),
  ],
  "student.photo.upsert": (data) => [["photo", data]],
  "student.adults.upsert": (data) => (Array.isArray(data?.closeAdults) ? data.closeAdults.map((a) => ["photo", a]) : []),
  "student.my_people.upsert": (data) => (Array.isArray(data?.people) ? data.people : [])
    .flatMap((person) => (Array.isArray(person?.photos) ? person.photos.map((_, i) => [i, person.photos]) : [])),
};

/**
 * Normalizes and stores every data: URL photo inside sync operations,
 * replacing it with its /api/photos/<hash> URL, before the (synchronous)
 * repository code runs. An operation with a rejected photo is dropped
 * whole and reported back -- never partially applied, which could
 * silently erase the photo the server already has.
 */
export async function resolveSyncOperationPhotos(db, accountId, operations, options = {}) {
  const accepted = [];
  const rejected = [];
  for (const op of operations) {
    const slots = PHOTO_FIELDS[op?.type]?.(op.data) ?? [];
    try {
      for (const [key, holder] of slots) {
        const value = holder?.[key];
        if (typeof value === "string" && value.startsWith("data:")) {
          holder[key] = await storePhotoDataUrl(db, accountId, value, options);
        }
      }
      // Any operation that (re)references a photo the account owns -- incl.
      // kv.upsert for instruction steps -- refreshes that link's grace clock,
      // so a prune in the same batch can't drop it before the reference lands.
      touchReferencedPhotoLinks(db, accountId, extractPhotoRefs(op.data));
      accepted.push(op);
    } catch (err) {
      if (err instanceof PhotoRejectedError || err instanceof PhotoQuotaError) {
        rejected.push({ type: op.type, studentId: op.data?.studentId ?? op.data?.id ?? null, code: err.code, message: err.message });
      } else {
        throw err;
      }
    }
  }
  return { accepted, rejected };
}

// ─── Migrations (startup, idempotent) ────────────────────────────────────────


/** Runs the ownership backfill once, recorded in app_migrations. */
export function runPhotoOwnershipBackfillOnce(db) {
  db.exec("CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  if (db.prepare("SELECT 1 FROM app_migrations WHERE name = ?").get(OWNERSHIP_BACKFILL_MIGRATION)) return null;
  const linked = backfillPhotoOwnership(db);
  db.prepare("INSERT INTO app_migrations (name, applied_at) VALUES (?, ?)").run(OWNERSHIP_BACKFILL_MIGRATION, now());
  if (linked) console.log(`[photos] ownership backfill linked ${linked} existing photo reference(s)`);
  return linked;
}

/**
 * Builds ownership for photos already referenced by existing data. Only
 * links hashes that exist in `photos`; INSERT OR IGNORE makes re-runs no-ops.
 * Never deletes anything.
 *
 * Must run exactly ONCE per database (see runPhotoOwnershipBackfillOnce):
 * after this release, a reference alone must never grant ownership, or
 * writing another account's hash into your own record would be picked up
 * by the next startup's backfill.
 */
export function backfillPhotoOwnership(db) {
  const accounts = db.prepare("SELECT DISTINCT account_id FROM students UNION SELECT DISTINCT account_id FROM account_kv").all();
  const exists = db.prepare("SELECT 1 FROM photos WHERE hash = ?");
  const insert = db.prepare("INSERT OR IGNORE INTO photo_owners (hash, account_id, created_at) VALUES (?, ?, ?)");
  let linked = 0;
  const ts = now();
  for (const { account_id: accountId } of accounts) {
    if (!accountId) continue;
    for (const hash of referencedPhotoHashes(db, accountId)) {
      if (exists.get(hash)) linked += insert.run(hash, accountId, ts).changes;
    }
  }
  return linked;
}

/**
 * Converts legacy inline data: URLs still sitting in student rows (photo,
 * closeAdults, "Мои люди") into normalized, owned WebP photos. A photo that
 * fails normalization is left exactly as it was (logged), never dropped.
 * Quota is not enforced: this is data the account already has.
 */
export async function migrateLegacyDataUrlPhotos(db, options = {}) {
  const rows = db.prepare(`
    SELECT id, account_id, photo, close_adults, my_people FROM students
    WHERE photo LIKE 'data:%' OR close_adults LIKE '%"data:%' OR my_people LIKE '%"data:%'
  `).all();
  let converted = 0;
  let failed = 0;
  const toRef = async (accountId, value) => {
    if (typeof value !== "string" || !value.startsWith("data:")) return value;
    try {
      const ref = await storePhotoDataUrl(db, accountId, value, { ...options, enforceQuota: false });
      converted += 1;
      return ref;
    } catch (err) {
      failed += 1;
      console.warn(`[photos] legacy photo left unchanged (${err.code ?? err.message})`);
      return value;
    }
  };
  for (const row of rows) {
    const photo = await toRef(row.account_id, row.photo);
    let adults;
    try { adults = JSON.parse(row.close_adults ?? "null"); } catch { adults = null; }
    if (Array.isArray(adults)) {
      for (const a of adults) if (a && typeof a === "object") a.photo = await toRef(row.account_id, a.photo);
    }
    let people;
    try { people = JSON.parse(row.my_people ?? "null"); } catch { people = null; }
    if (Array.isArray(people)) {
      for (const p of people) {
        if (p && Array.isArray(p.photos)) {
          for (let i = 0; i < p.photos.length; i += 1) p.photos[i] = await toRef(row.account_id, p.photos[i]);
        }
      }
    }
    db.prepare("UPDATE students SET photo = ?, close_adults = ?, my_people = ? WHERE id = ?").run(
      photo,
      Array.isArray(adults) ? JSON.stringify(adults) : row.close_adults,
      Array.isArray(people) ? JSON.stringify(people) : row.my_people,
      row.id,
    );
  }
  if (converted || failed) console.log(`[photos] legacy data: URLs converted=${converted} left-unchanged=${failed}`);
  return { converted, failed };
}
