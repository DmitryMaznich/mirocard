import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runBackupOnce, startBackupLoop, pruneBackups } from "../../scripts/railway-backup-loop.mjs";

function makeDataDirWithDb() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-backup-loop-"));
  const db = new DatabaseSync(path.join(dataDir, "mirocard.db"));
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
  db.close();
  return dataDir;
}

test("runBackupOnce writes a fresh backup file into <dataDir>/backups", () => {
  const dataDir = makeDataDirWithDb();
  runBackupOnce({ dataDir });
  const files = readdirSync(path.join(dataDir, "backups"));
  assert.equal(files.length, 1);
  assert.match(files[0], /^mirocard-.*\.db$/);
});

test("runBackupOnce throws when the source db doesn't exist", () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-backup-loop-empty-"));
  // No mirocard.db written -- backupSqlite logs and returns null rather
  // than throwing for a missing source, so this specifically must NOT throw.
  assert.doesNotThrow(() => runBackupOnce({ dataDir }));
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
    const timer = startBackupLoop({ dataDir, intervalMs: 20 });
    await new Promise((resolve) => setTimeout(resolve, 80)); // let a couple of ticks fire
    clearInterval(timer);
    assert.equal(uncaught, false, "a failing backup attempt must not crash the process");
  } finally {
    process.off("uncaughtException", onUncaught);
  }
});

test("only the newest backups are kept; a run makes room before copying and leaves no temp file", () => {
  const dataDir = makeDataDirWithDb();
  const backupDir = path.join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });
  for (let i = 0; i < 6; i += 1) {
    const f = path.join(backupDir, `mirocard-old-${i}.db`);
    writeFileSync(f, "x");
    utimesSync(f, 1000 + i, 1000 + i); // old-5 is the newest
  }
  writeFileSync(path.join(backupDir, "mirocard-cut.db.partial"), "x");
  writeFileSync(path.join(backupDir, "notes.txt"), "not a backup");

  assert.deepEqual(pruneBackups({ dataDir, keep: 3 }).sort(), ["mirocard-cut.db.partial", "mirocard-old-0.db", "mirocard-old-1.db", "mirocard-old-2.db"]);
  assert.deepEqual(readdirSync(backupDir).sort(), ["mirocard-old-3.db", "mirocard-old-4.db", "mirocard-old-5.db", "notes.txt"]);

  runBackupOnce({ dataDir, keep: 3 });
  const after = readdirSync(backupDir).sort();
  assert.equal(after.length, 4); // 3 backups + notes.txt
  assert.ok(after.includes("mirocard-old-4.db") && after.includes("mirocard-old-5.db"));
  assert.ok(!after.includes("mirocard-old-3.db"));
  assert.ok(!after.some((n) => n.endsWith(".partial")));
});

test("pruneBackups tolerates a missing backups directory", () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "mirocard-backup-loop-none-"));
  assert.deepEqual(pruneBackups({ dataDir }), []);
});
