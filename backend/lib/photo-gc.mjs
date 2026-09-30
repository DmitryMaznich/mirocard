// Deletes rows from the content-addressed `photos` store that nothing points
// at any more: a photo removed from a card, a deleted person, a My People
// photo uploaded on pick and then abandoned before "Готово".
//
// Where references live is deliberately NOT enumerated (students.photo,
// close_adults, my_people, account_kv instruction steps, ...): a missed
// location would mean deleting a photo that's still in use. Instead every
// text value in every other table is scanned for "/api/photos/<hash>", so a
// new feature that stores photo URLs somewhere new is covered automatically.
//
// Guards against deleting something still on its way:
//   - a grace period since the photo was last uploaded, because a client can
//     upload first and hold the referencing sync op in its offline queue;
//   - a cap on the fraction deleted per run, so a bug in reference scanning
//     (or a half-restored DB) can't wipe the store in one go. Hourly SQLite
//     backups (14-day retention) are the last line of recovery.

const PHOTO_URL = /\/api\/photos\/([0-9a-f]{32})/g;

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

export function collectReferencedPhotoHashes(db) {
  const referenced = new Set();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'photos'"
  ).all();
  for (const { name: table } of tables) {
    const columns = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
    for (const { name: column } of columns) {
      const rows = db.prepare(
        `SELECT ${quoteIdent(column)} AS v FROM ${quoteIdent(table)} WHERE typeof(${quoteIdent(column)}) = 'text' AND ${quoteIdent(column)} LIKE '%/api/photos/%'`
      ).all();
      for (const { v } of rows) {
        for (const match of v.matchAll(PHOTO_URL)) referenced.add(match[1]);
      }
    }
  }
  return referenced;
}

export function pruneOrphanPhotos(db, { now = new Date(), graceDays = 30, maxDeleteFraction = 0.5 } = {}) {
  const referenced = collectReferencedPhotoHashes(db);
  const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000).toISOString();
  const photos = db.prepare("SELECT hash, created_at FROM photos").all();
  const orphans = photos.filter((photo) => !referenced.has(photo.hash) && photo.created_at < cutoff);

  const result = { total: photos.length, referenced: referenced.size, orphans: orphans.length, deleted: 0, aborted: false };
  if (orphans.length > 10 && orphans.length > photos.length * maxDeleteFraction) {
    result.aborted = true;
    return result;
  }

  const remove = db.prepare("DELETE FROM photos WHERE hash = ?");
  db.exec("BEGIN");
  try {
    for (const { hash } of orphans) result.deleted += remove.run(hash).changes;
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return result;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startPhotoGcLoop(db, { firstRunDelayMs = 15 * 60 * 1000, log = console } = {}) {
  function run() {
    try {
      const result = pruneOrphanPhotos(db);
      if (result.aborted) {
        log.error(`[photo-gc] aborted: ${result.orphans} of ${result.total} photos look orphaned -- too many, not deleting`);
      } else {
        log.log(`[photo-gc] ${result.deleted} orphaned photos deleted (${result.total} stored, ${result.referenced} referenced)`);
      }
    } catch (err) {
      // Never let a GC failure take the service down.
      log.error("[photo-gc] failed:", err);
    }
  }
  setTimeout(() => {
    run();
    setInterval(run, DAY_MS).unref?.();
  }, firstRunDelayMs).unref?.();
}
