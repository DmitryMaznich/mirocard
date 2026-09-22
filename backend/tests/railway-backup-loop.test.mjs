import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runBackupOnce, startBackupLoop } from "../../scripts/railway-backup-loop.mjs";

function makeDataDirWithDb() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-backup-loop-"));
  const db = new DatabaseSync(path.join(dataDir, "mirocard.db"));
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
  db.close();
  return dataDir;
}

test("runBackupOnce writes a fresh backup file into <dataDir>/backups", () => {
  const dataDir = makeDataDirWithDb();
  runBackupOnce({ dataDir, retentionDays: 14 });
  const files = readdirSync(path.join(dataDir, "backups"));
  assert.equal(files.length, 1);
  assert.match(files[0], /^mirocard-.*\.db$/);
});

test("runBackupOnce throws when the source db doesn't exist", () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-backup-loop-empty-"));
  // No mirocard.db written -- backupSqlite logs and returns null rather
  // than throwing for a missing source, so this specifically must NOT throw.
  assert.doesNotThrow(() => runBackupOnce({ dataDir, retentionDays: 14 }));
});

test("a throwing backup attempt inside the interval loop does not crash the process (regression guard)", async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-backup-loop-broken-"));
  // A file (not a valid SQLite db) at mirocard.db makes DatabaseSync throw
  // when railway-backup-loop.mjs's runBackupOnce -> backupSqlite tries to
  // open it -- simulating the kind of failure (corrupt file, disk issue)
  // that used to crash the whole backend process every hour via an
  // uncaught exception in the setInterval callback.
  writeFileSync(path.join(dataDir, "mirocard.db"), "not a real sqlite file");

  let uncaught = false;
  const onUncaught = () => { uncaught = true; };
  process.on("uncaughtException", onUncaught);
  try {
    const timer = startBackupLoop({ dataDir, retentionDays: 14, intervalMs: 20 });
    await new Promise((resolve) => setTimeout(resolve, 80)); // let a couple of ticks fire
    clearInterval(timer);
    assert.equal(uncaught, false, "a failing backup attempt must not crash the process");
  } finally {
    process.off("uncaughtException", onUncaught);
  }
});
